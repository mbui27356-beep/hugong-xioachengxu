// 支付流程：服务端下单 → 调起收银台 → 以服务端查单结果为准。
// 收银台在演示模式下为模拟弹窗；正式版只需替换 openCashier 为 wx.requestPayment。

import { DEMO } from '../config'
import { money } from '../core/format'
import { mockCashier, mockPay } from './demo'
import { payments } from './index'
import type { PrepayResult } from '../core/types'

export type PayOutcome = { status: 'PAID' } | { status: 'CANCELLED' } | { status: 'PENDING' } | { status: 'ERROR'; message: string }

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function openCashier(orderId: string, prep: PrepayResult): Promise<{ confirmed: boolean; error?: string }> {
  if (!DEMO) {
    // 正式版：wx.requestPayment({ timeStamp, nonceStr, package, signType, paySign })
    return { confirmed: false, error: '尚未接入微信支付' }
  }
  if (!(await mockCashier(money(prep.amountFen)))) return { confirmed: false }
  const r = await mockPay(orderId)
  return r.ok ? { confirmed: true } : { confirmed: false, error: r.error.message }
}

export async function payOrder(orderId: string): Promise<PayOutcome> {
  const prep = await payments.prepare(orderId)
  if (!prep.ok) return { status: 'ERROR', message: prep.error.message }
  const cashier = await openCashier(orderId, prep.data)
  if (cashier.error) return { status: 'ERROR', message: cashier.error }
  if (!cashier.confirmed) return { status: 'CANCELLED' }
  // 收银台返回成功只表示“正在确认”
  for (let i = 0; i < 4; i++) {
    const q = await payments.query(orderId)
    if (q.ok && q.data.paymentStatus === 'PAID') return { status: 'PAID' }
    await wait(700)
  }
  return { status: 'PENDING' }
}
