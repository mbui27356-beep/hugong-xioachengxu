import type { AssignmentStatus, BusinessStatus, PaymentAttemptStatus, PaymentStatus, RefundStatus } from '@/contracts'
import type { Tone } from '@/components/ui/types'

// 订单状态配色（design-system.md）：待确认 warning，待支付 accent，待服务 indigo，服务中 success，终态灰。
export const BUSINESS_TONE: Record<BusinessStatus, Tone> = {
  PENDING_CONFIRM: 'warning',
  PENDING_PAYMENT: 'accent',
  PENDING_SERVICE: 'indigo',
  IN_SERVICE: 'success',
  COMPLETED: 'muted',
  REJECTED: 'muted',
  CANCELLED: 'muted',
}

export const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  UNPAID: 'muted',
  PAID: 'neutral',
  PARTIALLY_REFUNDED: 'warning',
  REFUNDED: 'muted',
}

export const REFUND_TONE: Record<RefundStatus, Tone> = {
  REQUESTED: 'warning',
  APPROVED: 'accent',
  PROCESSING: 'indigo',
  SUCCEEDED: 'success',
  REJECTED: 'muted',
  FAILED: 'danger',
}

export const ATTEMPT_TONE: Record<PaymentAttemptStatus, Tone> = {
  PENDING: 'accent',
  SUCCESS: 'success',
  CLOSED: 'muted',
}

export const ASSIGNMENT_TONE: Record<AssignmentStatus, Tone> = {
  RESERVED: 'accent',
  ACTIVE: 'success',
  REPLACED: 'muted',
  RELEASED: 'muted',
  FINISHED: 'neutral',
}
