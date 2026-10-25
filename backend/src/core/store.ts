import type { Db } from './db'

/** 仓储接口：业务模块只依赖它，不关心数据存在 JSON 文件还是云数据库 */
export interface Store {
  read(): Db
  /** 原子替换整份数据（演示实现）；云数据库实现应改为事务内的逐集合写入 */
  commit(next: Db): void
  reset(): void
}

let store: Store | null = null

export function setStore(s: Store) {
  store = s
}

export function getStore(): Store {
  if (!store) throw new Error('Store 未初始化')
  return store
}
