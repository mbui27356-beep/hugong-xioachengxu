// 本地 Node.js 演示后端：小程序与管理后台共用的唯一数据源。
// 只用于开发联调；云开发开通后改用 entrypoints/cloud（云函数），业务模块不变。

import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withAuth, systemMutate } from '../../core/ctx'
import { setStore, getStore } from '../../core/store'
import { createJsonFileStore } from '../../repositories/jsonFileStore'
import { DEMO_ADMIN_HEADER, DEMO_USER_HEADER, DEMO_USER_IDS, resolveDemoAdmin, resolveDemoUser } from '../../adapters/mock/identity'
import { expireOverduePayments } from '../../modules/shared/payments'
import * as agreements from '../../modules/admin/agreements'
import * as catalog from '../../modules/admin/catalog'
import * as dashboard from '../../modules/admin/dashboard'
import * as dispatch from '../../modules/admin/dispatch'
import * as messages from '../../modules/admin/messages'
import * as orders from '../../modules/admin/orders'
import * as packages from '../../modules/admin/packages'
import * as patients from '../../modules/admin/patients'
import * as payments from '../../modules/admin/payments'
import * as session from '../../modules/admin/session'
import * as settings from '../../modules/admin/settings'
import * as customer from '../../modules/customer/api'
import * as demo from '../../modules/demo'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3100)
const HOST = process.env.HOST || '0.0.0.0'
const DATA_FILE = process.env.DATA_FILE || path.resolve(here, '../../../data/db.json')
/** 演示模式：开放模拟身份、模拟支付与演示工具。生产环境禁止开启 */
const DEMO = process.env.DEMO_MODE !== 'off'
if (DEMO && process.env.NODE_ENV === 'production') {
  console.error('[backend] 生产环境不得开启演示模式（DEMO_MODE），已退出')
  process.exit(1)
}

setStore(createJsonFileStore(DATA_FILE))

type Fn = (...args: unknown[]) => Promise<unknown>

/** 只暴露接口函数；模块内的内部工具不可远程调用 */
const INTERNAL = new Set(['toOrderRow', 'assertCaregiverFits'])

function table(mod: Record<string, unknown>): Record<string, Fn> {
  const out: Record<string, Fn> = {}
  for (const [k, v] of Object.entries(mod)) if (typeof v === 'function' && !INTERNAL.has(k)) out[k] = v as Fn
  return out
}

const ADMIN: Record<string, Record<string, Fn>> = {
  agreements: table(agreements), catalog: table(catalog), dashboard: table(dashboard), dispatch: table(dispatch),
  messages: table(messages), orders: table(orders), packages: table(packages), patients: table(patients),
  payments: table(payments), settings: table(settings),
  // 演示身份切换与重置数据：仅演示模式
  ...(DEMO ? { session: table(session) } : {}),
}
const APP = table(customer)
const DEMO_API = DEMO ? table(demo) : {}

let seq = 0
const rid = () => `req_${Date.now().toString(36)}${(++seq).toString(36)}`

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': `content-type, ${DEMO_ADMIN_HEADER}, ${DEMO_USER_HEADER}`,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  })
  res.end(JSON.stringify(body))
}

function readBody(req: http.IncomingMessage): Promise<{ args?: unknown[] }> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1_000_000) reject(new Error('payload too large'))
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

/** 付款超时处理：有到期订单时才写入 */
async function sweep() {
  const db = getStore().read()
  const now = Date.now()
  const due = db.orders.some((o) => o.businessStatus === 'PENDING_PAYMENT' && o.paymentStatus === 'UNPAID' && o.paymentDeadlineAt && o.paymentDeadlineAt < now)
  if (due) await withAuth({ requestId: rid(), demo: true }, () => systemMutate(expireOverduePayments))
}

const server = http.createServer(async (req, res) => {
  const started = Date.now()
  const url = new URL(req.url || '/', 'http://local')
  const parts = url.pathname.split('/').filter(Boolean)
  try {
    if (req.method === 'OPTIONS') return send(res, 204, null)
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, dataFile: DATA_FILE })
    if (req.method !== 'POST' || parts[0] !== 'api') return send(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: '接口不存在' } })

    await sweep()
    const body = await readBody(req)
    const args = Array.isArray(body.args) ? body.args : []
    const requestId = rid()
    const db = getStore().read()
    let fn: Fn | undefined
    let auth
    if (parts[1] === 'admin' && parts.length === 4) {
      fn = ADMIN[parts[2]]?.[parts[3]]
      auth = { requestId, demo: true, admin: resolveDemoAdmin(db, req.headers[DEMO_ADMIN_HEADER] as string | undefined) }
    } else if (parts[1] === 'app' && parts.length === 3) {
      fn = APP[parts[2]]
      auth = { requestId, demo: true, userId: resolveDemoUser(db, req.headers[DEMO_USER_HEADER] as string | undefined) }
    } else if (DEMO && parts[1] === 'demo' && parts[2] === 'users') {
      return send(res, 200, { ok: true, data: db.users.filter((u) => DEMO_USER_IDS.includes(u.id)).map((u) => ({ id: u.id, nickname: u.nickname })), requestId })
    } else if (parts[1] === 'demo' && parts.length === 3) {
      fn = DEMO_API[parts[2]]
      auth = { requestId, demo: true, userId: resolveDemoUser(db, req.headers[DEMO_USER_HEADER] as string | undefined) }
    }
    if (!fn || !auth) return send(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: '接口不存在' }, requestId })
    const result = await withAuth(auth, () => fn!(...args))
    send(res, 200, result)
  } catch (e) {
    console.error(e)
    send(res, 400, { ok: false, error: { code: 'VALIDATION_FAILED', message: '请求格式错误' } })
  } finally {
    if (process.env.LOG !== '0') console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[backend] 本地后端已启动 http://127.0.0.1:${PORT}  演示模式 ${DEMO ? '开' : '关'}  数据文件 ${DATA_FILE}`)
})
setInterval(() => void sweep(), 15_000).unref()
