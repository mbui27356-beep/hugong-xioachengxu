import type { AssessmentAnswer, AssessmentKey, BusinessStatus, Order, PaymentStatus, RefundStatus } from './types'

export type Tone = 'warning' | 'accent' | 'indigo' | 'success' | 'neutral' | 'danger'

export const BUSINESS_STATUS: Record<BusinessStatus, { label: string; tone: Tone; hint: string }> = {
  PENDING_CONFIRM: { label: '待确认', tone: 'warning', hint: '我们正在核实需求并安排人员，确认后会通知你付款。' },
  PENDING_PAYMENT: { label: '待支付', tone: 'accent', hint: '人员已预留，请在截止时间前完成支付。' },
  PENDING_SERVICE: { label: '待服务', tone: 'indigo', hint: '已支付，护工将按约定时间到岗。' },
  IN_SERVICE: { label: '服务中', tone: 'success', hint: '护工正在为就诊人提供服务。' },
  COMPLETED: { label: '已完成', tone: 'neutral', hint: '服务已结束，感谢信任。' },
  REJECTED: { label: '未能安排', tone: 'neutral', hint: '本次预约未能安排，未产生费用。' },
  CANCELLED: { label: '已取消', tone: 'neutral', hint: '预约已取消。' },
}

export const PAYMENT_STATUS: Record<PaymentStatus, string> = {
  UNPAID: '未支付',
  PAID: '已支付',
  PARTIALLY_REFUNDED: '部分退款',
  REFUNDED: '已全额退款',
}

export const REFUND_STATUS: Record<RefundStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: '已申请', tone: 'warning' },
  APPROVED: { label: '已批准', tone: 'accent' },
  PROCESSING: { label: '退款处理中', tone: 'accent' },
  SUCCEEDED: { label: '退款成功', tone: 'success' },
  REJECTED: { label: '已驳回', tone: 'neutral' },
  FAILED: { label: '待人工处理', tone: 'danger' },
}

export const ASSESSMENT_ITEMS: Array<{ key: AssessmentKey; label: string }> = [
  { key: 'walk', label: '起身行走' },
  { key: 'turn', label: '翻身换位' },
  { key: 'express', label: '表达不适' },
  { key: 'eat', label: '进食饮水' },
  { key: 'toilet', label: '洗漱如厕' },
]

export const ASSESSMENT_OPTIONS: Array<{ value: AssessmentAnswer; label: string }> = [
  { value: 'CAN', label: '可以' },
  { value: 'NEED_HELP', label: '需要协助' },
  { value: 'UNSURE', label: '不确定' },
]

export const ORDER_TABS: Array<{ key: string; label: string }> = [
  { key: 'ALL', label: '全部' },
  { key: 'PENDING_CONFIRM', label: '待确认' },
  { key: 'PENDING_PAYMENT', label: '待支付' },
  { key: 'PENDING_SERVICE', label: '待服务' },
  { key: 'IN_SERVICE', label: '服务中' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'AFTER_SALE', label: '售后' },
]

const OPEN_REFUND: RefundStatus[] = ['REQUESTED', 'APPROVED', 'PROCESSING', 'FAILED']

export function hasOpenRefund(o: Order): boolean {
  return o.refunds.some((r) => OPEN_REFUND.indexOf(r.status) >= 0)
}

/** 列表与详情上展示的状态：业务状态与资金状态分开，退款未完成不显示成功 */
export function displayStatus(o: Order): { label: string; tone: Tone } {
  if (hasOpenRefund(o)) return { label: '售后处理中', tone: 'warning' }
  const base = BUSINESS_STATUS[o.businessStatus]
  if (o.businessStatus === 'CANCELLED' && o.paymentStatus === 'REFUNDED') return { label: '已取消 · 已退款', tone: 'neutral' }
  return { label: base.label, tone: base.tone }
}
