// 状态枚举，与开发文档 5.2 保持一致。业务状态与资金状态相互独立。

export const BusinessStatus = {
  PENDING_CONFIRM: 'PENDING_CONFIRM',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PENDING_SERVICE: 'PENDING_SERVICE',
  IN_SERVICE: 'IN_SERVICE',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const
export type BusinessStatus = (typeof BusinessStatus)[keyof typeof BusinessStatus]

export const BUSINESS_STATUS_LABEL: Record<BusinessStatus, string> = {
  PENDING_CONFIRM: '待确认',
  PENDING_PAYMENT: '待支付',
  PENDING_SERVICE: '待服务',
  IN_SERVICE: '服务中',
  COMPLETED: '已完成',
  REJECTED: '已拒绝',
  CANCELLED: '已取消',
}

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
} as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: '未支付',
  PAID: '已支付',
  PARTIALLY_REFUNDED: '部分退款',
  REFUNDED: '全额退款',
}

export const RefundStatus = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
} as const
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus]

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  REQUESTED: '已申请',
  APPROVED: '已批准',
  PROCESSING: '处理中',
  SUCCEEDED: '成功',
  REJECTED: '驳回',
  FAILED: '失败',
}

export type PaymentAttemptStatus = 'PENDING' | 'SUCCESS' | 'CLOSED'
export const PAYMENT_ATTEMPT_LABEL: Record<PaymentAttemptStatus, string> = {
  PENDING: '待支付',
  SUCCESS: '支付成功',
  CLOSED: '已关闭',
}

export type Role = 'SUPER_ADMIN' | 'OPERATOR' | 'DISPATCHER' | 'FINANCE' | 'SUPPORT'
export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: '超级管理员',
  OPERATOR: '运营',
  DISPATCHER: '调度',
  FINANCE: '财务',
  SUPPORT: '客服',
}
export const ALL_ROLES: Role[] = ['SUPER_ADMIN', 'OPERATOR', 'DISPATCHER', 'FINANCE', 'SUPPORT']

export type PackageType = 'ONE_TO_ONE' | 'ONE_TO_MANY'
export const PACKAGE_TYPE_LABEL: Record<PackageType, string> = {
  ONE_TO_ONE: '一对一',
  ONE_TO_MANY: '一对多',
}

export type BillingUnit = 'DAY_24H' | 'SHIFT_12H'
export const BILLING_UNIT_LABEL: Record<BillingUnit, string> = {
  DAY_24H: '天（连续 24 小时）',
  SHIFT_12H: '班次（12 小时）',
}
export const BILLING_UNIT_SHORT: Record<BillingUnit, string> = {
  DAY_24H: '天',
  SHIFT_12H: '班',
}

export type ShelfStatus = 'ON_SHELF' | 'OFF_SHELF'

export type AssignmentStatus = 'RESERVED' | 'ACTIVE' | 'REPLACED' | 'RELEASED' | 'FINISHED'
export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  RESERVED: '已预留',
  ACTIVE: '生效中',
  REPLACED: '已改派',
  RELEASED: '已释放',
  FINISHED: '已结束',
}

export type CaregiverDuty = 'ON_DUTY' | 'OFF_DUTY' | 'LEAVE'
export const CAREGIVER_DUTY_LABEL: Record<CaregiverDuty, string> = {
  ON_DUTY: '在岗',
  OFF_DUTY: '休息',
  LEAVE: '请假',
}

export type AgreementType = 'SERVICE' | 'PRIVACY' | 'REFUND'
export const AGREEMENT_TYPE_LABEL: Record<AgreementType, string> = {
  SERVICE: '服务说明',
  PRIVACY: '隐私告知',
  REFUND: '取消退款规则',
}

export type AssessmentAnswer = 'CAN' | 'NEED_HELP' | 'UNSURE'
export const ASSESSMENT_ANSWER_LABEL: Record<AssessmentAnswer, string> = {
  CAN: '可以',
  NEED_HELP: '需要协助',
  UNSURE: '不确定',
}
export const ASSESSMENT_ITEMS: { key: string; label: string }[] = [
  { key: 'walk', label: '起身行走' },
  { key: 'turn', label: '翻身换位' },
  { key: 'express', label: '表达不适' },
  { key: 'eat', label: '进食饮水' },
  { key: 'toilet', label: '洗漱如厕' },
]

/** 查看完整就诊人资料时必须选择的原因 */
export const REVEAL_REASONS = ['电话核实需求', '安排到岗联系', '处理售后或投诉', '紧急情况联系'] as const
