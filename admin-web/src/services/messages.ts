// 由后端模块 backend/src/modules/admin/messages.ts 对应的 HTTP 客户端；类型直接取自后端实现，保证两端一致。
import type * as M from '../../../backend/src/modules/admin/messages'
import { rpc } from './http'

export type * from '../../../backend/src/modules/admin/messages'

export const listMessages = rpc<typeof M.listMessages>('messages', 'listMessages')
export const listRecipients = rpc<typeof M.listRecipients>('messages', 'listRecipients')
export const sendMessage = rpc<typeof M.sendMessage>('messages', 'sendMessage')
