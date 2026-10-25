import type { PaymentAttemptStatus, Refund, RefundStatus } from '../../../../packages/contracts'
import { maskName } from '../../../../packages/domain/masking'
import { formatFen, parseYuanToFen, sumFen } from '../../../../packages/domain/money'
import { canRefundAction, derivePaymentStatus, validateRefundAmount, type RefundSummary } from '../../../../packages/domain/refundRules'
import { HOUR } from '../../../../packages/domain/time'
import { fail, findOr404, mutate, query, requireText, type Ctx } from '../../core/ctx'
import { orderRefundSummary, paidFenOf, pushMessage } from '../shared/orderOps'

export interface PaymentRow {
  id: string
  orderId: string
  orderNo: string
  hospitalName: string
  patientName: string
  outTradeNo: string
  transactionId: string | null
  amountFen: number
  status: PaymentAttemptStatus
  paidAt: number | null
  createdAt: number
}

export const listPayments = (f: { keyword?: string; status?: PaymentAttemptStatus | '' } = {}) =>
  query((ctx): PaymentRow[] => {
    ctx.require('payment.view')
    const kw = (f.keyword ?? '').trim().toUpperCase()
    return ctx.db.payments
      .map((p) => ({ p, o: ctx.db.orders.find((o) => o.id === p.orderId)! }))
      .filter(({ o }) => o && ctx.canHospital(o.hospitalId))
      .filter(({ p }) => !f.status || p.status === f.status)
      .filter(({ p, o }) => !kw || o.orderNo.includes(kw) || p.outTradeNo.includes(kw) || (p.transactionId ?? '').includes(kw))
      .sort((a, b) => b.p.createdAt - a.p.createdAt)
      .map(({ p, o }) => ({
        id: p.id, orderId: o.id, orderNo: o.orderNo, hospitalName: o.locationSnapshot.hospitalName,
        patientName: maskName(o.patientSnapshot.name), outTradeNo: p.outTradeNo, transactionId: p.transactionId,
        amountFen: p.amountFen, status: p.status, paidAt: p.paidAt, createdAt: p.createdAt,
      }))
  })

export interface RefundRow extends Refund {
  orderNo: string
  orderStatus: string
  hospitalName: string
  patientName: string
  summary: RefundSummary
  /** 本单可核定的最大金额（排除自身占额） */
  approvableCapFen: number
}

function refundRow(ctx: Ctx, r: Refund): RefundRow {
  const o = ctx.db.orders.find((x) => x.id === r.orderId)!
  return {
    ...r,
    orderNo: o.orderNo,
    orderStatus: o.businessStatus,
    hospitalName: o.locationSnapshot.hospitalName,
    patientName: maskName(o.patientSnapshot.name),
    summary: orderRefundSummary(ctx, o.id),
    approvableCapFen: orderRefundSummary(ctx, o.id, r.id).capFen,
  }
}

export const listRefunds = (f: { status?: RefundStatus | '' | 'TODO' } = {}) =>
  query((ctx) => {
    ctx.require('payment.view')
    const all = ctx.db.refunds.filter((r) => {
      const o = ctx.db.orders.find((x) => x.id === r.orderId)
      return o && ctx.canHospital(o.hospitalId)
    })
    const todo: RefundStatus[] = ['REQUESTED', 'APPROVED', 'FAILED']
    const counts = {
      TODO: all.filter((r) => todo.includes(r.status)).length,
      PROCESSING: all.filter((r) => r.status === 'PROCESSING').length,
      ALL: all.length,
    }
    const items = all
      .filter((r) => !f.status || (f.status === 'TODO' ? todo.includes(r.status) : r.status === f.status))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((r) => refundRow(ctx, r))
    return { items, counts }
  })

function loadRefund(ctx: Ctx, id: string) {
  const r = findOr404(ctx.db.refunds, id, '退款单')
  const o = findOr404(ctx.db.orders, r.orderId, '订单')
  ctx.requireHospital(o.hospitalId)
  return { r, o }
}

export const approveRefund = (id: string, input: { amount: string; note: string; updatedAt: number }) =>
  mutate((ctx) => {
    ctx.require('refund.approve')
    const { r, o } = loadRefund(ctx, id)
    if (r.updatedAt !== input.updatedAt) fail('STATE_CONFLICT', '退款单已被其他人处理，请刷新后重试')
    if (!canRefundAction(r.status, 'approve')) fail('STATE_CONFLICT', '只有已申请的退款可以批准')
    const fen = parseYuanToFen(input.amount)
    const summary = orderRefundSummary(ctx, o.id, r.id)
    const err = validateRefundAmount(fen, summary)
    if (err) fail('VALIDATION_FAILED', `${err}：最多可退 ${formatFen(summary.capFen)}`)
    const note = requireText(input.note, '审核意见', 200)
    r.amountFen = fen!
    r.status = 'APPROVED'
    r.operatorId = ctx.actor.id
    r.updatedAt = ctx.now
    r.history.push({ at: ctx.now, status: 'APPROVED', actorName: ctx.actor.name, note: `核定 ${formatFen(fen!)}；${note}` })
    o.timeline.push({ at: ctx.now, title: '退款已批准', detail: `核定 ${formatFen(fen!)}`, actorName: ctx.actor.name })
    ctx.audit({ action: 'refund.approve', targetType: '退款', targetId: r.outRefundNo, summary: `批准退款 ${formatFen(fen!)}（申请 ${formatFen(r.requestedFen)}）`, reason: note })
    return true
  })

export const rejectRefund = (id: string, input: { reason: string; updatedAt: number }) =>
  mutate((ctx) => {
    ctx.require('refund.approve')
    const { r, o } = loadRefund(ctx, id)
    if (r.updatedAt !== input.updatedAt) fail('STATE_CONFLICT', '退款单已被其他人处理，请刷新后重试')
    if (!canRefundAction(r.status, 'reject')) fail('STATE_CONFLICT', '只有已申请的退款可以驳回')
    const reason = requireText(input.reason, '驳回理由', 200)
    r.status = 'REJECTED'
    r.operatorId = ctx.actor.id
    r.updatedAt = ctx.now
    r.history.push({ at: ctx.now, status: 'REJECTED', actorName: ctx.actor.name, note: reason })
    o.timeline.push({ at: ctx.now, title: '退款被驳回', detail: reason, actorName: ctx.actor.name })
    pushMessage(ctx, o.userId, o.id, '退款申请未通过', `订单 ${o.orderNo} 的退款申请未通过：${reason}。如有疑问请联系客服。`)
    ctx.audit({ action: 'refund.reject', targetType: '退款', targetId: r.outRefundNo, summary: `驳回退款 ${formatFen(r.requestedFen)}`, reason })
    return true
  })

/** 执行或重试退款：原路退回（模拟渠道）。重试复用同一退款单号，避免重复退款。 */
function runRefund(ctx: Ctx, id: string, simulateFailure: boolean, retry: boolean) {
  ctx.require('refund.execute')
  const { r, o } = loadRefund(ctx, id)
  if (!canRefundAction(r.status, retry ? 'retry' : 'execute')) {
    fail('STATE_CONFLICT', retry ? '只有失败的退款可以重试' : '只有已批准的退款可以执行')
  }
  // 再次校验额度（排除自身）
  const summary = orderRefundSummary(ctx, o.id, r.id)
  if (r.amountFen > summary.capFen) fail('VALIDATION_FAILED', `超出可退额度：最多可退 ${formatFen(summary.capFen)}`)
  r.attempts += 1
  r.history.push({ at: ctx.now, status: 'PROCESSING', actorName: ctx.actor.name, note: retry ? `重试第 ${r.attempts} 次，复用退款单号 ${r.outRefundNo}` : '提交原路退款' })
  if (simulateFailure) {
    r.status = 'FAILED'
    r.failReason = '演示：渠道返回处理失败，待人工处理'
    r.history.push({ at: ctx.now + 1, status: 'FAILED', actorName: '支付渠道（模拟）', note: r.failReason })
    o.timeline.push({ at: ctx.now, title: '退款失败', detail: `${formatFen(r.amountFen)}，待人工处理`, actorName: '支付渠道（模拟）' })
  } else {
    r.status = 'SUCCEEDED'
    r.failReason = null
    r.history.push({ at: ctx.now + 1, status: 'SUCCEEDED', actorName: '支付渠道（模拟）', note: '可信结果已确认' })
    const paid = paidFenOf(ctx, o.id)
    const refunded = sumFen(ctx.db.refunds.filter((x) => x.orderId === o.id && x.status === 'SUCCEEDED').map((x) => x.amountFen))
    o.paymentStatus = derivePaymentStatus(paid, refunded)
    o.timeline.push({ at: ctx.now, title: '退款成功', detail: `${formatFen(r.amountFen)} 原路退回（模拟）`, actorName: '支付渠道（模拟）' })
    pushMessage(ctx, o.userId, o.id, '退款已到账', `订单 ${o.orderNo} 退款 ${formatFen(r.amountFen)} 已原路退回，到账时间以银行为准。`)
  }
  r.operatorId = ctx.actor.id
  r.updatedAt = ctx.now
  o.version += 1
  o.updatedAt = ctx.now
  ctx.audit({
    action: retry ? 'refund.retry' : 'refund.execute', targetType: '退款', targetId: r.outRefundNo,
    summary: `${retry ? '重试' : '执行'}退款 ${formatFen(r.amountFen)}：${r.status === 'SUCCEEDED' ? '成功' : '失败'}`, reason: null,
  })
  return { status: r.status }
}

export const executeRefund = (id: string, simulateFailure = false) => mutate((ctx) => runRefund(ctx, id, simulateFailure, false))
export const retryRefund = (id: string, simulateFailure = false) => mutate((ctx) => runRefund(ctx, id, simulateFailure, true))

export const getReconciliation = () =>
  query((ctx) => {
    ctx.require('payment.view')
    const orders = ctx.db.orders.filter((o) => ctx.canHospital(o.hospitalId))
    const ids = new Set(orders.map((o) => o.id))
    const payments = ctx.db.payments.filter((p) => ids.has(p.orderId))
    const refunds = ctx.db.refunds.filter((r) => ids.has(r.orderId))
    const paidFen = sumFen(payments.filter((p) => p.status === 'SUCCESS').map((p) => p.amountFen))
    const refundedFen = sumFen(refunds.filter((r) => r.status === 'SUCCEEDED').map((r) => r.amountFen))
    const inFlightFen = sumFen(refunds.filter((r) => ['APPROVED', 'PROCESSING'].includes(r.status)).map((r) => r.amountFen))
    const anomalies: { level: 'danger' | 'warning'; title: string; detail: string; orderNo: string }[] = []
    for (const o of orders) {
      const paid = payments.some((p) => p.orderId === o.id && p.status === 'SUCCESS')
      if (paid && o.paymentStatus === 'UNPAID') anomalies.push({ level: 'danger', title: '已支付未入账', detail: '渠道成功但订单仍为未支付', orderNo: o.orderNo })
      const channelPaid = payments.find((p) => p.orderId === o.id && p.status === 'PENDING' && p.channelState === 'SUCCESS')
      if (channelPaid) anomalies.push({ level: 'warning', title: '待核对支付', detail: '渠道显示已付款，尚未收到回调；取消前会自动核对', orderNo: o.orderNo })
    }
    for (const r of refunds) {
      const o = orders.find((x) => x.id === r.orderId)!
      if (r.status === 'FAILED') anomalies.push({ level: 'danger', title: '退款失败待处理', detail: r.failReason ?? '渠道失败', orderNo: o.orderNo })
      if (r.status === 'PROCESSING' && ctx.now - r.updatedAt > 24 * HOUR) anomalies.push({ level: 'warning', title: '退款长期处理中', detail: '超过 24 小时未收到结果', orderNo: o.orderNo })
    }
    return {
      paidFen, refundedFen, inFlightFen, netFen: paidFen - refundedFen,
      successCount: payments.filter((p) => p.status === 'SUCCESS').length,
      refundCount: refunds.filter((r) => r.status === 'SUCCEEDED').length,
      anomalies,
    }
  })
