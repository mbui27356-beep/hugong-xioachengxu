import type { ApiResult } from '@/contracts'
import { DEMO_ADMIN_HEADER, getDemoAdminId } from './demoIdentity'

// 管理端到本地演示后端的唯一出口。开发时由 Vite 代理 /api 到 http://127.0.0.1:3100。
// 云开发开通后：把 BASE 换成 HTTPS/CloudBase 接口地址，并用真实登录令牌替换演示身份头。

const BASE = import.meta.env.VITE_API_BASE ?? '/api/admin'

let failNext = false
/** 演示工具：让下一次请求模拟网络失败 */
export function failNextRequest() {
  failNext = true
}

export async function call<T>(module: string, fn: string, args: unknown[]): Promise<ApiResult<T>> {
  if (failNext) {
    failNext = false
    return { ok: false, error: { code: 'NETWORK_ERROR', message: '模拟网络异常，请重试' }, requestId: 'client' }
  }
  try {
    const res = await fetch(`${BASE}/${module}/${fn}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [DEMO_ADMIN_HEADER]: getDemoAdminId() },
      body: JSON.stringify({ args }),
    })
    return (await res.json()) as ApiResult<T>
  } catch {
    return { ok: false, error: { code: 'NETWORK_ERROR', message: '无法连接本地后端，请确认已运行 npm --prefix backend run dev' }, requestId: 'client' }
  }
}

type Remote = (...args: never[]) => Promise<unknown>

/** 以后端函数签名生成同名客户端函数 */
export function rpc<F extends Remote>(module: string, fn: string) {
  return ((...args: Parameters<F>) => call(module, fn, args)) as (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>>
}
