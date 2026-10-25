// 协议内容摘要。演示使用 FNV-1a 64 位（同步、无依赖）；正式环境由服务端使用 SHA-256。
export function contentHash(text: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x0100019d) >>> 0
  }
  return `fnv-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}
