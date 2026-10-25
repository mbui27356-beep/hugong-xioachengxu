import type {
  Assignment, BusinessStatus, Message, Order, PaymentAttempt, PaymentStatus, Refund,
} from '../../../../packages/contracts'
import { BUSINESS_STATUS_LABEL } from '../../../../packages/contracts'
import { maskName, maskPhone } from '../../../../packages/domain/masking'
import { formatFen, parseYuanToFen } from '../../../../packages/domain/money'
import { ACTION_RULES, availableActions, checkTransition, type OrderAction } from '../../../../packages/domain/orderRules'
import { validateRefundAmount, type RefundSummary } from '../../../../packages/domain/refundRules'
import { checkCaregiverConflict } from '../../../../packages/domain/scheduling'
import { MINUTE, formatDateTime, startOfDayShanghai, DAY } from '../../../../packages/domain/time'
import { checkVersion, fail, findOr404, mutate, query, requireText, type Ctx } from '../../core/ctx'
import {
  bump, createRefund, occupyingAssignment, orderRefundSummary, pushMessage, reconcileBeforeClose, releaseAssignments,
} from '../shared/orderOps'

// ---------- 列表 ----------

export interface OrderRow {
  id: string
  orderNo: string
  patientName: string
  patientMeta: string
  contactPhone: string
  hospitalId: string
  hospitalName: string
  campusName: string
  departmentName: string
  packageName: string
  packageType: Order['packageSnapshot']['type']
  units: number
  unitLabel: string
  startAt: number
  endAt: number
  totalFen: number
  businessStatus: BusinessStatus
  paymentStatus: PaymentStatus
  caregiverName: string | null
  needsDispatch: boolean
  refundInFlight: boolean
  createdAt: number
  version: number
}

export function toOrderRow(ctx: Ctx, o: Order): OrderRow {
  const asg = occupyingAssignment(ctx, o.id)
  // 已结束的订单显示最后一次服务的护工
  const shown = asg ?? ctx.db.assignments.filter((a) => a.orderId === o.id && a.status === 'FINISHED').sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const cg = shown ? ctx.db.caregivers.find((c) => c.id === shown.caregiverId) : undefined
  return {
    id: o.id, orderNo: o.orderNo,
    patientName: maskName(o.patientSnapshot.name),
    patientMeta: [o.patientSnapshot.gender, o.patientSnapshot.age ? `${o.patientSnapshot.age} 岁` : ''].filter(Boolean).join(' · '),
    contactPhone: maskPhone(o.contactSnapshot.phone),
    hospitalId: o.hospitalId,
    hospitalName: o.locationSnapshot.hospitalName,
    campusName: o.locationSnapshot.campusName,
    departmentName: [o.locationSnapshot.departmentName, o.locationSnapshot.wardName].filter(Boolean).join(' · '),
    packageName: o.packageSnapshot.name, packageType: o.packageSnapshot.type,
    units: o.units, unitLabel: o.packageSnapshot.unit === 'DAY_24H' ? '天' : '班',
    startAt: o.startAt, endAt: o.endAt, totalFen: o.totalFen,
    businessStatus: o.businessStatus, paymentStatus: o.paymentStatus,
    caregiverName: cg?.name ?? null,
    needsDispatch: ['PENDING_PAYMENT', 'PENDING_SERVICE'].includes(o.businessStatus) && !asg,
    refundInFlight: ctx.db.refunds.some((r) => r.orderId === o.id && ['REQUESTED', 'APPROVED', 'PROCESSING', 'FAILED'].includes(r.status)),
    createdAt: o.createdAt, version: o.version,
  }
}

export interface OrderFilter {
  status?: BusinessStatus | ''
  hospitalId?: string
  keyword?: string
  paymentStatus?: PaymentStatus | ''
  dispatch?: 'needed' | ''
  date?: 'today' | ''
}

export const listOrders = (f: OrderFilter = {}) =>
  query((ctx) => {
    ctx.require('order.view')
    const kw = (f.keyword ?? '').trim()
    const today = startOfDayShanghai(ctx.now)
    const scoped = ctx.db.orders
      .filter((o) => ctx.canHospital(o.hospitalId))
      .filter((o) => !f.hospitalId || o.hospitalId === f.hospitalId)
      .filter((o) => !f.paymentStatus || o.paymentStatus === f.paymentStatus)
      .filter(
        (o) =>
          !kw ||
          o.orderNo.includes(kw.toUpperCase()) ||
          o.patientSnapshot.name.includes(kw) ||
          o.contactSnapshot.name.includes(kw) ||
          (kw.length >= 4 && o.contactSnapshot.phone.endsWith(kw)),
      )
      .filter((o) => f.date !== 'today' || (o.startAt >= today && o.startAt < today + DAY))
    const rows = scoped.map((o) => toOrderRow(ctx, o))
    const counts: Record<string, number> = { ALL: rows.length }
    for (const s of Object.keys(BUSINESS_STATUS_LABEL)) counts[s] = rows.filter((r) => r.businessStatus === s).length
    const items = rows
      .filter((r) => !f.status || r.businessStatus === f.status)
      .filter((r) => f.dispatch !== 'needed' || r.needsDispatch)
      .sort((a, b) => b.createdAt - a.createdAt)
    return { items, counts }
  })

export const searchOrders = (keyword: string) =>
  query((ctx) => {
    ctx.require('order.view')
    const kw = keyword.trim().toUpperCase()
    if (kw.length < 2) return []
    return ctx.db.orders
      .filter((o) => ctx.canHospital(o.hospitalId) && (o.orderNo.includes(kw) || o.patientSnapshot.name.includes(keyword.trim())))
      .slice(0, 6)
      .map((o) => toOrderRow(ctx, o))
  })

// ---------- 详情 ----------

export interface OrderDetail {
  order: Order
  row: OrderRow
  assignments: (Assignment & { caregiverName: string; caregiverMode: string })[]
  payments: PaymentAttempt[]
  refunds: Refund[]
  refund: RefundSummary
  actions: ReturnType<typeof availableActions>
  messages: Message[]
  canOperate: boolean
  canRemark: boolean
  canRequestRefund: boolean
}

export const getOrderDetail = (id: string) =>
  query((ctx): OrderDetail => {
    ctx.require('order.view')
    const o = findOr404(ctx.db.orders, id, '订单')
    ctx.requireHospital(o.hospitalId)
    const asg = occupyingAssignment(ctx, o.id)
    const masked: Order = {
      ...o,
      patientSnapshot: { ...o.patientSnapshot, name: maskName(o.patientSnapshot.name) },
      contactSnapshot: { ...o.contactSnapshot, name: maskName(o.contactSnapshot.name), phone: maskPhone(o.contactSnapshot.phone) },
    }
    const summary = orderRefundSummary(ctx, o.id)
    const perms = (p: Parameters<Ctx['require']>[0]) => {
      try {
        ctx.require(p)
        return true
      } catch {
        return false
      }
    }
    return {
      order: masked,
      row: toOrderRow(ctx, o),
      assignments: ctx.db.assignments
        .filter((a) => a.orderId === o.id)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((a) => {
          const c = ctx.db.caregivers.find((x) => x.id === a.caregiverId)
          return { ...a, caregiverName: c?.name ?? '—', caregiverMode: c?.mode === 'ONE_TO_MANY' ? '班组' : '一对一' }
        }),
      payments: ctx.db.payments.filter((p) => p.orderId === o.id),
      refunds: ctx.db.refunds.filter((r) => r.orderId === o.id),
      refund: summary,
      actions: availableActions(o, { hasActiveAssignment: asg?.status === 'ACTIVE' }),
      messages: ctx.db.messages.filter((m) => m.orderId === o.id),
      canOperate: perms('order.operate'),
      canRemark: perms('order.remark'),
      canRequestRefund: perms('refund.request') && summary.capFen > 0 && ['COMPLETED', 'CANCELLED', 'IN_SERVICE', 'PENDING_SERVICE'].includes(o.businessStatus),
    }
  })

// ---------- 状态动作 ----------

export interface ActionPayload {
  version: number
  reason?: string
  caregiverId?: string
  capacityConfirmed?: boolean
  refundAmount?: string
}

export interface ActionResult {
  orderId: string
  businessStatus: BusinessStatus
  paymentStatus: PaymentStatus
  version: number
  /** 非错误但需要提示的结果，例如取消时发现渠道已付款 */
  notice: string | null
}

export const performOrderAction = (id: string, action: OrderAction, p: ActionPayload) =>
  mutate((ctx): ActionResult => {
    const rule = ACTION_RULES[action]
    ctx.require(rule.permission)
    const o = findOr404(ctx.db.orders, id, '订单')
    ctx.requireHospital(o.hospitalId)
    checkVersion(o.version, p.version)
    const asg = occupyingAssignment(ctx, o.id)
    const check = checkTransition(o, action, { hasActiveAssignment: asg?.status === 'ACTIVE' })
    if (!check.ok) fail('STATE_CONFLICT', check.message)
    const reason = rule.reasonRequired ? requireText(p.reason, rule.reasonLabel.replace(/（.*）/, ''), 200) : (p.reason ?? '').trim()
    let notice: string | null = null
    const from = BUSINESS_STATUS_LABEL[o.businessStatus]

    switch (action) {
      case 'confirm': {
        if (!p.capacityConfirmed) fail('VALIDATION_FAILED', '请先确认已核实需求且容量可满足')
        if (p.caregiverId) {
          const cg = findOr404(ctx.db.caregivers, p.caregiverId, '护工')
          assertCaregiverFits(ctx, o, cg.id)
          ctx.db.assignments.push({
            id: ctx.id('asg'), orderId: o.id, caregiverId: cg.id, startAt: o.startAt, endAt: o.endAt, status: 'RESERVED',
            changedReason: null, arrivedAt: null, operatorName: ctx.actor.name, createdAt: ctx.now, updatedAt: ctx.now, demo: true,
          })
          o.timeline.push({ at: ctx.now, title: '预留护工', detail: cg.name, actorName: ctx.actor.name })
        }
        o.businessStatus = 'PENDING_PAYMENT'
        o.paymentDeadlineAt = ctx.now + ctx.db.settings.paymentDeadlineMinutes * MINUTE
        ctx.db.counters.trade += 1
        ctx.db.payments.push({
          id: ctx.id('pay'), orderId: o.id, outTradeNo: `T${o.orderNo.slice(2)}${String(ctx.db.counters.trade).padStart(3, '0')}`,
          transactionId: null, amountFen: o.totalFen, status: 'PENDING', channelState: 'NOTPAY', paidAt: null,
          createdAt: ctx.now, updatedAt: ctx.now, demo: true,
        })
        bump(ctx, o, '调度确认', `开放付款，截止 ${formatDateTime(o.paymentDeadlineAt)}${reason ? `；${reason}` : ''}`)
        pushMessage(ctx, o.userId, o.id, '预约已确认，请在截止前付款', `订单 ${o.orderNo} 已确认，请于 ${formatDateTime(o.paymentDeadlineAt)} 前完成付款。`)
        break
      }
      case 'reject': {
        if (reconcileBeforeClose(ctx, o)) {
          notice = '支付渠道显示该订单已付款，已转为待服务，未执行拒绝。如确实不能履约，请取消并退款。'
          break
        }
        releaseAssignments(ctx, o.id, '订单被拒绝')
        o.businessStatus = 'REJECTED'
        o.closeReason = reason
        o.paymentDeadlineAt = null
        bump(ctx, o, '调度拒绝', reason)
        pushMessage(ctx, o.userId, o.id, '预约未能安排', `很抱歉，订单 ${o.orderNo} 暂无法安排：${reason}`)
        break
      }
      case 'start': {
        o.businessStatus = 'IN_SERVICE'
        o.actualStartAt = ctx.now
        if (asg) {
          asg.arrivedAt = ctx.now
          asg.updatedAt = ctx.now
        }
        bump(ctx, o, '开始服务', reason || '护工到岗，记录实际开始时间')
        pushMessage(ctx, o.userId, o.id, '服务已开始', `订单 ${o.orderNo} 的陪护人员已到岗。`)
        break
      }
      case 'complete': {
        o.businessStatus = 'COMPLETED'
        o.actualEndAt = ctx.now
        if (asg) {
          asg.status = 'FINISHED'
          asg.updatedAt = ctx.now
        }
        bump(ctx, o, '结束服务', `完成凭据：${reason}`)
        pushMessage(ctx, o.userId, o.id, '服务已完成', `订单 ${o.orderNo} 服务已结束，感谢信任。如需售后请联系客服。`)
        break
      }
      case 'cancel': {
        if (o.paymentStatus === 'UNPAID') {
          if (reconcileBeforeClose(ctx, o)) {
            notice = '支付渠道显示该订单已付款，已转为待服务，未执行取消。如需取消，请按已付款订单处理。'
            break
          }
          releaseAssignments(ctx, o.id, '订单取消')
          o.businessStatus = 'CANCELLED'
          o.closeReason = reason
          o.paymentDeadlineAt = null
          bump(ctx, o, '取消订单', `${reason}；已关闭支付单并释放容量`)
          pushMessage(ctx, o.userId, o.id, '订单已取消', `订单 ${o.orderNo} 已取消：${reason}`)
        } else {
          const summary = orderRefundSummary(ctx, o.id)
          releaseAssignments(ctx, o.id, '订单取消')
          o.businessStatus = 'CANCELLED'
          o.closeReason = reason
          const r = createRefund(ctx, o, summary.capFen, `已付款取消：${reason}`, 'ADMIN')
          bump(ctx, o, '取消订单', `${reason}；已创建退款申请 ${r.outRefundNo}（${formatFen(r.amountFen)}），待财务审核`)
          pushMessage(ctx, o.userId, o.id, '订单已取消，退款审核中', `订单 ${o.orderNo} 已取消，退款 ${formatFen(r.amountFen)} 正在审核，到账以退款结果通知为准。`)
          notice = `已创建退款申请 ${formatFen(r.amountFen)}，需财务审核后执行`
        }
        break
      }
      case 'endEarly': {
        const fen = parseYuanToFen(p.refundAmount ?? '')
        const summary = orderRefundSummary(ctx, o.id)
        const err = validateRefundAmount(fen, summary)
        if (err) fail('VALIDATION_FAILED', `${err}：最多可退 ${formatFen(summary.capFen)}`)
        o.businessStatus = 'COMPLETED'
        o.actualEndAt = ctx.now
        if (asg) {
          asg.status = 'FINISHED'
          asg.endAt = Math.max(asg.startAt, ctx.now)
          asg.updatedAt = ctx.now
        }
        const r = createRefund(ctx, o, fen!, `提前结束：${reason}`, 'ADMIN')
        bump(ctx, o, '提前结束服务', `${reason}；已创建退款申请 ${formatFen(r.amountFen)}，待财务审核`)
        pushMessage(ctx, o.userId, o.id, '服务提前结束', `订单 ${o.orderNo} 已提前结束，未服务部分退款 ${formatFen(r.amountFen)} 正在审核。`)
        notice = `已创建退款申请 ${formatFen(r.amountFen)}`
        break
      }
    }

    ctx.audit({
      action: `order.${action}`, targetType: '订单', targetId: o.orderNo,
      summary: o.businessStatus === 'PENDING_SERVICE' && (action === 'cancel' || action === 'reject')
        ? `${rule.label}前核对支付渠道：发现已付款，补偿入账为待服务，未执行${rule.label}`
        : `${rule.label}：${from} → ${BUSINESS_STATUS_LABEL[o.businessStatus]}`,
      reason: reason || null,
    })
    return { orderId: o.id, businessStatus: o.businessStatus, paymentStatus: o.paymentStatus, version: o.version, notice }
  })

export function assertCaregiverFits(ctx: Ctx, o: Order, caregiverId: string) {
  const cg = findOr404(ctx.db.caregivers, caregiverId, '护工')
  if (!cg.campusIds.includes(o.campusId)) fail('VALIDATION_FAILED', `${cg.name} 不服务该院区`)
  if (cg.mode !== o.packageSnapshot.type) {
    fail('VALIDATION_FAILED', o.packageSnapshot.type === 'ONE_TO_ONE' ? '一对一套餐需安排一对一护工' : '一对多套餐需安排班组')
  }
  const result = checkCaregiverConflict(cg, ctx.db.assignments, o.startAt, o.endAt, o.id)
  if (result.blocked) fail('STATE_CONFLICT', result.message ?? '派单冲突')
  return { cg, result }
}

export const addRemark = (id: string, text: string) =>
  mutate((ctx) => {
    ctx.require('order.remark')
    const o = findOr404(ctx.db.orders, id, '订单')
    ctx.requireHospital(o.hospitalId)
    const t = requireText(text, '备注', 300)
    o.remarks.unshift({ id: ctx.id('rmk'), at: ctx.now, actorName: ctx.actor.name, text: t })
    o.updatedAt = ctx.now
    return o.remarks
  })

/** 演示工具：模拟另一位管理员刚刚更新了订单，用于验证版本冲突处理。 */
export const simulateConcurrentEdit = (id: string) =>
  mutate((ctx) => {
    const o = findOr404(ctx.db.orders, id, '订单')
    o.version += 1
    o.updatedAt = ctx.now
    o.remarks.unshift({ id: ctx.id('rmk'), at: ctx.now, actorName: '另一位管理员（模拟）', text: '演示：并发更新了订单' })
    return o.version
  })

/** 售后：管理员代用户发起退款申请（金额受额度约束，执行仍需财务审批）。 */
export const requestRefund = (orderId: string, amount: string, reason: string) =>
  mutate((ctx) => {
    ctx.require('refund.request')
    const o = findOr404(ctx.db.orders, orderId, '订单')
    ctx.requireHospital(o.hospitalId)
    const r0 = requireText(reason, '退款原因', 200)
    const fen = parseYuanToFen(amount)
    if (fen == null) fail('VALIDATION_FAILED', '请输入正确金额，最多两位小数')
    const r = createRefund(ctx, o, fen, r0, 'ADMIN')
    o.timeline.push({ at: ctx.now, title: '创建退款申请', detail: `${formatFen(fen)}：${r0}`, actorName: ctx.actor.name })
    o.updatedAt = ctx.now
    ctx.audit({ action: 'refund.request', targetType: '订单', targetId: o.orderNo, summary: `发起退款申请 ${formatFen(fen)}`, reason: r0 })
    return r
  })
