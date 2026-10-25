import { reactive } from 'vue'

export interface ToastItem {
  id: number
  tone: 'neutral' | 'success' | 'danger' | 'warning'
  title: string
  message?: string
}

export const toasts = reactive<ToastItem[]>([])
let seq = 0

export function toast(title: string, opts: { tone?: ToastItem['tone']; message?: string; duration?: number } = {}) {
  const id = ++seq
  toasts.push({ id, tone: opts.tone ?? 'neutral', title, message: opts.message })
  if (toasts.length > 3) toasts.shift()
  window.setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }, opts.duration ?? (opts.tone === 'danger' ? 5200 : 3200))
}
