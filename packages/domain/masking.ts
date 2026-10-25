// 敏感资料默认脱敏展示

export function maskName(name: string): string {
  if (!name) return ''
  const chars = Array.from(name)
  if (chars.length === 1) return chars[0]
  if (chars.length === 2) return `${chars[0]}*`
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`
}

export function maskPhone(phone: string): string {
  if (!phone) return ''
  if (phone.includes('*')) return phone
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}
