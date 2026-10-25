// 用户端（小程序）接口 DTO。服务端按此形状返回脱敏后的数据。
// 小程序无法引用目录外文件，`npm run sync:contracts` 会把本文件复制为 miniprogram/core/types.ts，请勿直接改副本。

export type BusinessStatus =
  | 'PENDING_CONFIRM'
  | 'PENDING_PAYMENT'
  | 'PENDING_SERVICE'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'

export type PaymentStatus = 'UNPAID' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED'

export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'PROCESSING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED'

export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'NOT_AVAILABLE'
  | 'NOT_FOUND'
  | 'PRICE_CHANGED'
  | 'AGREEMENT_CHANGED'
  | 'STATE_CONFLICT'
  | 'PAYMENT_PENDING'
  | 'NETWORK_ERROR'

export type Result<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: { code: ErrorCode; message: string }; requestId: string }

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface City {
  id: string
  name: string
}

export interface HospitalGrade {
  id: string
  name: string
  shortName: string
}

export interface HospitalCard {
  id: string
  cityId: string
  gradeId: string
  name: string
  district: string
  displayAddress: string
  cityName: string
  gradeName: string
  campusCount: number
  demo: boolean
}

export interface Ward {
  id: string
  name: string
}

export interface Department {
  id: string
  name: string
  wards: Ward[]
}

export interface CampusNode {
  id: string
  name: string
  address: string
  departments: Department[]
}

export interface HospitalTree {
  hospital: HospitalCard
  campuses: CampusNode[]
}

export type PackageType = 'ONE_TO_ONE' | 'ONE_TO_MANY'

export interface ServicePackage {
  id: string
  name: string
  type: PackageType
  summary: string
  content: string[]
  exclusions: string[]
  unitHours: number
  unitLabel: string
  conditions: string
}

export interface OfferingView {
  /** `${packageId}@${campusId}` */
  id: string
  packageId: string
  campusId: string
  unitPriceFen: number
  priceVersion: number
  consultPhone: string
  maxUnits: number
  pkg: ServicePackage
}

export type AgreementType = 'SERVICE' | 'PRIVACY' | 'REFUND'

export interface Agreement {
  id: string
  type: AgreementType
  title: string
  version: number
  summary: string
  sections: Array<{ heading: string; body: string }>
  contentHash: string
  publishedAt: number
}

export interface ConsentRef {
  agreementId: string
  type: AgreementType
  version: number
}

export type Gender = 'M' | 'F' | ''

export interface Patient {
  id: string
  name: string
  gender: Gender
  age: number | null
  contactName: string
  contactPhone: string
  /** 联系人与就诊人的关系；“本人”以外视为家属代填 */
  contactRelation: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export type PatientInput = Pick<Patient, 'name' | 'gender' | 'age' | 'contactName' | 'contactPhone' | 'contactRelation' | 'isDefault'>

export type AssessmentKey = 'walk' | 'turn' | 'express' | 'eat' | 'toilet'
export type AssessmentAnswer = 'CAN' | 'NEED_HELP' | 'UNSURE'
export type Assessment = Partial<Record<AssessmentKey, AssessmentAnswer>>

export interface LocationSelection {
  hospitalId: string
  campusId: string
  departmentId: string
  wardId: string
}

export interface LocationSnapshot extends LocationSelection {
  hospitalName: string
  campusName: string
  departmentName: string
  wardName: string
  address: string
}

export interface QuoteLine {
  label: string
  detail: string
  amountFen: number
}

export interface Quote {
  id: string
  offeringId: string
  location: LocationSnapshot
  startAt: number
  endAt: number
  units: number
  unitPriceFen: number
  lines: QuoteLine[]
  totalFen: number
  expiresAt: number
  assessment: Assessment
}

export interface QuoteInput {
  offeringId: string
  location: LocationSelection
  startAt: number
  units: number
  assessment: Assessment
}

export interface BedInfo {
  room: string
  bedNo: string
  unsure: boolean
}

export interface CreateOrderInput {
  quoteId: string
  patientId: string
  bed: BedInfo
  consents: ConsentRef[]
  /** 代他人预约时，确认已取得就诊人同意 */
  proxyConsent: boolean
  requestId: string
}

export interface OrderEvent {
  at: number
  title: string
  detail: string
}

export interface PaymentRecord {
  outTradeNo: string
  amountFen: number
  status: 'PENDING' | 'SUCCESS' | 'CLOSED'
  paidAt: number | null
}

export interface RefundRecord {
  outRefundNo: string
  /** 财务核定前为 null，用户不能决定退款执行金额 */
  amountFen: number | null
  reason: string
  status: RefundStatus
  createdAt: number
}

export interface Order {
  id: string
  orderNo: string
  patientId: string
  location: LocationSnapshot
  patient: { name: string; gender: Gender; age: number | null }
  contact: { name: string; phone: string; relationship: string }
  bed: BedInfo
  pkg: { name: string; type: PackageType; unitHours: number; unitLabel: string; content: string[]; exclusions: string[] }
  assessment: Assessment
  consents: ConsentRef[]
  startAt: number
  endAt: number
  units: number
  unitPriceFen: number
  lines: QuoteLine[]
  totalFen: number
  businessStatus: BusinessStatus
  paymentStatus: PaymentStatus
  paymentDeadline: number | null
  caregiver: { name: string; phone: string } | null
  events: OrderEvent[]
  payments: PaymentRecord[]
  refunds: RefundRecord[]
  version: number
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  orderId: string | null
  type: 'ORDER' | 'SYSTEM'
  title: string
  body: string
  sender: string
  readAt: number | null
  createdAt: number
}

export interface ServiceSettings {
  providerName: string
  servicePhone: string
  leadTimeMinutes: number
  acceptingOrders: boolean
  pauseNotice: string
  confirmWithinMinutes: number
  paymentWindowMinutes: number
  maxAdvanceDays: number
}

export interface PrepayResult {
  provider: 'MOCK'
  outTradeNo: string
  amountFen: number
}

export interface DemoUser {
  id: string
  nickname: string
}
