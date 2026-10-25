import { getStore } from '../../core/store'
import { query } from '../../core/ctx'

// 模拟登录态：演示环境用身份切换代替真实认证（身份由 adapters/mock/identity 解析）。生产入口不得注册本模块。

export const listDemoIdentities = () => query((ctx) => ctx.db.admins.filter((a) => a.enabled))

export const me = () => query((ctx) => ctx.admin)

export const resetDemoData = async () => {
  const r = await query((ctx) => {
    ctx.require('demo.tools')
    return true as const
  })
  if (r.ok) getStore().reset()
  return r
}
