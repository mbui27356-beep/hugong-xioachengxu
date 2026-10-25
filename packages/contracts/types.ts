import type {
  AgreementType,
  AssessmentAnswer,
  AssignmentStatus,
  BillingUnit,
  BusinessStatus,
  CaregiverDuty,
  PackageType,
  PaymentAttemptStatus,
  PaymentStatus,
  RefundStatus,
  Role,
  ShelfStatus,
} from './enums'

/** 毫秒级 UTC 时间戳 */
export type Timestamp = number

export interface Meta {
  createdAt: Timestamp
  updatedAt: Timestamp
  /** 所有记录均为演示数据 */
  demo: true
}

// ---------- 目录 ----------
export interface City extends Meta {
  id: string
  name: string
  code: string
  enabled: boolean
  sort: number
}

export interface District extends Meta {
  id: string
  cityId: string
  name: string
  code: string
  enabled: boolean
  sort: number
}

export interface HospitalGrade extends Meta {
  id: string
  name: string
  shortName: string
  enabled: boolean
  sort: number
}

export interface Hospital extends Meta {
  id: string
  cityId: string
  districtId: string | null
  gradeId: string
  name: string
  displayAddress: string
  phone: string
  enabled: boolean
}

export interface Campus extends Meta {
  id: string
  hospitalId: string
  name: string
  address: string
  phone: string
  enabled: boolean
  sort: number
}

export interface Department extends Meta {
  id: string
  campusId: string
  name: string
  enabled: boolean
  sort: number
}

export interface Ward extends Meta {
  id: string
  departmentId: string
  name: string
  enabled: boolean
  sort: number
}

// ---------- 套餐 ----------
export interface ServicePackage extends Meta {
  id: string
  name: string
  type: PackageType
  content: string
  exclusions: string
  conditions: string
  limits: string
  consultPhone: string
  unit: BillingUnit
  campusIds: string[]
  status: ShelfStatus
  currentPriceVersionId: string | null
}

export interface PriceVersion extends Meta {
  id: string
  packageId: string
  version: number
  unit: BillingUnit
  unitPriceFen: number
  effectiveFrom: Timestamp
  effectiveTo: Timestamp | null
  note: string
  operatorName: string
}

// ---------- 用户与就诊人 ----------
export interface AppUser extends Meta {
  id: string
  nickname: string
  phone: string
}

export interface Patient extends Meta {
  id: string
  ownerUserId: string
  name: string
  gender: '男' | '女' | '未填'
  age: number | null
  contactName: string
  contactPhone: string
  relationship: string
  isDefault: boolean
  note: string
}

// ---------- 订单 ----------
export interface LocationSnapshot {
  cityName: string
  hospitalName: string
  campusName: string
  campusAddress: string
  departmentName: string
  wardName: string | null
  room: string | null
  bedNo: string | null
}

export interface PatientSnapshot {
  name: string
  gender: string
  age: number | null
}

export interface ContactSnapshot {
  name: string
  phone: string
  relationship: string
}

export interface PackageSnapshot {
  packageId: string
  name: string
  type: PackageType
  content: string
  exclusions: string
  unit: BillingUnit
  priceVersionId: string
  priceVersion: number
  unitPriceFen: number
}

export interface PriceLine {
  label: string
  unitPriceFen: number
  quantity: number
  amountFen: number
}

export interface TimelineEntry {
  at: Timestamp
  title: string
  detail?: string
  actorName: string
}

export interface OrderRemark {
  id: string
  at: Timestamp
  actorName: string
  text: string
}

export interface Order extends Meta {
  id: string
  orderNo: string
  userId: string
  patientId: string
  hospitalId: string
  campusId: string
  departmentId: string
  locationSnapshot: LocationSnapshot
  patientSnapshot: PatientSnapshot
  contactSnapshot: ContactSnapshot
  packageSnapshot: PackageSnapshot
  assessmentSnapshot: Record<string, AssessmentAnswer>
  needsNote: string
  agreementVersions: { type: AgreementType; version: number }[]
  units: number
  startAt: Timestamp
  endAt: Timestamp
  priceLines: PriceLine[]
  totalFen: number
  businessStatus: BusinessStatus
  paymentStatus: PaymentStatus
  paymentDeadlineAt: Timestamp | null
  actualStartAt: Timestamp | null
  actualEndAt: Timestamp | null
  closeReason: string | null
  timeline: TimelineEntry[]
  remarks: OrderRemark[]
  version: number
}

export interface PaymentAttempt extends Meta {
  id: string
  orderId: string
  outTradeNo: string
  transactionId: string | null
  amountFen: number
  status: PaymentAttemptStatus
  /** 模拟支付渠道侧的真实结果，用于演示取消时的竞态核对 */
  channelState: 'NOTPAY' | 'SUCCESS'
  paidAt: Timestamp | null
}

export interface RefundEvent {
  at: Timestamp
  status: RefundStatus
  actorName: string
  note?: string
}

export interface Refund extends Meta {
  id: string
  orderId: string
  paymentId: string
  outRefundNo: string
  requestedFen: number
  amountFen: number
  reason: string
  source: 'USER' | 'ADMIN'
  status: RefundStatus
  operatorId: string | null
  failReason: string | null
  attempts: number
  history: RefundEvent[]
}

// ---------- 护工与派单 ----------
export interface Caregiver extends Meta {
  id: string
  name: string
  phone: string
  gender: '男' | '女'
  campusIds: string[]
  mode: PackageType
  /** 一对多班组的最大服务人数；一对一固定为 1 */
  capacity: number
  shifts: string[]
  duty: CaregiverDuty
  note: string
}

export interface Assignment extends Meta {
  id: string
  orderId: string
  caregiverId: string
  startAt: Timestamp
  endAt: Timestamp
  status: AssignmentStatus
  changedReason: string | null
  arrivedAt: Timestamp | null
  operatorName: string
}

// ---------- 消息 ----------
export interface Message extends Meta {
  id: string
  recipientUserId: string
  orderId: string | null
  type: 'SYSTEM' | 'MANUAL'
  title: string
  body: string
  readAt: Timestamp | null
  senderName: string
  channel: 'IN_APP'
  subscribeChannelState: 'NOT_ENABLED'
}

// ---------- 协议 ----------
export interface Agreement extends Meta {
  id: string
  type: AgreementType
  version: number
  title: string
  body: string
  contentHash: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  publishedAt: Timestamp | null
  publisherName: string | null
}

// ---------- 管理员、审计、设置 ----------
export interface AdminUser extends Meta {
  id: string
  name: string
  account: string
  roles: Role[]
  /** '*' 表示全部医院 */
  allowedHospitalIds: string[] | '*'
  enabled: boolean
}

export interface AuditLog {
  id: string
  actorId: string
  actorName: string
  action: string
  targetType: string
  targetId: string
  summary: string
  reason: string | null
  createdAt: Timestamp
}

export interface Settings {
  providerName: string
  providerAddress: string
  providerLicense: string
  supportPhone: string
  supportHours: string
  businessHoursEnabled: boolean
  businessStart: string
  businessEnd: string
  leadTimeMinutes: number
  paymentDeadlineMinutes: number
  pauseOrders: boolean
  pauseNotice: string
  updatedAt: Timestamp
}

export interface Paged<T> {
  items: T[]
  total: number
}
