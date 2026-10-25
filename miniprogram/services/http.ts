// 传输层：本地演示走 HTTP 到 backend；云开发开通后替换为 wx.cloud.callFunction，页面与 service 不变。

import { API_BASE, DEMO } from '../config'
import { DEMO_USER_HEADER, demoUserId } from './demo'
import type { Result } from '../core/types'

export function request<T>(path: string, args: unknown[] = []): Promise<Result<T>> {
  return new Promise((resolve) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method: 'POST',
      data: { args },
      header: DEMO ? { 'content-type': 'application/json', [DEMO_USER_HEADER]: demoUserId() } : { 'content-type': 'application/json' },
      timeout: 10000,
      success: (res) => {
        const body = res.data as Result<T>
        if (body && typeof body === 'object' && 'ok' in body) resolve(body)
        else resolve({ ok: false, error: { code: 'NETWORK_ERROR', message: `服务返回异常（${res.statusCode}）` }, requestId: '' })
      },
      fail: () => resolve({ ok: false, error: { code: 'NETWORK_ERROR', message: '网络异常，请确认本地后端已启动' }, requestId: '' }),
    })
  })
}

export function app<T>(fn: string, ...args: unknown[]): Promise<Result<T>> {
  return request<T>(`/app/${fn}`, args)
}
