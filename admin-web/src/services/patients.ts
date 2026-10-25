// 由后端模块 backend/src/modules/admin/patients.ts 对应的 HTTP 客户端；类型直接取自后端实现，保证两端一致。
import type * as M from '../../../backend/src/modules/admin/patients'
import { rpc } from './http'

export type * from '../../../backend/src/modules/admin/patients'

export const listPatients = rpc<typeof M.listPatients>('patients', 'listPatients')
export const revealPatient = rpc<typeof M.revealPatient>('patients', 'revealPatient')
export const exportPatients = rpc<typeof M.exportPatients>('patients', 'exportPatients')
export { REVEAL_REASONS } from '@/contracts'
