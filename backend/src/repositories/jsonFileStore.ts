import fs from 'node:fs'
import path from 'node:path'
import { SCHEMA, type Db } from '../core/db'
import type { Store } from '../core/store'
import { buildSeed } from './seed'

// 本地演示仓储：整份数据保存在一个 JSON 文件中，写入采用“临时文件 + 重命名”避免写坏。
// 只用于本地联调，不承担并发与容量要求；云开发开通后替换为 CloudBase 仓储。

export function createJsonFileStore(file: string): Store {
  let cache: Db | null = null

  function write(db: Db) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(db))
    fs.renameSync(tmp, file)
  }

  function load(): Db {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Db
      if (parsed.schema === SCHEMA) return parsed
      console.warn(`[store] 数据版本 ${parsed.schema} 与当前 ${SCHEMA} 不一致，重新生成演示数据`)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('[store] 数据文件无法读取，重新生成演示数据', e)
    }
    const seeded = buildSeed(Date.now())
    write(seeded)
    return seeded
  }

  return {
    read() {
      if (!cache) cache = load()
      return cache
    },
    commit(next) {
      write(next)
      cache = next
    },
    reset() {
      const seeded = buildSeed(Date.now())
      write(seeded)
      cache = seeded
    },
  }
}
