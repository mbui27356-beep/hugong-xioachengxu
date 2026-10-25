// service 层：页面只调用这里。数据统一来自后端（本地演示后端或未来的云函数）。

import { app, request } from './http'
import { setDemoUser } from './demo'
import type {
  Agreement, AgreementType, City, CreateOrderInput, DemoUser, HospitalCard, HospitalGrade, HospitalTree, LocationSelection,
  Message, OfferingView, Order, Page, Patient, PatientInput, PaymentStatus, BusinessStatus, PrepayResult, Quote, QuoteInput,
  ServiceSettings,
} from '../core/types'

export function newRequestId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export const catalog = {
  filters: () => app<{ cities: City[]; grades: HospitalGrade[] }>('filters'),
  listHospitals: (q: { keyword: string; cityId: string; gradeId: string; cursor: string | null }) => app<Page<HospitalCard>>('listHospitals', q),
  getHospitalTree: (hospitalId: string) => app<HospitalTree>('getHospitalTree', hospitalId),
  listOfferings: (location: LocationSelection) => app<OfferingView[]>('listOfferings', location),
  settings: () => app<ServiceSettings>('settings'),
}

export const agreements = {
  getPublished: (types: AgreementType[]) => app<Agreement[]>('getAgreements', types),
}

export const patients = {
  list: () => app<Patient[]>('listPatients'),
  get: (id: string) => app<Patient>('getPatient', id),
  save: (id: string | null, input: PatientInput) => app<Patient>('savePatient', id, input),
  remove: (id: string) => app<true>('removePatient', id),
}

export const orders = {
  quote: (input: QuoteInput) => app<Quote>('quote', input),
  create: (input: CreateOrderInput) => app<Order>('createOrder', input),
  list: (q: { tab: string; patientId: string }) => app<Order[]>('listOrders', q),
  detail: (id: string) => app<Order>('getOrder', id),
  cancel: (id: string, reason: string, version: number) => app<Order>('cancelOrder', id, reason, version),
}

export const payments = {
  prepare: (orderId: string) => app<PrepayResult>('preparePayment', orderId),
  query: (orderId: string) => app<{ paymentStatus: PaymentStatus; businessStatus: BusinessStatus }>('queryPayment', orderId),
}

export const refunds = {
  request: (orderId: string, reason: string, version: number) => app<Order>('requestRefund', orderId, reason, version),
}

export const messages = {
  list: () => app<Message[]>('listMessages'),
  read: (id: string) => app<Message>('readMessage', id),
  readAll: () => app<true>('readAllMessages'),
  unread: () => app<number>('unreadCount'),
}

export const account = {
  me: () => app<DemoUser>('me'),
  /** ⚠ 演示：列出可切换的模拟账号 */
  demoUsers: () => request<DemoUser[]>('/demo/users'),
  switchDemoUser: (id: string) => setDemoUser(id),
}
