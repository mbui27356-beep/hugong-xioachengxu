// 由后端模块 backend/src/modules/admin/dispatch.ts 对应的 HTTP 客户端；类型直接取自后端实现，保证两端一致。
import type * as M from '../../../backend/src/modules/admin/dispatch'
import { rpc } from './http'

export type * from '../../../backend/src/modules/admin/dispatch'

export const listCaregivers = rpc<typeof M.listCaregivers>('dispatch', 'listCaregivers')
export const saveCaregiver = rpc<typeof M.saveCaregiver>('dispatch', 'saveCaregiver')
export const setCaregiverDuty = rpc<typeof M.setCaregiverDuty>('dispatch', 'setCaregiverDuty')
export const listDispatchQueue = rpc<typeof M.listDispatchQueue>('dispatch', 'listDispatchQueue')
export const listCandidates = rpc<typeof M.listCandidates>('dispatch', 'listCandidates')
export const assignCaregiver = rpc<typeof M.assignCaregiver>('dispatch', 'assignCaregiver')
