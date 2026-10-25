import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  /** 需要填写原因时提供 */
  reason?: { label: string; placeholder?: string; required?: boolean; options?: string[] }
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((r: { ok: boolean; reason: string }) => void) | null
}

export const confirmState = reactive<ConfirmState>({ open: false, title: '', resolve: null })

export function confirmDialog(opts: ConfirmOptions): Promise<{ ok: boolean; reason: string }> {
  return new Promise((resolve) => {
    Object.assign(confirmState, { message: undefined, confirmText: undefined, cancelText: undefined, destructive: false, reason: undefined }, opts, {
      open: true,
      resolve,
    })
  })
}
