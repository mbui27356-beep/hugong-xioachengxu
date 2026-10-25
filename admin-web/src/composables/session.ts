import { computed, reactive } from 'vue'
import type { AdminUser } from '@/contracts'
import { can as canDo, type Permission } from '@/domain/permissions'
import { getCurrentAdmin, listDemoIdentities, switchIdentity } from '@/services/session'

// 前端会话状态：只用于决定显示哪些入口。真正的权限检查在 service 层。

export const session = reactive<{ admin: AdminUser | null; identities: AdminUser[]; epoch: number; ready: boolean; backendError: string }>({
  admin: null,
  backendError: '',
  identities: [],
  epoch: 0,
  ready: false,
})

export async function loadSession() {
  const [admin, identities] = await Promise.all([getCurrentAdmin(), listDemoIdentities()])
  session.admin = admin.ok ? admin.data : null
  session.identities = identities.ok ? identities.data : []
  session.backendError = admin.ok ? '' : admin.error.message
  session.ready = true
}

export async function switchTo(adminId: string) {
  await switchIdentity(adminId)
  await loadSession()
  session.epoch += 1
}

export function can(perm: Permission): boolean {
  return canDo(session.admin, perm)
}

export const useCan = (perm: Permission) => computed(() => can(perm))
