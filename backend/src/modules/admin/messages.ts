import type { Message } from '../../../../packages/contracts'
import { fail, mutate, query, requireText } from '../../core/ctx'
import { pushMessage } from '../shared/orderOps'

export interface MessageRow extends Message {
  recipientName: string
  orderNo: string | null
}

export const listMessages = (f: { type?: Message['type'] | ''; keyword?: string } = {}) =>
  query((ctx): MessageRow[] => {
    ctx.require('message.view')
    const kw = (f.keyword ?? '').trim()
    return ctx.db.messages
      .filter((m) => {
        if (!m.orderId) return true
        const o = ctx.db.orders.find((x) => x.id === m.orderId)
        return o ? ctx.canHospital(o.hospitalId) : true
      })
      .filter((m) => !f.type || m.type === f.type)
      .map((m) => ({
        ...m,
        recipientName: ctx.db.users.find((u) => u.id === m.recipientUserId)?.nickname ?? '—',
        orderNo: m.orderId ? (ctx.db.orders.find((o) => o.id === m.orderId)?.orderNo ?? null) : null,
      }))
      .filter((m) => !kw || m.title.includes(kw) || m.recipientName.includes(kw) || (m.orderNo ?? '').includes(kw.toUpperCase()))
      .sort((a, b) => b.createdAt - a.createdAt)
  })

export const listRecipients = () =>
  query((ctx) => {
    ctx.require('message.send')
    const orders = ctx.db.orders
      .filter((o) => ctx.canHospital(o.hospitalId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((o) => ({ id: o.id, orderNo: o.orderNo, userId: o.userId, label: `${o.orderNo} · ${o.packageSnapshot.name}` }))
    const userIds = new Set(orders.map((o) => o.userId))
    const users = ctx.db.users.filter((u) => userIds.has(u.id)).map((u) => ({ id: u.id, label: u.nickname }))
    return { users, orders }
  })

export const sendMessage = (input: { target: 'user' | 'order'; userId?: string; orderId?: string; title: string; body: string }) =>
  mutate((ctx) => {
    ctx.require('message.send')
    const title = requireText(input.title, '标题', 30)
    const body = requireText(input.body, '正文', 300)
    let userId: string
    let orderId: string | null = null
    if (input.target === 'order') {
      const o = ctx.db.orders.find((x) => x.id === input.orderId)
      if (!o) fail('VALIDATION_FAILED', '请选择订单')
      ctx.requireHospital(o.hospitalId)
      userId = o.userId
      orderId = o.id
    } else {
      const u = ctx.db.users.find((x) => x.id === input.userId)
      if (!u) fail('VALIDATION_FAILED', '请选择用户')
      const inScope = ctx.db.orders.some((o) => o.userId === u.id && ctx.canHospital(o.hospitalId))
      if (!inScope) fail('FORBIDDEN', '该用户不在你负责的医院范围内')
      userId = u.id
    }
    pushMessage(ctx, userId, orderId, title, body, 'MANUAL')
    ctx.audit({ action: 'message.send', targetType: input.target === 'order' ? '订单' : '用户', targetId: orderId ?? userId, summary: `发送站内通知「${title}」`, reason: null })
    return true
  })
