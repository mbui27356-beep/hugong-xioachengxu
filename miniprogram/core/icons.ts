// 线性图标：24×24 视图，圆角描边。生成 base64 SVG 供 background-image 使用，可按需着色。

const PATHS: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  'chevron-right': '<path d="M9 5l7 7-7 7"/>',
  'chevron-left': '<path d="M15 5l-7 7 7 7"/>',
  'chevron-down': '<path d="M5 9l7 7 7-7"/>',
  hospital: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M12 7v6M9 10h6M9.5 21v-3.5h5V21"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  'calendar-fill': '<rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="COLOR"/><path d="M3.5 10h17" stroke="#fff"/><path d="M8 3v4M16 3v4"/>',
  orders: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
  'orders-fill': '<rect x="5" y="3" width="14" height="18" rx="3" fill="COLOR"/><path d="M9 8h6M9 12h6M9 16h3.5" stroke="#fff"/>',
  bell: '<path d="M6 10a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  'bell-fill': '<path d="M6 10a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7z" fill="COLOR"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.6 4.3-5.3 7.5-5.3s6.1 1.7 7.5 5.3"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c1.1-3.2 3.6-4.8 6.5-4.8s5.4 1.6 6.5 4.8"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 15.6c1.6.7 2.8 2.1 3.5 4.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  phone: '<path d="M5 4h3.5l1.8 4.4-2.2 1.4a11 11 0 0 0 6.1 6.1l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.4 20 4 13.6 3.5 5.6A1.5 1.5 0 0 1 5 4z"/>',
  shield: '<path d="M12 3l7 2.8V11c0 4.7-3 8.3-7 10-4-1.7-7-5.3-7-10V5.8z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
  more: '<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12h.1M12 12h.1M15.8 12h.1" stroke-width="2.4"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  alert: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.2M12 17v.1"/>',
  inbox: '<path d="M3.5 13.5L6.5 5h11l3 8.5V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 13.5H8l1.2 2.5h5.6l1.2-2.5h4.5"/>',
  edit: '<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="M13 7l4 4"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  headset: '<path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2"/><rect x="3.5" y="13.5" width="4" height="6.5" rx="1.6"/><rect x="16.5" y="13.5" width="4" height="6.5" rx="1.6"/>',
  bed: '<path d="M3 19V6.5M3 14.5h18V19M21 14.5V12a3 3 0 0 0-3-3h-7.5v5.5"/><circle cx="7" cy="11" r="1.8"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h3.5"/>',
  doc: '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5M9 13h6M9 16.5h4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.5H15"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><path d="M20 10h-4a2 2 0 0 0 0 4h4"/>',
  wechat: '<path d="M9.5 4.5c-3.9 0-7 2.6-7 5.8 0 1.8 1 3.4 2.6 4.5l-.6 2 2.4-1.2c.8.2 1.7.4 2.6.4"/><path d="M15.5 9.5c3.3 0 6 2.2 6 4.9 0 1.5-.8 2.8-2.1 3.7l.5 1.7-2-1c-.8.3-1.6.4-2.4.4-3.3 0-6-2.2-6-4.8s2.7-4.9 6-4.9z"/>',
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(ascii: string): string {
  let out = ''
  for (let i = 0; i < ascii.length; i += 3) {
    const a = ascii.charCodeAt(i)
    const b = i + 1 < ascii.length ? ascii.charCodeAt(i + 1) : NaN
    const c = i + 2 < ascii.length ? ascii.charCodeAt(i + 2) : NaN
    const n = (a << 16) | ((b || 0) << 8) | (c || 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    out += isNaN(b) ? '=' : B64[(n >> 6) & 63]
    out += isNaN(c) ? '=' : B64[n & 63]
  }
  return out
}

const cache: Record<string, string> = {}

export function iconUri(name: string, color: string, stroke = 1.7): string {
  const key = `${name}|${color}|${stroke}`
  if (cache[key]) return cache[key]
  const body = (PATHS[name] || PATHS.info).replace(/COLOR/g, color)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  cache[key] = `data:image/svg+xml;base64,${base64(svg)}`
  return cache[key]
}
