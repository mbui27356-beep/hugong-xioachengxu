import type { AdminUser, Role } from '../contracts'

// 角色与数据范围（开发文档 4.1）。服务层必须调用这里的检查，不能仅隐藏按钮。

export type Permission =
  | 'dashboard.view'
  | 'catalog.view'
  | 'catalog.edit'
  | 'package.edit'
  | 'order.view'
  | 'order.operate'
  | 'order.remark'
  | 'dispatch.view'
  | 'dispatch.assign'
  | 'caregiver.edit'
  | 'payment.view'
  | 'refund.request'
  | 'refund.approve'
  | 'refund.execute'
  | 'patient.view'
  | 'patient.reveal'
  | 'patient.export'
  | 'message.view'
  | 'message.send'
  | 'agreement.view'
  | 'agreement.publish'
  | 'settings.view'
  | 'settings.edit'
  | 'admin.manage'
  | 'audit.view'
  | 'demo.tools'

const ALL: Permission[] = [
  'dashboard.view', 'catalog.view', 'catalog.edit', 'package.edit', 'order.view', 'order.operate', 'order.remark',
  'dispatch.view', 'dispatch.assign', 'caregiver.edit', 'payment.view', 'refund.request', 'refund.approve',
  'refund.execute', 'patient.view', 'patient.reveal', 'patient.export', 'message.view', 'message.send',
  'agreement.view', 'agreement.publish', 'settings.view', 'settings.edit', 'admin.manage', 'audit.view', 'demo.tools',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  OPERATOR: [
    'dashboard.view', 'catalog.view', 'catalog.edit', 'package.edit', 'order.view', 'agreement.view',
    'agreement.publish', 'settings.view', 'message.view',
  ],
  DISPATCHER: [
    'dashboard.view', 'catalog.view', 'order.view', 'order.operate', 'order.remark', 'dispatch.view',
    'dispatch.assign', 'caregiver.edit', 'refund.request', 'patient.view', 'patient.reveal', 'message.view',
    'message.send', 'settings.view',
  ],
  FINANCE: [
    'dashboard.view', 'catalog.view', 'order.view', 'payment.view', 'refund.request', 'refund.approve',
    'refund.execute', 'settings.view',
  ],
  SUPPORT: [
    'dashboard.view', 'catalog.view', 'order.view', 'order.remark', 'patient.view', 'patient.reveal',
    'message.view', 'message.send', 'agreement.view', 'settings.view',
  ],
}

export function permissionsOf(admin: Pick<AdminUser, 'roles' | 'enabled'>): Set<Permission> {
  const set = new Set<Permission>()
  if (!admin.enabled) return set
  for (const r of admin.roles) for (const p of ROLE_PERMISSIONS[r]) set.add(p)
  return set
}

export function can(admin: Pick<AdminUser, 'roles' | 'enabled'> | null, perm: Permission): boolean {
  if (!admin) return false
  return permissionsOf(admin).has(perm)
}

export function canAccessHospital(admin: Pick<AdminUser, 'allowedHospitalIds'> | null, hospitalId: string): boolean {
  if (!admin) return false
  return admin.allowedHospitalIds === '*' || admin.allowedHospitalIds.includes(hospitalId)
}

export const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  { label: '目录与套餐', perms: ['catalog.edit', 'package.edit'] },
  { label: '订单与调度', perms: ['order.operate', 'dispatch.assign', 'caregiver.edit'] },
  { label: '资金', perms: ['payment.view', 'refund.approve', 'refund.execute'] },
  { label: '敏感资料', perms: ['patient.view', 'patient.reveal', 'patient.export'] },
  { label: '通知与协议', perms: ['message.send', 'agreement.publish'] },
  { label: '系统', perms: ['settings.edit', 'admin.manage', 'audit.view'] },
]
