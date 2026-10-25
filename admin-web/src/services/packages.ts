// 由后端模块 backend/src/modules/admin/packages.ts 对应的 HTTP 客户端；类型直接取自后端实现，保证两端一致。
import type * as M from '../../../backend/src/modules/admin/packages'
import { rpc } from './http'

export type * from '../../../backend/src/modules/admin/packages'

export const listPackages = rpc<typeof M.listPackages>('packages', 'listPackages')
export const listPriceVersions = rpc<typeof M.listPriceVersions>('packages', 'listPriceVersions')
export const savePackage = rpc<typeof M.savePackage>('packages', 'savePackage')
export const setShelf = rpc<typeof M.setShelf>('packages', 'setShelf')
export const addPriceVersion = rpc<typeof M.addPriceVersion>('packages', 'addPriceVersion')
