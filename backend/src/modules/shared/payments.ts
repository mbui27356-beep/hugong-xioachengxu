import { formatDateTime } from '../../../../packages/domain/time'
import { formatFen } from '../../../../packages/domain/money'
import type { BaseCtx } from '../../core/ctx'
import { applyPaymentSuccess, bump, createRefund, pushMessage, reconcileBeforeClose, releaseAssignments } from './orderOps'

// 支付结果处理：只认“渠道通知/查单”，不采信客户端的支付成功标志（开发文档 9.1）。
// 正式回调入口完成验签、解密并核对商户号/AppID 后，传入同样的 notice 调用本函数。

export interface PaymentNotice {
  outTradeNo: string
  transactionId: string
  amountFen: number
}

export type NotifyOutcome = 'PAID' | 'DUPLICATE' | 'LATE_REFUND' | 'REJECTED'

export function handlePaymentNotify(ctx: BaseCtx, notice: PaymentNotice): NotifyOutcome {
  const attempt = ctx.db.payments.find((p) => p.outTradeNo === notice.outTradeNo)
  if (!attempt) return 'REJECTED'
  const order = ctx.db.orders.find((o) => o.id === attempt.orderId)
  if (!order) return 'REJECTED'
  // 金额不一致不入账
  if (notice.amountFen !== attempt.amountFen || attempt.amountFen !== order.totalFen) {
    order.timeline.push({ at: ctx.now, title: '支付通知金额不一致', detail: `通知 ${formatFen(notice.amountFen)}，未入账`, actorName: '支付渠道' })
    return 'REJECTED'
  }
  // 重复通知幂等
  if (attempt.status === 'SUCCESS') return 'DUPLICATE'
  attempt.transactionId = notice.transactionId
  attempt.channelState = 'SUCCESS'

  if (order.businessStatus === 'PENDING_PAYMENT' && order.paymentStatus === 'UNPAID') {
    applyPaymentSuccess(ctx, order, attempt, '支付渠道')
    return 'PAID'
  }
  // 迟到的成功通知：订单已取消/关闭，补记收款后安排全额退款（开发文档 5.2）
  attempt.status = 'SUCCESS'
  attempt.paidAt = ctx.now
  attempt.updatedAt = ctx.now
  order.paymentStatus = 'PAID'
  const r = createRefund(ctx, order, attempt.amountFen, '迟到支付补偿：订单已关闭，原路退回', 'ADMIN')
  bump(ctx, order, '收到迟到的支付', `已补记收款并创建退款申请 ${r.outRefundNo}`)
  pushMessage(ctx, order.userId, order.id, '付款已收到，将为你退款', `订单 ${order.orderNo} 已关闭，你稍后完成的付款将原路退回。`)
  return 'LATE_REFUND'
}

/** 付款截止处理：先与渠道核对，确认未付款才关闭并释放容量。不能因本地倒计时结束就认定未付款。 */
export function expireOverduePayments(ctx: BaseCtx): number {
  let closed = 0
  for (const o of ctx.db.orders) {
    if (o.businessStatus !== 'PENDING_PAYMENT' || o.paymentStatus !== 'UNPAID' || !o.paymentDeadlineAt || o.paymentDeadlineAt > ctx.now) continue
    if (reconcileBeforeClose(ctx, o)) continue
    releaseAssignments(ctx, o.id, '付款超时')
    o.businessStatus = 'CANCELLED'
    o.closeReason = '超过付款期限'
    const deadline = o.paymentDeadlineAt
    o.paymentDeadlineAt = null
    bump(ctx, o, '付款超时，已取消', `截止 ${formatDateTime(deadline)}；已关闭支付单并释放人员预留`)
    pushMessage(ctx, o.userId, o.id, '订单已超时取消', `订单 ${o.orderNo} 未在截止时间前付款，已自动取消，未产生费用。`)
    closed += 1
  }
  return closed
}
