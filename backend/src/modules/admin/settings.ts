import type { AdminUser, Role, Settings } from '../../../../packages/contracts'
import { ROLE_LABEL } from '../../../../packages/contracts'
import { fail, findOr404, mutate, query, requireText } from '../../core/ctx'

export const getSettings = () =>
  query((ctx) => {
    ctx.require('settings.view')
    return ctx.db.settings
  })

export type SettingsInput = Omit<Settings, 'updatedAt'>

export const saveSettings = (input: SettingsInput) =>
  mutate((ctx) => {
    ctx.require('settings.edit')
    const s = ctx.db.settings
    const providerName = requireText(input.providerName, '服务提供方名称', 60)
    const supportPhone = requireText(input.supportPhone, '客服电话', 20)
    if (!/^[\d-]{7,20}$/.test(supportPhone)) fail('VALIDATION_FAILED', '客服电话格式不正确')
    if (!/^\d{2}:\d{2}$/.test(input.businessStart) || !/^\d{2}:\d{2}$/.test(input.businessEnd)) fail('VALIDATION_FAILED', '营业时间格式应为 HH:MM')
    if (input.businessHoursEnabled && input.businessStart === input.businessEnd) fail('VALIDATION_FAILED', '营业开始与结束时间不能相同')
    if (!Number.isInteger(input.leadTimeMinutes) || input.leadTimeMinutes < 0 || input.leadTimeMinutes > 7 * 24 * 60) fail('VALIDATION_FAILED', '预约提前量应为 0–10080 分钟的整数')
    if (!Number.isInteger(input.paymentDeadlineMinutes) || input.paymentDeadlineMinutes < 5 || input.paymentDeadlineMinutes > 24 * 60) fail('VALIDATION_FAILED', '付款期限应为 5–1440 分钟的整数')
    if (input.pauseOrders && !input.pauseNotice.trim()) fail('VALIDATION_FAILED', '临时停单时请填写对用户的提示')
    const changed = (Object.keys(input) as (keyof SettingsInput)[]).filter((k) => s[k] !== input[k])
    Object.assign(s, { ...input, providerName, supportPhone, updatedAt: ctx.now })
    if (changed.length) {
      ctx.audit({ action: 'settings.update', targetType: '系统设置', targetId: 'settings', summary: `修改 ${changed.length} 项设置：${changed.join('、')}`, reason: null })
    }
    return s
  })

export interface AdminRow extends AdminUser {
  hospitalNames: string[]
}

export const listAdmins = () =>
  query((ctx): AdminRow[] => {
    ctx.require('settings.view')
    return ctx.db.admins.map((a) => ({
      ...a,
      hospitalNames: a.allowedHospitalIds === '*' ? ['全部医院'] : a.allowedHospitalIds.map((id) => ctx.db.hospitals.find((h) => h.id === id)?.name ?? '—'),
    }))
  })

export const listHospitalOptions = () =>
  query((ctx) => {
    ctx.require('catalog.view')
    return ctx.db.hospitals.map((h) => ({ id: h.id, name: h.name, enabled: h.enabled }))
  })

export const saveAdmin = (id: string, input: { roles: Role[]; allowedHospitalIds: string[] | '*'; enabled: boolean; reason: string }) =>
  mutate((ctx) => {
    ctx.require('admin.manage')
    const a = findOr404(ctx.db.admins, id, '管理员')
    if (!input.roles.length) fail('VALIDATION_FAILED', '至少保留一个角色')
    if (input.allowedHospitalIds !== '*' && !input.allowedHospitalIds.length) fail('VALIDATION_FAILED', '请选择至少一家医院或选择全部')
    if (a.id === ctx.actor.id && (!input.enabled || !input.roles.includes('SUPER_ADMIN'))) fail('VALIDATION_FAILED', '不能停用自己或移除自己的超级管理员角色')
    const reason = requireText(input.reason, '变更原因', 200)
    a.roles = [...input.roles]
    a.allowedHospitalIds = input.allowedHospitalIds === '*' ? '*' : [...input.allowedHospitalIds]
    a.enabled = input.enabled
    a.updatedAt = ctx.now
    const scope = a.allowedHospitalIds === '*' ? '全部医院' : a.allowedHospitalIds.map((h) => ctx.db.hospitals.find((x) => x.id === h)?.name).join('、')
    ctx.audit({
      action: 'admin.roles.update', targetType: '管理员', targetId: a.id,
      summary: `${a.name} 角色设为 ${a.roles.map((r) => ROLE_LABEL[r]).join('、')}；范围：${scope}；${a.enabled ? '启用' : '停用'}`, reason,
    })
    return true
  })

export const listAuditLogs = (f: { keyword?: string; action?: string } = {}) =>
  query((ctx) => {
    ctx.require('audit.view')
    const kw = (f.keyword ?? '').trim()
    return ctx.db.auditLogs
      .filter((l) => !f.action || l.action.startsWith(f.action))
      .filter((l) => !kw || l.summary.includes(kw) || l.actorName.includes(kw) || l.targetId.includes(kw) || (l.reason ?? '').includes(kw))
      .slice(0, 200)
  })
