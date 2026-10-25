import type { Caregiver, CaregiverDuty, PackageType } from '../../../../packages/contracts'
import { maskPhone } from '../../../../packages/domain/masking'
import { checkCaregiverConflict, OCCUPYING } from '../../../../packages/domain/scheduling'
import { formatShort } from '../../../../packages/domain/time'
import { checkVersion, fail, findOr404, mutate, query, requireText } from '../../core/ctx'
import { assertCaregiverFits, toOrderRow } from './orders'
import { bump, occupyingAssignment, pushMessage } from '../shared/orderOps'

export interface CaregiverRow extends Caregiver {
  phoneMasked: string
  campusNames: string[]
  activeCount: number
  upcoming: { orderNo: string; startAt: number; endAt: number; status: string }[]
}

export const listCaregivers = () =>
  query((ctx): CaregiverRow[] => {
    ctx.require('dispatch.view')
    const { db } = ctx
    return db.caregivers.map((c) => {
      const asgs = db.assignments.filter((a) => a.caregiverId === c.id && OCCUPYING.includes(a.status) && a.endAt > ctx.now)
      return {
        ...c,
        phone: '',
        phoneMasked: maskPhone(c.phone),
        campusNames: c.campusIds.map((id) => db.campuses.find((x) => x.id === id)?.name ?? '—'),
        activeCount: asgs.length,
        upcoming: asgs
          .sort((a, b) => a.startAt - b.startAt)
          .map((a) => ({
            orderNo: db.orders.find((o) => o.id === a.orderId)?.orderNo ?? '—',
            startAt: a.startAt, endAt: a.endAt, status: a.status,
          })),
      }
    })
  })

export interface CaregiverInput {
  id?: string
  name: string
  phone: string
  gender: '男' | '女'
  campusIds: string[]
  mode: PackageType
  capacity: number
  shifts: string[]
  note: string
}

export const saveCaregiver = (input: CaregiverInput) =>
  mutate((ctx) => {
    ctx.require('caregiver.edit')
    const name = requireText(input.name, '姓名或班组名', 20)
    if (!input.campusIds.length) fail('VALIDATION_FAILED', '请选择至少一个服务院区')
    const capacity = input.mode === 'ONE_TO_ONE' ? 1 : Math.floor(input.capacity)
    if (input.mode === 'ONE_TO_MANY' && (capacity < 2 || capacity > 12)) fail('VALIDATION_FAILED', '班组容量应为 2–12 人')
    if (input.id) {
      const c = findOr404(ctx.db.caregivers, input.id, '护工')
      const phone = input.phone.trim() ? input.phone.trim() : c.phone
      if (!/^1\d{10}$/.test(phone)) fail('VALIDATION_FAILED', '手机号格式不正确（仅检查格式，不代表已验证）')
      Object.assign(c, { name, phone, gender: input.gender, campusIds: [...input.campusIds], mode: input.mode, capacity, shifts: input.shifts, note: input.note.trim(), updatedAt: ctx.now })
      ctx.audit({ action: 'caregiver.update', targetType: '护工', targetId: c.id, summary: `编辑护工 ${name}`, reason: null })
      return true
    }
    const phone = input.phone.trim()
    if (!/^1\d{10}$/.test(phone)) fail('VALIDATION_FAILED', '手机号格式不正确（仅检查格式，不代表已验证）')
    const c: Caregiver = {
      id: ctx.id('cg'), name, phone, gender: input.gender, campusIds: [...input.campusIds], mode: input.mode, capacity,
      shifts: input.shifts, duty: 'ON_DUTY', note: input.note.trim(), createdAt: ctx.now, updatedAt: ctx.now, demo: true,
    }
    ctx.db.caregivers.push(c)
    ctx.audit({ action: 'caregiver.create', targetType: '护工', targetId: c.id, summary: `新增护工 ${name}`, reason: null })
    return true
  })

export const setCaregiverDuty = (id: string, duty: CaregiverDuty) =>
  mutate((ctx) => {
    ctx.require('caregiver.edit')
    const c = findOr404(ctx.db.caregivers, id, '护工')
    c.duty = duty
    c.updatedAt = ctx.now
    return true
  })

/** 待派单：已确认（待支付/待服务）但没有占用中的安排，以及服务中的订单（可改派） */
export const listDispatchQueue = () =>
  query((ctx) => {
    ctx.require('dispatch.view')
    return ctx.db.orders
      .filter((o) => ctx.canHospital(o.hospitalId) && ['PENDING_PAYMENT', 'PENDING_SERVICE', 'IN_SERVICE'].includes(o.businessStatus))
      .map((o) => toOrderRow(ctx, o))
      .sort((a, b) => Number(b.needsDispatch) - Number(a.needsDispatch) || a.startAt - b.startAt)
  })

export interface CandidateRow {
  id: string
  name: string
  mode: PackageType
  capacity: number
  duty: CaregiverDuty
  eligible: boolean
  blocked: boolean
  message: string | null
  conflicts: { orderNo: string; range: string }[]
}

/** 为订单列出候选护工及冲突提示 */
export const listCandidates = (orderId: string) =>
  query((ctx): CandidateRow[] => {
    ctx.require('dispatch.view')
    const o = findOr404(ctx.db.orders, orderId, '订单')
    ctx.requireHospital(o.hospitalId)
    return ctx.db.caregivers
      .filter((c) => c.campusIds.includes(o.campusId))
      .map((c) => {
        const r = checkCaregiverConflict(c, ctx.db.assignments, o.startAt, o.endAt, o.id)
        const modeOk = c.mode === o.packageSnapshot.type
        return {
          id: c.id, name: c.name, mode: c.mode, capacity: c.capacity, duty: c.duty,
          eligible: modeOk,
          blocked: !modeOk || r.blocked,
          message: !modeOk ? (o.packageSnapshot.type === 'ONE_TO_ONE' ? '班组不适用于一对一套餐' : '一对一护工不适用于一对多套餐') : r.message,
          conflicts: r.conflicts.map((a) => ({
            orderNo: ctx.db.orders.find((x) => x.id === a.orderId)?.orderNo ?? '—',
            range: `${formatShort(a.startAt)} – ${formatShort(a.endAt)}`,
          })),
        }
      })
      .sort((a, b) => Number(a.blocked) - Number(b.blocked) || Number(b.eligible) - Number(a.eligible))
  })

export const assignCaregiver = (orderId: string, caregiverId: string, input: { version: number; reason?: string }) =>
  mutate((ctx) => {
    ctx.require('dispatch.assign')
    const o = findOr404(ctx.db.orders, orderId, '订单')
    ctx.requireHospital(o.hospitalId)
    checkVersion(o.version, input.version)
    if (!['PENDING_PAYMENT', 'PENDING_SERVICE', 'IN_SERVICE'].includes(o.businessStatus)) {
      fail('STATE_CONFLICT', '只有已确认且未结束的订单可以派单')
    }
    const current = occupyingAssignment(ctx, o.id)
    if (current?.caregiverId === caregiverId) fail('VALIDATION_FAILED', '已安排该护工')
    const { cg } = assertCaregiverFits(ctx, o, caregiverId)
    const status = o.paymentStatus === 'UNPAID' ? 'RESERVED' : 'ACTIVE'
    let reason: string | null = null
    if (current) {
      reason = requireText(input.reason, '改派原因', 200)
      current.status = 'REPLACED'
      current.changedReason = reason
      current.updatedAt = ctx.now
    }
    ctx.db.assignments.push({
      id: ctx.id('asg'), orderId: o.id, caregiverId: cg.id,
      startAt: o.businessStatus === 'IN_SERVICE' ? Math.max(o.startAt, ctx.now) : o.startAt,
      endAt: o.endAt, status, changedReason: null, arrivedAt: null, operatorName: ctx.actor.name,
      createdAt: ctx.now, updatedAt: ctx.now, demo: true,
    })
    const prevName = current ? ctx.db.caregivers.find((c) => c.id === current.caregiverId)?.name : null
    bump(ctx, o, current ? '改派护工' : status === 'RESERVED' ? '预留护工' : '安排护工', current ? `${prevName} → ${cg.name}；${reason}` : cg.name)
    if (status === 'ACTIVE') {
      pushMessage(ctx, o.userId, o.id, current ? '陪护人员已调整' : '陪护人员已安排', `订单 ${o.orderNo} 的陪护人员${current ? '已调整' : '已安排'}，如有疑问请联系客服。`)
    }
    ctx.audit({
      action: current ? 'dispatch.reassign' : 'dispatch.assign', targetType: '订单', targetId: o.orderNo,
      summary: current ? `改派 ${prevName} → ${cg.name}` : `安排 ${cg.name}（${status === 'RESERVED' ? '预留' : '生效'}）`, reason,
    })
    return { version: o.version }
  })
