import type * as M from '../../../backend/src/modules/admin/session'
import { rpc } from './http'
import { setDemoAdminId } from './demoIdentity'

export { failNextRequest } from './http'

export const listDemoIdentities = rpc<typeof M.listDemoIdentities>('session', 'listDemoIdentities')
export const getCurrentAdmin = rpc<typeof M.me>('session', 'me')
export const resetDemoData = rpc<typeof M.resetDemoData>('session', 'resetDemoData')

export async function switchIdentity(adminId: string): Promise<void> {
  setDemoAdminId(adminId)
}
