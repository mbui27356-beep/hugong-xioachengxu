import type { PaymentAttempt } from '../../../../packages/contracts'

// ⚠ 模拟支付渠道：仅本地演示使用，不连接微信支付。
// 云开发开通后替换为：统一下单（JSAPI/小程序）→ 返回 wx.requestPayment 所需签名参数；
// 回调入口验签解密后调用 modules/shared/payments.ts 的 handlePaymentNotify；查单接口用于补偿与对账。

export interface PrepayParams {
  /** 正式环境为 timeStamp/nonceStr/package/signType/paySign；演示环境只给出商户订单号 */
  provider: 'MOCK'
  outTradeNo: string
  amountFen: number
}

export function createPrepay(attempt: PaymentAttempt): PrepayParams {
  return { provider: 'MOCK', outTradeNo: attempt.outTradeNo, amountFen: attempt.amountFen }
}

/** 模拟用户在收银台完成付款：渠道侧标记为已支付，随后由“回调”通知业务 */
export function simulateUserPaid(attempt: PaymentAttempt, now: number): { outTradeNo: string; transactionId: string; amountFen: number } {
  attempt.channelState = 'SUCCESS'
  attempt.updatedAt = now
  return { outTradeNo: attempt.outTradeNo, transactionId: `4200000${now.toString().slice(-9)}MOCK`, amountFen: attempt.amountFen }
}

/** 模拟渠道查单 */
export function queryChannel(attempt: PaymentAttempt): 'NOTPAY' | 'SUCCESS' {
  return attempt.channelState
}
