// 展示格式：金额以分存储，时间以 UTC 毫秒存储，统一按 Asia/Shanghai（UTC+8）展示

const TZ_OFFSET = 8 * 3600 * 1000
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export const HOUR = 3600 * 1000
export const DAY = 24 * HOUR

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** 把 UTC 时间戳映射为北京时间的各个字段，与设备时区无关 */
export function parts(ts: number) {
  const d = new Date(ts + TZ_OFFSET)
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    min: d.getUTCMinutes(),
    w: d.getUTCDay(),
  }
}

/** 北京时间某日 00:00 对应的 UTC 时间戳 */
export function startOfDay(ts: number): number {
  return Math.floor((ts + TZ_OFFSET) / DAY) * DAY - TZ_OFFSET
}

export function money(fen: number): string {
  const sign = fen < 0 ? '-' : ''
  const abs = Math.abs(fen)
  const yuan = Math.floor(abs / 100)
  const cents = abs % 100
  return `${sign}${yuan.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${pad(cents)}`
}

export function moneyParts(fen: number): { int: string; dec: string } {
  const [int, dec] = money(fen).split('.')
  return { int, dec }
}

export function time(ts: number): string {
  const p = parts(ts)
  return `${pad(p.h)}:${pad(p.min)}`
}

export function date(ts: number): string {
  const p = parts(ts)
  return `${p.m}月${p.d}日`
}

export function weekday(ts: number): string {
  return WEEK[parts(ts).w]
}

/** 相对今天的日期标签：今天 / 明天 / 后天 / 10月28日 */
export function dayLabel(ts: number, now = Date.now()): string {
  const diff = Math.round((startOfDay(ts) - startOfDay(now)) / DAY)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  return date(ts)
}

export function dateTime(ts: number): string {
  return `${date(ts)} ${weekday(ts)} ${time(ts)}`
}

export function fullDateTime(ts: number): string {
  const p = parts(ts)
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}:${pad(p.min)}`
}

/** 消息与列表用的相对时间 */
export function relative(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < 60 * 1000) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / 60000)} 分钟前`
  if (startOfDay(ts) === startOfDay(now)) return time(ts)
  if (startOfDay(now) - startOfDay(ts) === DAY) return `昨天 ${time(ts)}`
  return date(ts)
}

export function range(startAt: number, endAt: number): string {
  return `${date(startAt)} ${time(startAt)} – ${date(endAt)} ${time(endAt)}`
}

export function maskPhone(phone: string): string {
  return phone.length === 11 ? `${phone.slice(0, 3)} **** ${phone.slice(7)}` : phone
}

export function maskName(name: string): string {
  if (name.length <= 1) return name
  return name[0] + '*'.repeat(Math.min(name.length - 1, 2))
}

export function genderLabel(g: string): string {
  return g === 'M' ? '男' : g === 'F' ? '女' : ''
}

/** 展示用电话：400 热线 400-000-0000，手机 138 0000 0001 */
export function phoneLabel(phone: string): string {
  if (/^400\d{7}$/.test(phone)) return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`
  if (/^1\d{10}$/.test(phone)) return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`
  return phone
}
