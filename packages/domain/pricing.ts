import type { BillingUnit, PriceLine, PriceVersion } from '../contracts'
import { BILLING_UNIT_SHORT } from '../contracts'
import { HOUR } from './time'

// 演示默认：一天 = 连续 24 小时；一个班次 = 12 小时。正式营业规则待确认（开发文档 5.1）。
export const UNIT_HOURS: Record<BillingUnit, number> = {
  DAY_24H: 24,
  SHIFT_12H: 12,
}

export const MAX_UNITS = 30

export interface QuoteInput {
  priceVersion: Pick<PriceVersion, 'unitPriceFen' | 'unit'>
  units: number
  startAt: number
}

export interface Quote {
  lines: PriceLine[]
  totalFen: number
  startAt: number
  /** 结束不包含：[startAt, endAt) */
  endAt: number
}

export function validateUnits(units: number): string | null {
  if (!Number.isInteger(units)) return '数量必须为整数'
  if (units <= 0) return '数量必须大于 0'
  if (units > MAX_UNITS) return `单次最多预约 ${MAX_UNITS} 个计费单位`
  return null
}

export function computeEndAt(startAt: number, units: number, unit: BillingUnit): number {
  return startAt + units * UNIT_HOURS[unit] * HOUR
}

/** 服务端报价：只依据价格版本和数量，客户端不能决定单价或实付金额。 */
export function quote(input: QuoteInput): Quote {
  const err = validateUnits(input.units)
  if (err) throw new Error(err)
  const { unitPriceFen, unit } = input.priceVersion
  if (!Number.isInteger(unitPriceFen) || unitPriceFen <= 0) throw new Error('单价无效')
  const amountFen = unitPriceFen * input.units
  // 节假日加价、夜间费用等规则尚未确认，不启用自动附加费（开发文档 5.1）。
  const lines: PriceLine[] = [
    { label: `陪护服务费（${input.units} ${BILLING_UNIT_SHORT[unit]}）`, unitPriceFen, quantity: input.units, amountFen },
  ]
  return {
    lines,
    totalFen: lines.reduce((s, l) => s + l.amountFen, 0),
    startAt: input.startAt,
    endAt: computeEndAt(input.startAt, input.units, unit),
  }
}

/** 某时刻生效的价格版本：effectiveFrom <= at < effectiveTo */
export function effectiveVersionAt<T extends Pick<PriceVersion, 'effectiveFrom' | 'effectiveTo' | 'version'>>(
  versions: T[],
  at: number,
): T | null {
  const candidates = versions
    .filter((v) => v.effectiveFrom <= at && (v.effectiveTo == null || at < v.effectiveTo))
    .sort((a, b) => b.version - a.version)
  return candidates[0] ?? null
}
