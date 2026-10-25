// 由后端模块 backend/src/modules/admin/payments.ts 对应的 HTTP 客户端；类型直接取自后端实现，保证两端一致。
import type * as M from '../../../backend/src/modules/admin/payments'
import { rpc } from './http'

export type * from '../../../backend/src/modules/admin/payments'

export const listPayments = rpc<typeof M.listPayments>('payments', 'listPayments')
export const listRefunds = rpc<typeof M.listRefunds>('payments', 'listRefunds')
export const approveRefund = rpc<typeof M.approveRefund>('payments', 'approveRefund')
export const rejectRefund = rpc<typeof M.rejectRefund>('payments', 'rejectRefund')
export const executeRefund = rpc<typeof M.executeRefund>('payments', 'executeRefund')
export const retryRefund = rpc<typeof M.retryRefund>('payments', 'retryRefund')
export const getReconciliation = rpc<typeof M.getReconciliation>('payments', 'getReconciliation')
