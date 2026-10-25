// 联动验收脚本：启动一个独立的本地后端（临时数据文件），用小程序与管理后台实际调用的同一组 HTTP 接口
// 走完开发文档的核心闭环与关键异常，并验证重启后数据保留。运行：npm --prefix backend run test:e2e

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = 3199
const BASE = `http://127.0.0.1:${PORT}`
const DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hugong-e2e-')), 'db.json')

type R<T = any> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

let server: ChildProcess | null = null
const results: { group: string; name: string; pass: boolean; detail: string }[] = []
let group = ''

async function start(extraEnv: Record<string, string> = {}) {
  server = spawn(process.execPath, ['--import', 'tsx', path.join(here, '../src/entrypoints/local/server.ts')], {
    env: { ...process.env, PORT: String(PORT), DATA_FILE, LOG: '0', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stderr?.on('data', (d) => process.stderr.write(d))
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`)
      if (r.ok) return
    } catch {
      /* 等待启动 */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('后端未能启动')
}

async function stop() {
  if (!server) return
  const s = server
  server = null
  await new Promise<void>((resolve) => {
    s.once('exit', () => resolve())
    s.kill('SIGTERM')
  })
}

async function post<T>(p: string, args: unknown[], headers: Record<string, string>): Promise<R<T>> {
  const res = await fetch(`${BASE}${p}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ args }) })
  return (await res.json()) as R<T>
}

const admin = <T = any>(mod: string, fn: string, ...args: unknown[]) => post<T>(`/api/admin/${mod}/${fn}`, args, { 'x-demo-admin': 'adm_super' })
const adminAs = <T = any>(who: string, mod: string, fn: string, ...args: unknown[]) => post<T>(`/api/admin/${mod}/${fn}`, args, { 'x-demo-admin': who })
const app = <T = any>(fn: string, ...args: unknown[]) => post<T>(`/api/app/${fn}`, args, { 'x-demo-user': 'user_1' })
const appAs = <T = any>(user: string, fn: string, ...args: unknown[]) => post<T>(`/api/app/${fn}`, args, { 'x-demo-user': user })
/** 演示接口：模拟收银台付款（仅演示模式注册） */
const demoPay = <T = any>(orderId: string) => post<T>('/api/demo/pay', [orderId], { 'x-demo-user': 'user_1' })

function check(name: string, pass: boolean, detail = '') {
  results.push({ group, name, pass, detail })
  console.log(`${pass ? '  ✓' : '  ✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

function must<T>(r: R<T>, what: string): T {
  if (!r.ok) throw new Error(`${what} 失败：${r.error.code} ${r.error.message}`)
  return r.data
}

function section(name: string) {
  group = name
  console.log(`\n${name}`)
}

const ALL_CAN = { walk: 'CAN', turn: 'NEED_HELP', express: 'CAN', eat: 'CAN', toilet: 'NEED_HELP' }

async function main() {
  await start()
  const now = Date.now()
  const startAt = Math.ceil((now + 3 * 3600_000) / 1800_000) * 1800_000

  // ───────────── 1. 后台维护目录，小程序可见 ─────────────
  section('1. 后台新增/编辑/停用目录 → 小程序重新加载可见')
  const city = must(await admin('catalog', 'saveCity', { name: '联调市', code: '420600' }), '新增城市')
  must(await admin('catalog', 'saveCity', { id: city.id, name: '联调测试市', code: '420600' }), '编辑城市')
  let f = must(await app('filters'), '小程序城市筛选')
  check('新增并编辑城市后，小程序城市筛选显示新名称', f.cities.some((c: any) => c.id === city.id && c.name === '联调测试市'))
  must(await admin('catalog', 'toggleCity', city.id, false), '停用城市')
  f = must(await app('filters'), '小程序城市筛选')
  check('停用城市后，小程序筛选不再显示', !f.cities.some((c: any) => c.id === city.id))
  must(await admin('catalog', 'toggleCity', city.id, true), '启用城市')
  const district = must(await admin('catalog', 'saveDistrict', { cityId: city.id, name: '联调区', code: '420602' }), '新增区县')

  const hosp = must(await admin('catalog', 'saveHospital', { name: '联调测试医院', cityId: city.id, districtId: district.id, gradeId: 'grade_3a', displayAddress: '联调测试市联调区（演示）', phone: '0717-0000-9999' }), '新增医院')
  let hs = must(await app('listHospitals', { keyword: '联调测试医院', cityId: '', gradeId: '', cursor: null }), '小程序医院列表')
  check('新医院未添加院区、未启用时，小程序不可见', hs.items.length === 0)
  const campus = must(await admin('catalog', 'saveCampus', { hospitalId: hosp.id, name: '联调院区', address: '联调路 1 号（演示）', phone: '0717-0000-9998' }), '新增院区')
  must(await admin('catalog', 'toggleHospital', hosp.id, true), '启用医院')
  hs = must(await app('listHospitals', { keyword: '联调测试医院', cityId: city.id, gradeId: 'grade_3a', cursor: null }), '小程序医院列表')
  check('启用后，小程序按城市+等级筛选可见新医院', hs.items.length === 1 && hs.items[0].district === '联调区', hs.items[0]?.name)

  const dept = must(await admin('catalog', 'saveDepartment', { campusId: campus.id, name: '联调科室' }), '新增科室')
  must(await admin('catalog', 'saveDepartment', { id: dept.id, campusId: campus.id, name: '联调内科' }), '编辑科室')
  const ward = must(await admin('catalog', 'saveWard', { campusId: campus.id, departmentId: dept.id, name: '联调一病区' }), '新增病区')
  let tree = must(await app('getHospitalTree', hosp.id), '小程序院区科室树')
  const tDept = tree.campuses[0]?.departments.find((d: any) => d.id === dept.id)
  check('小程序看到新院区、编辑后的科室名与病区', tree.campuses[0]?.name === '联调院区' && tDept?.name === '联调内科' && tDept?.wards[0]?.name === '联调一病区')
  must(await admin('catalog', 'toggleWard', ward.id, false), '停用病区')
  tree = must(await app('getHospitalTree', hosp.id), '小程序院区科室树')
  check('停用病区后，小程序不再显示该病区', tree.campuses[0].departments.find((d: any) => d.id === dept.id)?.wards.length === 0)
  must(await admin('catalog', 'toggleWard', ward.id, true), '启用病区')
  const crossDept = await admin('catalog', 'saveWard', { campusId: 'camp_ds', departmentId: dept.id, name: '错误病区' })
  check('后台阻止跨院区挂病区', !crossDept.ok && crossDept.error.code === 'VALIDATION_FAILED', !crossDept.ok ? crossDept.error.message : '')

  const pkg = must(await admin('packages', 'savePackage', {
    name: '联调一对一陪护', type: 'ONE_TO_ONE', unit: 'DAY_24H', content: '协助进食饮水；翻身换位；陪同检查', exclusions: '注射换药等医疗操作',
    conditions: '联调测试用', limits: '1–30 天', consultPhone: '400-000-0000', campusIds: [campus.id], initialPrice: '200.00',
  }), '新增套餐')
  const loc = { hospitalId: hosp.id, campusId: campus.id, departmentId: dept.id, wardId: ward.id }
  let offs = must(await app('listOfferings', loc), '小程序套餐列表')
  check('新套餐默认下架，小程序不可见', !offs.some((o: any) => o.packageId === pkg.id))
  must(await admin('packages', 'setShelf', pkg.id, 'ON_SHELF'), '上架套餐')
  offs = must(await app('listOfferings', loc), '小程序套餐列表')
  const offering = offs.find((o: any) => o.packageId === pkg.id)
  check('上架后小程序可见，价格 ¥200.00/天', offering?.unitPriceFen === 20000 && offering?.pkg.content.length === 3)

  // ───────────── 2. 小程序提交预约，后台看到同一笔订单 ─────────────
  section('2. 小程序提交预约 → 后台看到同一笔订单及资料')
  const patient = must(await app('savePatient', null, { name: '联调患者', gender: 'F', age: 76, contactName: '联调家属', contactPhone: '13800009999', contactRelation: '子女', isDefault: false }), '新增就诊人')
  const ags = must(await app('getAgreements', ['SERVICE', 'PRIVACY', 'REFUND']), '协议')
  const consents = ags.map((a: any) => ({ agreementId: a.id, type: a.type, version: a.version }))
  const q1 = must(await app('quote', { offeringId: offering.id, location: loc, startAt, units: 2, assessment: ALL_CAN, unitPriceFen: 1 }), '报价')
  check('报价由服务端计算，忽略客户端附带的单价', q1.totalFen === 40000, `合计 ${q1.totalFen / 100} 元`)
  const noProxy = await app('createOrder', { quoteId: q1.id, patientId: patient.id, bed: { room: '1201', bedNo: '3', unsure: false }, consents, proxyConsent: false, requestId: 'e2e-noproxy' })
  check('家属代约未确认就诊人同意时拒绝提交', !noProxy.ok && noProxy.error.code === 'VALIDATION_FAILED')
  const noConsent = await app('createOrder', { quoteId: q1.id, patientId: patient.id, bed: { room: '1201', bedNo: '3', unsure: false }, consents: consents.slice(0, 1), proxyConsent: true, requestId: 'e2e-noconsent' })
  check('未确认全部协议时拒绝提交', !noConsent.ok && noConsent.error.code === 'AGREEMENT_CHANGED')

  const before = must(await app('listOrders', { tab: 'ALL', patientId: '' }), '订单列表').length
  const input = { quoteId: q1.id, patientId: patient.id, bed: { room: '1201', bedNo: '3', unsure: false }, consents, proxyConsent: true, requestId: 'e2e-req-1' }
  const [c1, c2, c3] = await Promise.all([app('createOrder', input), app('createOrder', input), app('createOrder', input)])
  const order = must(c1, '提交预约')
  const after = must(await app('listOrders', { tab: 'ALL', patientId: '' }), '订单列表').length
  check('同一请求号并发提交 3 次只创建 1 笔订单', c2.ok && c3.ok && c2.data.id === order.id && c3.data.id === order.id && after === before + 1, order.orderNo)
  check('小程序订单状态为待确认', order.businessStatus === 'PENDING_CONFIRM')

  const list = must(await admin('orders', 'listOrders', { keyword: order.orderNo }), '后台订单列表')
  const detail0 = must(await admin('orders', 'getOrderDetail', order.id), '后台订单详情')
  check('后台按订单号查到同一笔订单', list.items.length === 1 && list.items[0].id === order.id)
  check('后台详情含地点、套餐与价格快照、评估与床位', detail0.order.locationSnapshot.hospitalName === '联调测试医院' && detail0.order.locationSnapshot.wardName === '联调一病区'
    && detail0.order.packageSnapshot.unitPriceFen === 20000 && detail0.order.locationSnapshot.room === '1201' && detail0.order.assessmentSnapshot.turn === 'NEED_HELP')
  check('后台默认脱敏显示就诊人与电话', detail0.order.patientSnapshot.name !== '联调患者' && detail0.order.patientSnapshot.name.includes('*') && detail0.order.contactSnapshot.phone.includes('****'), `${detail0.order.patientSnapshot.name} / ${detail0.order.contactSnapshot.phone}`)
  check('后台记录代填关系与协议版本', detail0.order.needsNote.includes('子女') && detail0.order.agreementVersions.length === 3)

  // ───────────── 3. 后台确认 → 小程序待支付 ─────────────
  section('3. 后台确认预约 → 小程序变为待支付')
  const early = await app('preparePayment', order.id)
  check('待确认时不能发起支付', !early.ok && early.error.code === 'STATE_CONFLICT')
  const stale = await admin('orders', 'performOrderAction', order.id, 'confirm', { version: order.version - 1, capacityConfirmed: true })
  check('使用过期版本号确认被拒绝（防并发）', !stale.ok && stale.error.code === 'STATE_CONFLICT')
  must(await admin('orders', 'performOrderAction', order.id, 'confirm', { version: detail0.order.version, capacityConfirmed: true, reason: '已电话核实' }), '后台确认')
  let mo = must(await app('getOrder', order.id), '小程序订单')
  check('小程序订单变为待支付并显示付款截止时间', mo.businessStatus === 'PENDING_PAYMENT' && !!mo.paymentDeadline)
  let msgs = must(await app('listMessages'), '小程序消息')
  check('小程序收到“预约已确认”通知', msgs.some((m: any) => m.orderId === order.id && m.title.includes('已确认')))

  // ───────────── 4. 小程序模拟支付 → 两端待服务 ─────────────
  section('4. 小程序模拟支付 → 后台与小程序均为待服务')
  must(await app('preparePayment', order.id), '下单支付')
  const paid = must(await demoPay(order.id), '模拟支付')
  check('模拟渠道回调已入账', paid.outcome === 'PAID')
  const again = await demoPay(order.id)
  check('重复支付被拒绝，不重复入账', !again.ok)
  mo = must(await app('getOrder', order.id), '小程序订单')
  const d1 = must(await admin('orders', 'getOrderDetail', order.id), '后台订单详情')
  check('小程序：待服务 · 已支付', mo.businessStatus === 'PENDING_SERVICE' && mo.paymentStatus === 'PAID')
  check('后台：待服务 · 已支付，支付流水 1 笔', d1.order.businessStatus === 'PENDING_SERVICE' && d1.order.paymentStatus === 'PAID' && d1.payments.filter((p: any) => p.status === 'SUCCESS').length === 1)

  // ───────────── 5. 派单、开始、完成 ─────────────
  section('5. 后台安排护工、开始服务、完成服务 → 小程序显示进度')
  must(await admin('dispatch', 'saveCaregiver', { name: '联调护工', phone: '13900009999', gender: '女', campusIds: [campus.id], mode: 'ONE_TO_ONE', capacity: 1, shifts: ['全天'], note: '联调' }), '新增护工')
  const cg = must(await admin('dispatch', 'listCaregivers'), '护工列表').find((c: any) => c.name === '联调护工')
  const startNoAsg = await admin('orders', 'performOrderAction', order.id, 'start', { version: d1.order.version })
  check('未派单时不能开始服务', !startNoAsg.ok)
  const cands = must(await admin('dispatch', 'listCandidates', order.id), '候选护工')
  check('候选列表包含新护工且可安排', cands.some((c: any) => c.id === cg.id && c.eligible && !c.blocked))
  must(await admin('dispatch', 'assignCaregiver', order.id, cg.id, { version: d1.order.version }), '派单')
  mo = must(await app('getOrder', order.id), '小程序订单')
  check('小程序显示已安排的护工', mo.caregiver?.name === '联调护工')
  let d = must(await admin('orders', 'getOrderDetail', order.id), '后台详情')
  must(await admin('orders', 'performOrderAction', order.id, 'start', { version: d.order.version, reason: '护工已到岗' }), '开始服务')
  mo = must(await app('getOrder', order.id), '小程序订单')
  check('小程序显示服务中', mo.businessStatus === 'IN_SERVICE')
  d = must(await admin('orders', 'getOrderDetail', order.id), '后台详情')
  const noProof = await admin('orders', 'performOrderAction', order.id, 'complete', { version: d.order.version })
  check('结束服务必须填写完成凭据', !noProof.ok && noProof.error.code === 'VALIDATION_FAILED')
  must(await admin('orders', 'performOrderAction', order.id, 'complete', { version: d.order.version, reason: '家属电话确认，交接记录已归档' }), '结束服务')
  mo = must(await app('getOrder', order.id), '小程序订单')
  check('小程序显示已完成且保留护工，时间线含派单/开始/结束', mo.businessStatus === 'COMPLETED' && mo.caregiver?.name === '联调护工' && ['安排护工', '开始服务', '结束服务'].every((t) => mo.events.some((e: any) => e.title === t)))

  // ───────────── 6. 后台发送站内消息 ─────────────
  section('6. 后台向订单用户发送站内消息 → 小程序显示消息与未读')
  const unread0 = must(await app('unreadCount'), '未读数')
  must(await admin('messages', 'sendMessage', { target: 'order', orderId: order.id, title: '联调回访', body: '感谢使用，如有问题请联系客服。' }), '发送消息')
  const unread1 = must(await app('unreadCount'), '未读数')
  msgs = must(await app('listMessages'), '小程序消息')
  const manual = msgs.find((m: any) => m.title === '联调回访')
  check('小程序收到消息，发送方为客服，未读 +1', !!manual && manual.sender === '客服' && !manual.readAt && unread1 === unread0 + 1, `未读 ${unread0} → ${unread1}`)
  must(await app('readMessage', manual.id), '阅读消息')
  check('阅读后未读数减少', must(await app('unreadCount'), '未读数') === unread1 - 1)
  const other = await appAs('user_2', 'listMessages')
  check('其他账号收不到该消息', other.ok && !other.data.some((m: any) => m.id === manual.id))

  // ───────────── 7. 取消与退款 ─────────────
  section('7. 取消订单与模拟退款')
  const mk = async (rid: string, units = 1) => {
    const q = must(await app('quote', { offeringId: offering.id, location: loc, startAt, units, assessment: ALL_CAN }), '报价')
    return must(await app('createOrder', { quoteId: q.id, patientId: patient.id, bed: { room: '', bedNo: '', unsure: true }, consents, proxyConsent: true, requestId: rid }), '下单')
  }
  const o2 = await mk('e2e-cancel')
  const cancelled = must(await app('cancelOrder', o2.id, '计划有变', o2.version), '用户取消')
  const ad2 = must(await admin('orders', 'getOrderDetail', o2.id), '后台详情')
  check('小程序取消待确认订单，后台同步为已取消', cancelled.businessStatus === 'CANCELLED' && ad2.order.businessStatus === 'CANCELLED')

  const o3 = await mk('e2e-cancel-after-confirm')
  let a3 = must(await admin('orders', 'getOrderDetail', o3.id), '后台详情')
  must(await admin('orders', 'performOrderAction', o3.id, 'confirm', { version: a3.order.version, capacityConfirmed: true }), '确认')
  const m3 = must(await app('getOrder', o3.id), '小程序订单')
  const c3b = must(await app('cancelOrder', o3.id, '已找到其他陪护', m3.version), '待支付取消')
  a3 = must(await admin('orders', 'getOrderDetail', o3.id), '后台详情')
  check('待支付订单取消后关闭支付单，不能再付款', c3b.businessStatus === 'CANCELLED' && a3.payments.every((p: any) => p.status === 'CLOSED') && !(await app('preparePayment', o3.id)).ok)

  const o4 = await mk('e2e-refund', 2)
  let a4 = must(await admin('orders', 'getOrderDetail', o4.id), '后台详情')
  must(await admin('orders', 'performOrderAction', o4.id, 'confirm', { version: a4.order.version, capacityConfirmed: true }), '确认')
  must(await demoPay(o4.id), '支付')
  let m4 = must(await app('getOrder', o4.id), '小程序订单')
  check('已支付订单不能直接取消，需走售后', !(await app('cancelOrder', o4.id, 'x', m4.version)).ok)
  m4 = must(await app('requestRefund', o4.id, '提前出院', m4.version), '申请售后')
  check('小程序售后申请显示“已申请”，金额待核定', m4.refunds[0]?.status === 'REQUESTED' && m4.refunds[0]?.amountFen === null)
  const dup = await app('requestRefund', o4.id, '再次申请', m4.version)
  check('处理中的售后不能重复申请', !dup.ok)
  const rfs = must(await admin('payments', 'listRefunds', {}), '后台退款列表').items
  const rf = rfs.find((r: any) => r.orderId === o4.id)
  check('后台退款列表出现该申请，可核定上限 ¥400.00', rf?.status === 'REQUESTED' && rf?.approvableCapFen === 40000)
  const over = await admin('payments', 'approveRefund', rf.id, { amount: '400.01', note: '超额测试', updatedAt: rf.updatedAt })
  check('核定金额超过实收被拒绝（防超退）', !over.ok && over.error.code === 'VALIDATION_FAILED')
  must(await admin('payments', 'approveRefund', rf.id, { amount: '150.00', note: '按未服务部分核定（演示）', updatedAt: rf.updatedAt }), '批准退款')
  m4 = must(await app('getOrder', o4.id), '小程序订单')
  check('批准后、执行前，小程序不显示退款成功', m4.refunds[0].status === 'APPROVED' && m4.paymentStatus === 'PAID')
  const failRun = must(await admin('payments', 'executeRefund', rf.id, true), '执行退款（模拟失败）')
  m4 = must(await app('getOrder', o4.id), '小程序订单')
  check('渠道失败时显示待人工处理，资金状态不变', failRun.status === 'FAILED' && m4.refunds[0].status === 'FAILED' && m4.paymentStatus === 'PAID')
  must(await admin('payments', 'retryRefund', rf.id, false), '重试退款')
  m4 = must(await app('getOrder', o4.id), '小程序订单')
  const a4b = must(await admin('orders', 'getOrderDetail', o4.id), '后台详情')
  check('重试复用同一退款单号成功，两端为部分退款', m4.refunds.length === 1 && m4.refunds[0].status === 'SUCCEEDED' && m4.paymentStatus === 'PARTIALLY_REFUNDED' && a4b.order.paymentStatus === 'PARTIALLY_REFUNDED')
  const overReq = await admin('orders', 'requestRefund', o4.id, '250.01', '再退测试')
  check('再次退款超过剩余可退（¥250.00）被拒绝', !overReq.ok)

  // 后台取消已付款订单 → 自动创建退款申请
  const o5 = await mk('e2e-admin-cancel-paid')
  let a5 = must(await admin('orders', 'getOrderDetail', o5.id), '后台详情')
  must(await admin('orders', 'performOrderAction', o5.id, 'confirm', { version: a5.order.version, capacityConfirmed: true }), '确认')
  must(await demoPay(o5.id), '支付')
  a5 = must(await admin('orders', 'getOrderDetail', o5.id), '后台详情')
  must(await admin('orders', 'performOrderAction', o5.id, 'cancel', { version: a5.order.version, reason: '院区临时停诊' }), '后台取消已付款订单')
  const m5 = must(await app('getOrder', o5.id), '小程序订单')
  check('后台取消已付款订单：小程序显示已取消且售后处理中，不显示已退款', m5.businessStatus === 'CANCELLED' && m5.paymentStatus === 'PAID' && m5.refunds[0]?.status === 'REQUESTED')

  // ───────────── 8. 关键异常 ─────────────
  section('8. 关键异常')
  const qOld = must(await app('quote', { offeringId: offering.id, location: loc, startAt, units: 1, assessment: ALL_CAN }), '调价前报价')
  must(await admin('packages', 'addPriceVersion', pkg.id, { price: '250.00', effectiveFrom: null, note: '联调调价' }), '后台调价')
  const hist = must(await app('getOrder', order.id), '历史订单')
  const histAdmin = must(await admin('orders', 'getOrderDetail', order.id), '历史订单（后台）')
  check('后台调价后，历史订单单价与合计不变（¥200 × 2）', hist.unitPriceFen === 20000 && hist.totalFen === 40000 && histAdmin.order.packageSnapshot.unitPriceFen === 20000)
  const staleQuote = await app('createOrder', { quoteId: qOld.id, patientId: patient.id, bed: { room: '', bedNo: '', unsure: true }, consents, proxyConsent: true, requestId: 'e2e-stale-price' })
  check('调价前的报价不能下单，提示价格已调整', !staleQuote.ok && staleQuote.error.code === 'PRICE_CHANGED')
  const qNew = must(await app('quote', { offeringId: offering.id, location: loc, startAt, units: 1, assessment: ALL_CAN }), '调价后报价')
  check('重新报价按新价格 ¥250.00', qNew.totalFen === 25000)

  must(await admin('packages', 'setShelf', pkg.id, 'OFF_SHELF'), '下架套餐')
  offs = must(await app('listOfferings', loc), '小程序套餐')
  const offQuote = await app('quote', { offeringId: offering.id, location: loc, startAt, units: 1, assessment: ALL_CAN })
  const offCreate = await app('createOrder', { quoteId: qNew.id, patientId: patient.id, bed: { room: '', bedNo: '', unsure: true }, consents, proxyConsent: true, requestId: 'e2e-off-shelf' })
  check('下架后小程序不再显示该套餐', !offs.some((o: any) => o.packageId === pkg.id))
  check('下架后不能报价，下架前拿到的报价也不能下单', !offQuote.ok && offQuote.error.code === 'NOT_AVAILABLE' && !offCreate.ok && offCreate.error.code === 'NOT_AVAILABLE')
  must(await admin('packages', 'setShelf', pkg.id, 'ON_SHELF'), '恢复上架')

  const cross = await app('quote', { offeringId: offering.id, location: { ...loc, campusId: 'camp_ds' }, startAt, units: 1, assessment: ALL_CAN })
  check('伪造跨医院的院区组合被拒绝', !cross.ok && cross.error.code === 'NOT_AVAILABLE')
  const tooEarly = await app('quote', { offeringId: offering.id, location: loc, startAt: now + 10 * 60_000, units: 1, assessment: ALL_CAN })
  const badUnits = await app('quote', { offeringId: offering.id, location: loc, startAt, units: -1, assessment: ALL_CAN })
  const noAssess = await app('quote', { offeringId: offering.id, location: loc, startAt, units: 1, assessment: { walk: 'CAN' } })
  const badPhone = await app('savePatient', null, { name: '测试', gender: '', age: null, contactName: '测试', contactPhone: '1380000', contactRelation: '本人', isDefault: false })
  check('不满足提前量、负数天数、评估未完成、错误电话均被拒绝', [tooEarly, badUnits, noAssess, badPhone].every((r) => !r.ok && r.error.code === 'VALIDATION_FAILED'))

  const u2Order = await appAs('user_2', 'getOrder', order.id)
  const u2List = must(await appAs('user_2', 'listOrders', { tab: 'ALL', patientId: '' }), '用户 B 订单')
  const u2Patients = must(await appAs('user_2', 'listPatients'), '用户 B 就诊人')
  const u2Cancel = await appAs('user_2', 'cancelOrder', o3.id, 'x', 1)
  const u2Pay = await appAs('user_2', 'preparePayment', order.id)
  check('用户 B 不能查看、取消或支付用户 A 的订单', !u2Order.ok && u2Order.error.code === 'FORBIDDEN' && !u2Cancel.ok && !u2Pay.ok)
  check('用户 B 的列表中没有用户 A 的订单与就诊人', !u2List.some((o: any) => o.id === order.id) && !u2Patients.some((p: any) => p.id === patient.id))
  const scoped = await adminAs('adm_disp', 'orders', 'getOrderDetail', order.id)
  const scopedList = must(await adminAs('adm_disp', 'orders', 'listOrders', {}), '调度员订单列表')
  check('调度员不能越过医院范围查看订单', !scoped.ok && scoped.error.code === 'FORBIDDEN' && !scopedList.items.some((o: any) => o.id === order.id))
  const finConfirm = await adminAs('adm_fin', 'orders', 'performOrderAction', o2.id, 'confirm', { version: 1, capacityConfirmed: true })
  check('财务角色不能确认订单（服务端校验权限）', !finConfirm.ok && finConfirm.error.code === 'FORBIDDEN')
  const internal = await post('/api/admin/orders/toOrderRow', [], {})
  check('内部函数不能被远程调用', !internal.ok && internal.error.code === 'NOT_FOUND')
  const leaked = await app('mockPay', order.id)
  check('模拟支付不在用户端正式接口中暴露', !leaked.ok && leaked.error.code === 'NOT_FOUND')

  // ───────────── 9. 重启后数据保留 ─────────────
  section('9. 重启本地后端后数据保留')
  await stop()
  await start()
  const keep = must(await app('getOrder', order.id), '重启后订单')
  const keepH = must(await app('listHospitals', { keyword: '联调测试医院', cityId: '', gradeId: '', cursor: null }), '重启后医院')
  const keepMsg = must(await app('listMessages'), '重启后消息')
  check('重启后订单状态、新医院与消息仍在', keep.businessStatus === 'COMPLETED' && keep.caregiver?.name === '联调护工' && keepH.items.length === 1 && keepMsg.some((m: any) => m.title === '联调回访'))
  const replay = must(await app('createOrder', input), '重启后重放下单')
  check('重启后重放同一请求号，仍返回原订单', replay.id === order.id)

  section('10. 关闭演示模式')
  await stop()
  await start({ DEMO_MODE: 'off' })
  const noDemoPay = await demoPay(order.id)
  const noSession = await admin('session', 'listDemoIdentities')
  check('关闭演示模式后，模拟支付与演示身份接口均不可用', !noDemoPay.ok && !noSession.ok)

  await stop()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n共 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`)
  console.log(`临时数据文件：${DATA_FILE}`)
  fs.writeFileSync(path.join(here, 'last-run.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2))
  process.exit(failed.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error('\n✗ 中断：', e.message)
  await stop()
  process.exit(1)
})
