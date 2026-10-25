// 把用户端 DTO 复制进小程序目录（小程序编译只认 miniprogram/ 内的文件）
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const src = path.join(root, 'packages/contracts/customer.ts')
const dst = path.join(root, 'miniprogram/core/types.ts')
const banner = '// ⚠ 自动生成：源文件 packages/contracts/customer.ts，修改后运行 npm --prefix backend run sync:contracts\n'
fs.writeFileSync(dst, banner + fs.readFileSync(src, 'utf8'))
console.log(`synced ${path.relative(root, src)} → ${path.relative(root, dst)}`)
