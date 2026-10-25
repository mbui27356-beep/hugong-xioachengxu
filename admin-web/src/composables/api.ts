import { ref, shallowRef, type Ref } from 'vue'
import type { ApiError, ApiResult } from '@/contracts'
import { ERROR_TITLE } from '@/contracts'
import { toast } from './toast'
import { notifyChanged } from './signal'

/** 加载型资源：loading / error / data 三态 */
export function useResource<T>(loader: () => Promise<ApiResult<T>>, opts: { immediate?: boolean } = {}) {
  const data = shallowRef<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  let seq = 0
  async function reload() {
    const mine = ++seq
    loading.value = true
    error.value = null
    const r = await loader()
    if (mine !== seq) return
    loading.value = false
    if (r.ok) data.value = r.data
    else error.value = r.error
  }
  if (opts.immediate !== false) void reload()
  return { data, loading, error, reload }
}

/** 执行写操作：失败时统一提示，成功时可选提示。返回 data 或 null。 */
export async function callApi<T>(p: Promise<ApiResult<T>>, success?: string): Promise<T | null> {
  const r = await p
  if (r.ok) {
    if (success) toast(success, { tone: 'success' })
    notifyChanged()
    return r.data
  }
  toast(ERROR_TITLE[r.error.code], { tone: r.error.code === 'STATE_CONFLICT' ? 'warning' : 'danger', message: r.error.message })
  return null
}

/** 返回完整结果，供需要区分错误码的场景（如版本冲突后刷新） */
export async function callApiRaw<T>(p: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  const r = await p
  if (r.ok) notifyChanged()
  if (!r.ok) {
    toast(ERROR_TITLE[r.error.code], { tone: r.error.code === 'STATE_CONFLICT' ? 'warning' : 'danger', message: r.error.message })
  }
  return r
}
