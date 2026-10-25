import type { PaymentStatus, Refund, RefundStatus } from '../contracts'

// 退款额度：成功金额 + 进行中预留金额 ≤ 实收金额（开发文档 5.3）。

/** 占用额度但尚未成功的退款状态。失败单待人工重试，仍占额，避免生成相同金额的新退款。 */
export const IN_FLIGHT: RefundStatus[] = ['REQUESTED', 'APPROVED', 'PROCESSING', 'FAILED']

function reservedFen(r: Refund): number {
  // 已申请阶段按申请金额占额；批准后按核定金额占额
  return r.status === 'REQUESTED' ? r.requestedFen : r.amountFen
}

export interface RefundSummary {
  paidFen: number
  refundedFen: number
  inFlightFen: number
  capFen: number
}

export function refundSummary(paidFen: number, refunds: Refund[], excludeRefundId?: string): RefundSummary {
  const refundedFen = refunds.filter((r) => r.status === 'SUCCEEDED').reduce((s, r) => s + r.amountFen, 0)
  const inFlightFen = refunds
    .filter((r) => r.id !== excludeRefundId && IN_FLIGHT.includes(r.status))
    .reduce((s, r) => s + reservedFen(r), 0)
  return { paidFen, refundedFen, inFlightFen, capFen: Math.max(0, paidFen - refundedFen - inFlightFen) }
}

export function validateRefundAmount(amountFen: number | null, summary: RefundSummary): string | null {
  if (amountFen == null) return '请输入正确金额，最多两位小数'
  if (amountFen <= 0) return '退款金额必须大于 0'
  if (amountFen > summary.capFen) return `超出可退额度（实收 − 已退 − 处理中）`
  return null
}

export function derivePaymentStatus(paidFen: number, refundedFen: number): PaymentStatus {
  if (paidFen <= 0) return 'UNPAID'
  if (refundedFen <= 0) return 'PAID'
  if (refundedFen >= paidFen) return 'REFUNDED'
  return 'PARTIALLY_REFUNDED'
}

export type RefundAction = 'approve' | 'reject' | 'execute' | 'retry'

export const REFUND_ACTION_FROM: Record<RefundAction, RefundStatus[]> = {
  approve: ['REQUESTED'],
  reject: ['REQUESTED'],
  execute: ['APPROVED'],
  retry: ['FAILED'],
}

export function canRefundAction(status: RefundStatus, action: RefundAction): boolean {
  return REFUND_ACTION_FROM[action].includes(status)
}
