import type {
  AdminUser, Agreement, AppUser, Assignment, AuditLog, Campus, Caregiver, City, Department, District, Hospital,
  HospitalGrade, Message, Order, Patient, PaymentAttempt, PriceVersion, Refund, ServicePackage, Settings, Ward,
} from '../../../packages/contracts'

// 逻辑集合（开发文档第 7 节）。本地演示存 JSON 文件；云开发开通后由 CloudBase 仓储实现同一 Store 接口。

export interface Quote {
  id: string
  userId: string
  packageId: string
  priceVersionId: string
  hospitalId: string
  campusId: string
  departmentId: string
  wardId: string
  startAt: number
  endAt: number
  units: number
  unitPriceFen: number
  totalFen: number
  assessment: Record<string, string>
  expiresAt: number
  createdAt: number
}

export interface Db {
  schema: number
  seededAt: number
  cities: City[]
  districts: District[]
  grades: HospitalGrade[]
  hospitals: Hospital[]
  campuses: Campus[]
  departments: Department[]
  wards: Ward[]
  packages: ServicePackage[]
  priceVersions: PriceVersion[]
  users: AppUser[]
  patients: Patient[]
  orders: Order[]
  payments: PaymentAttempt[]
  refunds: Refund[]
  caregivers: Caregiver[]
  assignments: Assignment[]
  messages: Message[]
  agreements: Agreement[]
  admins: AdminUser[]
  auditLogs: AuditLog[]
  settings: Settings
  counters: { order: number; refund: number; trade: number; id: number }
  /** 用户端报价（有效期内可用于下单） */
  quotes: Quote[]
  /** 幂等记录：`${userId}:${requestId}` → orderId */
  idempotency: Record<string, string>
}

export const SCHEMA = 4

export function nextId(d: Db, prefix: string): string {
  d.counters.id += 1
  return `${prefix}_${d.counters.id.toString(36)}`
}
