// 业务时区固定为 Asia/Shanghai（UTC+8，无夏令时）；存储使用 UTC 毫秒时间戳。

export const TZ = 'Asia/Shanghai'
export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
const OFFSET = 8 * HOUR

function parts(ts: number) {
  const d = new Date(ts + OFFSET)
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(),
  }
}
const p2 = (n: number) => String(n).padStart(2, '0')

export function formatDateTime(ts: number | null | undefined): string {
  if (ts == null) return '—'
  const p = parts(ts)
  return `${p.y}-${p2(p.m)}-${p2(p.d)} ${p2(p.h)}:${p2(p.mi)}`
}

export function formatShort(ts: number | null | undefined): string {
  if (ts == null) return '—'
  const p = parts(ts)
  return `${p2(p.m)}-${p2(p.d)} ${p2(p.h)}:${p2(p.mi)}`
}

export function formatDate(ts: number | null | undefined): string {
  if (ts == null) return '—'
  const p = parts(ts)
  return `${p.y}-${p2(p.m)}-${p2(p.d)}`
}

export function formatTime(ts: number): string {
  const p = parts(ts)
  return `${p2(p.h)}:${p2(p.mi)}`
}

/** 相对时间，用于列表中的“3 分钟前” */
export function formatRelative(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`
  return formatDate(ts)
}

export function startOfDayShanghai(ts: number): number {
  return Math.floor((ts + OFFSET) / DAY) * DAY - OFFSET
}

/** <input type="datetime-local"> 使用的北京时间字符串 */
export function toLocalInput(ts: number): string {
  const p = parts(ts)
  return `${p.y}-${p2(p.m)}-${p2(p.d)}T${p2(p.h)}:${p2(p.mi)}`
}

export function fromLocalInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - OFFSET
}

export function minutesOfDayShanghai(ts: number): number {
  const p = parts(ts)
  return p.h * 60 + p.mi
}

export function weekdayLabel(ts: number): string {
  return '日一二三四五六'[new Date(ts + OFFSET).getUTCDay()]
}
