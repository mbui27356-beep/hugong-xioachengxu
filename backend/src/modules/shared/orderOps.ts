import type { Assignment, Message, Order, PaymentAttempt, Refund } from '../../../../packages/contracts'
import { formatFen } from '../../../../packages/domain/money'
import { refundSummary, validateRefundAmount, type RefundSummary } from '../../../../packages/domain/refundRules'
import { OCCUPYING } from '../../../../packages/domain/scheduling'
import { fail, type BaseCtx } from '../../core/ctx'

// 订单、调度、支付、退款在管理端与用户端共用的写操作。消息只写入站内消息集合，投递渠道另行处理。

export function pushMessage(ctx: BaseCtx, userId: string, orderId: string | null, title: string, body: string, type: Message['type'] = 'SYSTEM') {
  ctx.db.messages.unshift({
    id: ctx.id('msg'), recipientUserId: userId, orderId, type, title, body, readAt: null,
    senderName: type === 'SYSTEM' ? '系统' : ctx.actor.name, channel: 'IN_APP', subscribeChannelState: 'NOT_ENABLED',
    createdAt: ctx.now, updatedAt: ctx.now, demo: true,
  })
}

export function bump(ctx: BaseCtx, order: Order, title: string, detail?: string) {
  order.timeline.push({ at: ctx.now, title, detail, actorName: ctx.actor.name })
  order.version += 1
  order.updatedAt = ctx.now
}

export function paidFenOf(ctx: BaseCtx, orderId: string): number {
  return ctx.db.payments.filter((p) => p.orderId === orderId && p.status === 'SUCCESS').reduce((s, p) => s + p.amountFen, 0)
}

export function orderRefundSummary(ctx: BaseCtx, orderId: string, excludeRefundId?: string): RefundSummary {
  return refundSummary(paidFenOf(ctx, orderId), ctx.db.refunds.filter((r) => r.orderId === orderId), excludeRefundId)
}

export function occupyingAssignment(ctx: BaseCtx, orderId: string): Assignment | undefined {
  return ctx.db.assignments.find((a) => a.orderId === orderId && OCCUPYING.includes(a.status))
}

export function releaseAssignments(ctx: BaseCtx, orderId: string, reason: string) {
  for (const a of ctx.db.assignments) {
    if (a.orderId === orderId && OCCUPYING.includes(a.status)) {
      a.status = 'RELEASED'
      a.changedReason = reason
      a.updatedAt = ctx.now
    }
  }
}

export function applyPaymentSuccess(ctx: BaseCtx, order: Order, attempt: PaymentAttempt, actor: string) {
  attempt.status = 'SUCCESS'
  attempt.channelState = 'SUCCESS'
  attempt.paidAt = ctx.now
  attempt.transactionId = attempt.transactionId ?? `4200000${ctx.now.toString().slice(-9)}DEMO`
  attempt.updatedAt = ctx.now
  order.paymentStatus = 'PAID'
  order.businessStatus = 'PENDING_SERVICE'
  order.paymentDeadlineAt = null
  for (const a of ctx.db.assignments) {
    if (a.orderId === order.id && a.status === 'RESERVED') {
      a.status = 'ACTIVE'
      a.updatedAt = ctx.now
    }
  }
  order.timeline.push({ at: ctx.now, title: '支付成功', detail: `服务端核实金额 ${formatFen(attempt.amountFen)}`, actorName: actor })
  order.version += 1
  order.updatedAt = ctx.now
  pushMessage(ctx, order.userId, order.id, '付款成功', `订单 ${order.orderNo} 已确认收款，我们会按约定时间安排人员到岗。`)
}

/** 取消/拒绝未付款订单前先与支付渠道核对（模拟），处理支付中竞态。返回 true 表示发现已付款。 */
export function reconcileBeforeClose(ctx: BaseCtx, order: Order): boolean {
  const pending = ctx.db.payments.filter((p) => p.orderId === order.id && p.status === 'PENDING')
  const paid = pending.find((p) => p.channelState === 'SUCCESS')
  if (paid) {
    applyPaymentSuccess(ctx, order, paid, '支付渠道核对（模拟）')
    return true
  }
  for (const p of pending) {
    p.status = 'CLOSED'
    p.updatedAt = ctx.now
  }
  return false
}

export function createRefund(ctx: BaseCtx, order: Order, amountFen: number, reason: string, source: Refund['source']): Refund {
  const summary = orderRefundSummary(ctx, order.id)
  const err = validateRefundAmount(amountFen, summary)
  if (err) fail('VALIDATION_FAILED', `${err}：最多可退 ${formatFen(summary.capFen)}`)
  const payment = ctx.db.payments.find((p) => p.orderId === order.id && p.status === 'SUCCESS')
  if (!payment) fail('NOT_AVAILABLE', '未找到成功支付流水，不能创建退款')
  ctx.db.counters.refund += 1
  const r: Refund = {
    id: ctx.id('rf'), orderId: order.id, paymentId: payment.id,
    outRefundNo: `R${order.orderNo.slice(2)}${String(ctx.db.counters.refund).padStart(2, '0')}`,
    requestedFen: amountFen, amountFen, reason, source, status: 'REQUESTED', operatorId: null, failReason: null, attempts: 0,
    history: [{ at: ctx.now, status: 'REQUESTED', actorName: ctx.actor.name, note: reason }],
    createdAt: ctx.now, updatedAt: ctx.now, demo: true,
  }
  ctx.db.refunds.unshift(r)
  return r
}

