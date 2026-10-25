import type { AdminUser } from '../../../../packages/contracts'
import type { Db } from '../../core/db'

// ⚠ 模拟身份：仅本地演示使用。用请求头指定“当前是谁”，没有任何真实认证。
// 云开发开通后：小程序身份改由云调用上下文（OPENID）提供；后台改为独立管理员登录（会话/令牌校验）。
// 生产入口不得引用本文件。

export const DEMO_ADMIN_HEADER = 'x-demo-admin'
export const DEMO_USER_HEADER = 'x-demo-user'
export const DEFAULT_ADMIN_ID = 'adm_super'
export const DEFAULT_USER_ID = 'user_1'

/** 小程序可切换的演示账号（用于验证数据隔离） */
export const DEMO_USER_IDS = ['user_1', 'user_2']

export function resolveDemoAdmin(db: Db, headerValue: string | undefined): AdminUser | null {
  const id = headerValue || DEFAULT_ADMIN_ID
  return db.admins.find((a) => a.id === id && a.enabled) ?? null
}

export function resolveDemoUser(db: Db, headerValue: string | undefined): string | null {
  const id = headerValue || DEFAULT_USER_ID
  return db.users.some((u) => u.id === id) ? id : null
}
