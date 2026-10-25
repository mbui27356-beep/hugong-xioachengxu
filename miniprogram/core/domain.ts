// 业务规则：计价、状态可执行动作、字段校验。页面只消费结果，不在页面里算价或改状态。

import { DAY, HOUR, money } from './format'
import { hasOpenRefund } from './status'
import type { Assessment, Order, PatientInput, QuoteLine, ServicePackage } from './types'
import { ASSESSMENT_ITEMS } from './status'

/** 演示计费：每单位 = 套餐时长（默认 24 小时），开始包含、结束不包含。夜间/节假日加价规则未确认，不启用。 */
export function priceLines(pkg: ServicePackage, unitPriceFen: number, units: number): { lines: QuoteLine[]; totalFen: number } {
  const amount = unitPriceFen * units
  const lines: QuoteLine[] = [
    { label: pkg.name, detail: `¥${money(unitPriceFen)} × ${units} ${pkg.unitLabel}`, amountFen: amount },
  ]
  return { lines, totalFen: lines.reduce((s, l) => s + l.amountFen, 0) }
}

export function endAt(startAt: number, units: number, unitHours: number): number {
  return startAt + units * unitHours * HOUR
}

export function durationLabel(units: number, unitHours: number): string {
  const hours = units * unitHours
  if (hours % 24 === 0) return `${hours / 24} 天`
  return `${hours} 小时`
}

/** 最早可预约时间：当前时间 + 提前量，向上取整到半点 */
export function earliestStart(now: number, leadMinutes: number): number {
  const half = 30 * 60 * 1000
  return Math.ceil((now + leadMinutes * 60 * 1000) / half) * half
}

export function latestStart(now: number, maxAdvanceDays: number): number {
  return now + maxAdvanceDays * DAY
}

export function assessmentComplete(a: Assessment): boolean {
  return ASSESSMENT_ITEMS.every((i) => !!a[i.key])
}

export const PHONE_RE = /^1[3-9]\d{9}$/

export function validatePatient(p: PatientInput): string | null {
  if (!p.name.trim()) return '请填写就诊人姓名'
  if (p.name.trim().length > 20) return '姓名不超过 20 个字'
  if (p.age !== null && (p.age < 0 || p.age > 120 || !Number.isInteger(p.age))) return '请填写正确的年龄'
  if (!p.contactName.trim()) return '请填写联系人姓名'
  if (!PHONE_RE.test(p.contactPhone)) return '请填写 11 位手机号'
  if (!p.contactRelation.trim()) return '请选择联系人与就诊人的关系'
  return null
}

/** 用户端可见的操作，最终是否允许仍以服务端校验为准 */
export function orderActions(o: Order) {
  const openRefund = hasOpenRefund(o)
  const paid = o.paymentStatus === 'PAID' || o.paymentStatus === 'PARTIALLY_REFUNDED'
  return {
    pay: o.businessStatus === 'PENDING_PAYMENT' && o.paymentStatus === 'UNPAID',
    cancel: (o.businessStatus === 'PENDING_CONFIRM' || o.businessStatus === 'PENDING_PAYMENT') && o.paymentStatus === 'UNPAID',
    refund: paid && !openRefund && (o.businessStatus === 'PENDING_SERVICE' || o.businessStatus === 'IN_SERVICE' || o.businessStatus === 'COMPLETED'),
    rebook: o.businessStatus === 'COMPLETED' || o.businessStatus === 'CANCELLED' || o.businessStatus === 'REJECTED',
  }
}
