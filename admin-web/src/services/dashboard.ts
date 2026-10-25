// 由后端模块 backend/src/modules/admin/dashboard.ts 对应的 HTTP 客户端；类型直接取自后端实现，保证两端一致。
import type * as M from '../../../backend/src/modules/admin/dashboard'
import { rpc } from './http'

export type * from '../../../backend/src/modules/admin/dashboard'

export const getOverview = rpc<typeof M.getOverview>('dashboard', 'getOverview')
