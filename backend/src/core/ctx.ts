import type { AdminUser, ApiResult, AuditLog, ErrorCode } from '../../../packages/contracts'
import { can, canAccessHospital, type Permission } from '../../../packages/domain/permissions'
import { nextId, type Db } from './db'
import { getStore } from './store'

// 服务端调用上下文：身份由入口层（本地 HTTP / 云函数）解析后注入，业务模块不读取请求头。
// 写操作采用“草稿副本 + 一次提交”，异常时整份丢弃，保证同一请求内的多集合写入要么全部生效要么全部不生效。

export class ServiceError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message)
  }
}

export function fail(code: ErrorCode, message: string): never {
  throw new ServiceError(code, message)
}

export interface Actor {
  id: string
  name: string
}

export interface BaseCtx {
  db: Db
  now: number
  requestId: string
  actor: Actor
  audit(entry: Omit<AuditLog, 'id' | 'actorId' | 'actorName' | 'createdAt'>): void
  id(prefix: string): string
}

/** 管理端上下文 */
export interface Ctx extends BaseCtx {
  admin: AdminUser
  require(perm: Permission): void
  requireHospital(hospitalId: string): void
  canHospital(hospitalId: string): boolean
}

/** 用户端上下文：userId 来自认证上下文，不接受页面自报 */
export interface UserCtx extends BaseCtx {
  userId: string
}

export interface RequestAuth {
  requestId: string
  admin?: AdminUser | null
  userId?: string | null
  /** 演示环境才允许的模拟能力（模拟支付等） */
  demo: boolean
}

let current: RequestAuth | null = null

/** 入口层在调用业务函数前设置；业务函数同步读取，因此不存在请求之间串号 */
export function withAuth<T>(auth: RequestAuth, fn: () => T): T {
  const prev = current
  current = auth
  try {
    return fn()
  } finally {
    current = prev
  }
}

export function currentAuth(): RequestAuth {
  if (!current) fail('AUTH_REQUIRED', '缺少认证上下文')
  return current
}

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T)
}

function base(db: Db, actor: Actor, requestId: string): BaseCtx {
  const now = Date.now()
  return {
    db, now, requestId, actor,
    audit(entry) {
      db.auditLogs.unshift({ id: nextId(db, 'log'), actorId: actor.id, actorName: actor.name, createdAt: now, ...entry })
    },
    id: (prefix) => nextId(db, prefix),
  }
}

function execute<C, T>(write: boolean, makeCtx: (db: Db, auth: RequestAuth) => C, fn: (ctx: C) => T): Promise<ApiResult<T>> {
  let requestId = 'req_unknown'
  try {
    const auth = currentAuth()
    requestId = auth.requestId
    const store = getStore()
    const live = store.read()
    const db = write ? clone(live) : live
    const data = fn(makeCtx(db, auth))
    if (write) store.commit(db)
    return Promise.resolve({ ok: true, data: clone(data), requestId })
  } catch (e) {
    if (e instanceof ServiceError) return Promise.resolve({ ok: false, error: { code: e.code, message: e.message }, requestId })
    console.error(e)
    return Promise.resolve({ ok: false, error: { code: 'NOT_AVAILABLE', message: '服务暂不可用，请稍后重试' }, requestId })
  }
}

function adminCtx(db: Db, auth: RequestAuth): Ctx {
  const admin = auth.admin ? db.admins.find((a) => a.id === auth.admin!.id && a.enabled) : undefined
  if (!admin) fail('AUTH_REQUIRED', '请先登录管理后台')
  return {
    ...base(db, { id: admin.id, name: admin.name }, auth.requestId),
    admin,
    require(perm) {
      if (!can(admin, perm)) fail('FORBIDDEN', '当前角色没有此操作权限')
    },
    requireHospital(hospitalId) {
      if (!canAccessHospital(admin, hospitalId)) fail('FORBIDDEN', '该记录不在你负责的医院范围内')
    },
    canHospital: (hospitalId) => canAccessHospital(admin, hospitalId),
  }
}

function userCtx(db: Db, auth: RequestAuth): UserCtx {
  const user = auth.userId ? db.users.find((u) => u.id === auth.userId) : undefined
  if (!user) fail('AUTH_REQUIRED', '请先登录')
  return { ...base(db, { id: user.id, name: user.nickname }, auth.requestId), userId: user.id }
}

/** 系统任务（如付款超时处理）使用的上下文 */
function systemCtx(db: Db, auth: RequestAuth): BaseCtx {
  return base(db, { id: 'system', name: '系统' }, auth.requestId)
}

export const query = <T>(fn: (ctx: Ctx) => T) => execute(false, adminCtx, fn)
export const mutate = <T>(fn: (ctx: Ctx) => T) => execute(true, adminCtx, fn)
export const userQuery = <T>(fn: (ctx: UserCtx) => T) => execute(false, userCtx, fn)
export const userMutate = <T>(fn: (ctx: UserCtx) => T) => execute(true, userCtx, fn)
export const systemMutate = <T>(fn: (ctx: BaseCtx) => T) => execute(true, systemCtx, fn)

export function findOr404<T extends { id: string }>(list: T[], id: string, label = '记录'): T {
  const item = list.find((x) => x.id === id)
  if (!item) fail('NOT_FOUND', `${label}不存在或已被删除`)
  return item
}

export function requireText(value: string | undefined | null, label: string, max = 200): string {
  const v = (value ?? '').trim()
  if (!v) fail('VALIDATION_FAILED', `请填写${label}`)
  if (v.length > max) fail('VALIDATION_FAILED', `${label}不能超过 ${max} 字`)
  return v
}

export function checkVersion(current: number, expected: number | undefined): void {
  if (expected !== undefined && current !== expected) {
    fail('STATE_CONFLICT', '该记录已被其他人更新，已为你刷新到最新状态，请确认后重试')
  }
}

export function touch<T extends { updatedAt: number }>(item: T, now: number): T {
  item.updatedAt = now
  return item
}
