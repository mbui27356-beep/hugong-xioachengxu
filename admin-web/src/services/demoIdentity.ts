// ⚠ 模拟管理员身份：演示环境用身份切换代替登录，只把管理员编号放进请求头。
// 生产构建必须替换为真实认证（登录 + 服务端会话/令牌），不得包含本文件。

export const DEMO_ADMIN_HEADER = 'x-demo-admin'
const KEY = 'hugong-admin-session'

export function getDemoAdminId(): string {
  return localStorage.getItem(KEY) || 'adm_super'
}

export function setDemoAdminId(id: string) {
  localStorage.setItem(KEY, id)
}
