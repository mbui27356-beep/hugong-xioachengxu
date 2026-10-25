// ⚠ 演示专用：模拟登录身份与模拟支付的唯一入口，正式版删除本文件并改用真实能力。
// - 身份：正式版由云调用上下文提供 OPENID，前端不传任何用户编号。
// - 支付：正式版调用 wx.requestPayment，结果以服务端回调/查单为准。

import { DEMO } from '../config'
import type { DemoUser, Result } from '../core/types'
import { request } from './http'

export const DEMO_USER_HEADER = 'x-demo-user'
const KEY = 'demo_user_id'

export function demoUserId(): string {
  return (wx.getStorageSync(KEY) as string) || 'user_1'
}

export function setDemoUser(id: string) {
  if (!DEMO) return
  wx.setStorageSync(KEY, id)
}

export type { DemoUser, Result }

/** ⚠ 演示收银台：代替 wx.requestPayment，用户确认即视为在微信内付款成功 */
export function mockCashier(amountLabel: string): Promise<boolean> {
  return new Promise((resolve) =>
    wx.showModal({
      title: `演示支付 ¥${amountLabel}`,
      content: '正式版将调起微信支付。演示环境不会产生真实扣款。',
      confirmText: '确认支付',
      cancelText: '取消',
      success: (r) => resolve(r.confirm),
      fail: () => resolve(false),
    }),
  )
}

/** ⚠ 演示：模拟收银台付款成功（后端仅在演示模式注册 /api/demo/pay） */
export function mockPay(orderId: string): Promise<Result<{ outcome: string }>> {
  return request<{ outcome: string }>('/demo/pay', [orderId])
}
