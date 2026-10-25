// 由后端模块 backend/src/modules/admin/agreements.ts 对应的 HTTP 客户端；类型直接取自后端实现，保证两端一致。
import type * as M from '../../../backend/src/modules/admin/agreements'
import { rpc } from './http'

export type * from '../../../backend/src/modules/admin/agreements'

export const getAgreements = rpc<typeof M.getAgreements>('agreements', 'getAgreements')
export const saveDraft = rpc<typeof M.saveDraft>('agreements', 'saveDraft')
export const discardDraft = rpc<typeof M.discardDraft>('agreements', 'discardDraft')
export const publishDraft = rpc<typeof M.publishDraft>('agreements', 'publishDraft')
