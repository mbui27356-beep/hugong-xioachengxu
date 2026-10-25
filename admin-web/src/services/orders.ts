// 由后端模块 backend/src/modules/admin/orders.ts 对应的 HTTP 客户端；类型直接取自后端实现，保证两端一致。
import type * as M from '../../../backend/src/modules/admin/orders'
import { rpc } from './http'

export type * from '../../../backend/src/modules/admin/orders'

export const listOrders = rpc<typeof M.listOrders>('orders', 'listOrders')
export const searchOrders = rpc<typeof M.searchOrders>('orders', 'searchOrders')
export const getOrderDetail = rpc<typeof M.getOrderDetail>('orders', 'getOrderDetail')
export const performOrderAction = rpc<typeof M.performOrderAction>('orders', 'performOrderAction')
export const addRemark = rpc<typeof M.addRemark>('orders', 'addRemark')
export const simulateConcurrentEdit = rpc<typeof M.simulateConcurrentEdit>('orders', 'simulateConcurrentEdit')
export const requestRefund = rpc<typeof M.requestRefund>('orders', 'requestRefund')
