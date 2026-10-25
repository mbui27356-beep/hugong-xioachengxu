// ⚠ 演示专用接口：只在本地演示入口且 DEMO_MODE 开启时注册（见 entrypoints/local/server.ts）。
// 包含：模拟收银台付款（触发与真实回调相同的入账逻辑）。正式环境不得注册本模块。

import { fail, userMutate } from '../../core/ctx'
import { simulateUserPaid } from '../../adapters/mock/payment'
import { handlePaymentNotify } from '../shared/payments'

/** 模拟用户在微信收银台付款成功，随后模拟渠道回调通知业务 */
export const pay = (orderId: string) =>
  userMutate((ctx) => {
    const o = ctx.db.orders.find((x) => x.id === orderId && x.userId === ctx.userId)
    if (!o) fail('FORBIDDEN', '订单不存在或无权操作')
    const attempt = ctx.db.payments.find((p) => p.orderId === o.id && p.status === 'PENDING')
    if (!attempt) fail('STATE_CONFLICT', '没有待支付的支付单')
    return { outcome: handlePaymentNotify(ctx, simulateUserPaid(attempt, ctx.now)) }
  })
