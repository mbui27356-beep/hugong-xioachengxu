// 由后端模块 backend/src/modules/admin/settings.ts 对应的 HTTP 客户端；类型直接取自后端实现，保证两端一致。
import type * as M from '../../../backend/src/modules/admin/settings'
import { rpc } from './http'

export type * from '../../../backend/src/modules/admin/settings'

export const getSettings = rpc<typeof M.getSettings>('settings', 'getSettings')
export const saveSettings = rpc<typeof M.saveSettings>('settings', 'saveSettings')
export const listAdmins = rpc<typeof M.listAdmins>('settings', 'listAdmins')
export const listHospitalOptions = rpc<typeof M.listHospitalOptions>('settings', 'listHospitalOptions')
export const saveAdmin = rpc<typeof M.saveAdmin>('settings', 'saveAdmin')
export const listAuditLogs = rpc<typeof M.listAuditLogs>('settings', 'listAuditLogs')
