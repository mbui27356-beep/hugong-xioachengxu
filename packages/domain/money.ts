// 金额一律以整数分存储与计算，只在展示时转为元。

export function formatFen(fen: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isInteger(fen)) throw new Error('金额必须为整数分')
  const negative = fen < 0
  const abs = Math.abs(fen)
  const yuan = Math.floor(abs / 100)
  const cents = String(abs % 100).padStart(2, '0')
  const grouped = String(yuan).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const prefix = negative ? '-' : opts.sign && fen > 0 ? '+' : ''
  return `${prefix}¥${grouped}.${cents}`
}

/** 把用户输入的元（如 "268" "268.5" "268.50"）解析为整数分；不使用浮点运算。 */
export function parseYuanToFen(input: string): number | null {
  const s = input.trim().replace(/^¥/, '').replace(/,/g, '')
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(s)) return null
  const [intPart, decPart = ''] = s.split('.')
  return Number(intPart) * 100 + Number(decPart.padEnd(2, '0'))
}

export function fenToYuanInput(fen: number): string {
  return `${Math.floor(fen / 100)}.${String(fen % 100).padStart(2, '0')}`
}

export function sumFen(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}
