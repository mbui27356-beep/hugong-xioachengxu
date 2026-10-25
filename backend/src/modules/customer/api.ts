// 用户端接口（小程序调用）。与管理端共用同一份数据与订单规则，只返回当前用户可见、已脱敏的数据。

import type * as C from '../../../../packages/contracts/customer'
import type { Agreement, Campus, Hospital, Order, Patient, ServicePackage } from '../../../../packages/contracts'
import { ASSESSMENT_ITEMS, BILLING_UNIT_SHORT } from '../../../../packages/contracts'
import { formatFen } from '../../../../packages/domain/money'
import { effectiveVersionAt, quote as priceQuote, UNIT_HOURS, MAX_UNITS } from '../../../../packages/domain/pricing'
import { DAY, MINUTE, formatDate } from '../../../../packages/domain/time'
import { fail, userMutate, userQuery, type UserCtx } from '../../core/ctx'
import type { Db } from '../../core/db'
import { createPrepay } from '../../adapters/mock/payment'
import { bump, createRefund, orderRefundSummary, pushMessage, reconcileBeforeClose, releaseAssignments } from '../shared/orderOps'

const QUOTE_TTL = 10 * MINUTE
const MAX_ADVANCE_DAYS = 14
const CONFIRM_WITHIN_MINUTES = 30
const PHONE_RE = /^1[3-9]\d{9}$/
const OPEN_REFUND = ['REQUESTED', 'APPROVED', 'PROCESSING', 'FAILED']

// ───────────── DTO 映射 ─────────────

const splitList = (s: string) =>
  s.split(/[；;\n]/).map((x) => x.replace(/[。.]$/, '').trim()).filter(Boolean)

function toGender(g: string): C.Gender {
  return g === '男' ? 'M' : g === '女' ? 'F' : ''
}

function fromGender(g: C.Gender): Patient['gender'] {
  return g === 'M' ? '男' : g === 'F' ? '女' : '未填'
}

function hospitalCard(db: Db, h: Hospital): C.HospitalCard {
  return {
    id: h.id,
    cityId: h.cityId,
    gradeId: h.gradeId,
    name: h.name,
    district: db.districts.find((d) => d.id === h.districtId)?.name ?? '',
    displayAddress: h.displayAddress,
    cityName: db.cities.find((c) => c.id === h.cityId)?.name ?? '',
    gradeName: db.grades.find((g) => g.id === h.gradeId)?.name ?? '',
    campusCount: db.campuses.filter((c) => c.hospitalId === h.id && c.enabled).length,
    demo: /演示|虚构/.test(h.name),
  }
}

function pkgDto(p: ServicePackage): C.ServicePackage {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    summary: p.conditions,
    content: splitList(p.content),
    exclusions: splitList(p.exclusions),
    unitHours: UNIT_HOURS[p.unit],
    unitLabel: BILLING_UNIT_SHORT[p.unit],
    conditions: p.limits,
  }
}

function agreementDto(a: Agreement): C.Agreement {
  const sections = a.body.split(/\n\s*\n/).map((chunk) => {
    const lines = chunk.trim().split('\n')
    const isHeading = /^[一二三四五六七八九十]+、/.test(lines[0])
    return isHeading
      ? { heading: lines[0].replace(/^[一二三四五六七八九十]+、/, ''), body: lines.slice(1).join('\n') }
      : { heading: '', body: lines.join('\n') }
  })
  return {
    id: a.id, type: a.type, title: a.title, version: a.version,
    summary: sections[0]?.body.slice(0, 40) ?? '', sections, contentHash: a.contentHash, publishedAt: a.publishedAt ?? 0,
  }
}

function patientDto(p: Patient): C.Patient {
  return {
    id: p.id, name: p.name, gender: toGender(p.gender), age: p.age, contactName: p.contactName, contactPhone: p.contactPhone,
    contactRelation: p.relationship, isDefault: p.isDefault, createdAt: p.createdAt, updatedAt: p.updatedAt,
  }
}

function orderDto(db: Db, o: Order): C.Order {
  // 进行中看当前生效的派单；已结束的订单保留最后一次服务的护工
  const asg =
    db.assignments.find((a) => a.orderId === o.id && a.status === 'ACTIVE') ??
    db.assignments.filter((a) => a.orderId === o.id && a.status === 'FINISHED').sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const cg = asg ? db.caregivers.find((c) => c.id === asg.caregiverId) : undefined
  const unitLabel = BILLING_UNIT_SHORT[o.packageSnapshot.unit]
  const loc = o.locationSnapshot
  return {
    id: o.id,
    orderNo: o.orderNo,
    patientId: o.patientId,
    location: {
      hospitalId: o.hospitalId, campusId: o.campusId, departmentId: o.departmentId, wardId: '',
      hospitalName: loc.hospitalName, campusName: loc.campusName, departmentName: loc.departmentName,
      wardName: loc.wardName ?? '', address: loc.campusAddress,
    },
    patient: { name: o.patientSnapshot.name, gender: toGender(o.patientSnapshot.gender), age: o.patientSnapshot.age },
    contact: { ...o.contactSnapshot },
    bed: { room: loc.room ?? '', bedNo: loc.bedNo ?? '', unsure: !loc.room || !loc.bedNo },
    pkg: {
      name: o.packageSnapshot.name, type: o.packageSnapshot.type, unitHours: UNIT_HOURS[o.packageSnapshot.unit], unitLabel,
      content: splitList(o.packageSnapshot.content), exclusions: splitList(o.packageSnapshot.exclusions),
    },
    assessment: o.assessmentSnapshot as C.Assessment,
    consents: o.agreementVersions.map((a) => ({ agreementId: '', type: a.type, version: a.version })),
    startAt: o.startAt,
    endAt: o.endAt,
    units: o.units,
    unitPriceFen: o.packageSnapshot.unitPriceFen,
    lines: o.priceLines.map((l) => ({ label: o.packageSnapshot.name, detail: `${formatFen(l.unitPriceFen)} × ${l.quantity} ${unitLabel}`, amountFen: l.amountFen })),
    totalFen: o.totalFen,
    businessStatus: o.businessStatus,
    paymentStatus: o.paymentStatus,
    paymentDeadline: o.paymentDeadlineAt,
    // 护工电话仅在服务期内向用户展示
    caregiver: cg ? { name: cg.name, phone: ['PENDING_SERVICE', 'IN_SERVICE'].includes(o.businessStatus) ? cg.phone : '' } : null,
    events: o.timeline.map((t) => ({ at: t.at, title: t.title, detail: t.detail ?? '' })),
    payments: db.payments
      .filter((p) => p.orderId === o.id && p.status !== 'CLOSED')
      .map((p) => ({ outTradeNo: p.outTradeNo, amountFen: p.amountFen, status: p.status, paidAt: p.paidAt })),
    refunds: db.refunds
      .filter((r) => r.orderId === o.id)
      .map((r) => ({ outRefundNo: r.outRefundNo, amountFen: r.status === 'REQUESTED' ? null : r.amountFen, reason: r.reason, status: r.status, createdAt: r.createdAt })),
    version: o.version,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}

function settingsDto(db: Db): C.ServiceSettings {
  const s = db.settings
  return {
    providerName: s.providerName,
    servicePhone: s.supportPhone.replace(/\D/g, ''),
    leadTimeMinutes: s.leadTimeMinutes,
    acceptingOrders: !s.pauseOrders,
    pauseNotice: s.pauseNotice,
    confirmWithinMinutes: CONFIRM_WITHIN_MINUTES,
    paymentWindowMinutes: s.paymentDeadlineMinutes,
    maxAdvanceDays: MAX_ADVANCE_DAYS,
  }
}

// ───────────── 地点与套餐校验（服务端验证父子链，防止跨医院组合） ─────────────

interface ResolvedLocation {
  hospital: Hospital
  campus: Campus
  snapshot: C.LocationSnapshot
}

function resolveLocation(db: Db, sel: C.LocationSelection): ResolvedLocation {
  const hospital = db.hospitals.find((h) => h.id === sel.hospitalId && h.enabled)
  const city = hospital && db.cities.find((c) => c.id === hospital.cityId && c.enabled)
  const campus = db.campuses.find((c) => c.id === sel.campusId && c.hospitalId === sel.hospitalId && c.enabled)
  const dept = db.departments.find((d) => d.id === sel.departmentId && d.campusId === sel.campusId && d.enabled)
  if (!hospital || !city || !campus || !dept) fail('NOT_AVAILABLE', '所选地点暂不可预约，请重新选择')
  const wards = db.wards.filter((w) => w.departmentId === dept.id && w.enabled)
  let wardName = ''
  if (wards.length) {
    const w = wards.find((x) => x.id === sel.wardId)
    if (!w) fail('VALIDATION_FAILED', '请选择病区')
    wardName = w.name
  } else if (sel.wardId) {
    fail('NOT_AVAILABLE', '所选病区暂不可预约')
  }
  return {
    hospital, campus,
    snapshot: { ...sel, wardId: wards.length ? sel.wardId : '', hospitalName: hospital.name, campusName: campus.name, departmentName: dept.name, wardName, address: campus.address },
  }
}

function offeringsFor(ctx: UserCtx, campusId: string): C.OfferingView[] {
  const out: C.OfferingView[] = []
  for (const p of ctx.db.packages) {
    if (p.status !== 'ON_SHELF' || !p.campusIds.includes(campusId)) continue
    const pv = effectiveVersionAt(ctx.db.priceVersions.filter((v) => v.packageId === p.id), ctx.now)
    if (!pv) continue
    out.push({
      id: `${p.id}@${campusId}`, packageId: p.id, campusId, unitPriceFen: pv.unitPriceFen, priceVersion: pv.version,
      consultPhone: p.consultPhone.replace(/\D/g, ''), maxUnits: MAX_UNITS, pkg: pkgDto(p),
    })
  }
  return out
}

function publishedAgreements(db: Db): Agreement[] {
  return db.agreements.filter((a) => a.status === 'PUBLISHED')
}

function myOrder(ctx: UserCtx, id: string): Order {
  const o = ctx.db.orders.find((x) => x.id === id && x.userId === ctx.userId)
  if (!o) fail('FORBIDDEN', '订单不存在或无权查看')
  return o
}

// ───────────── catalog ─────────────

export const filters = () =>
  userQuery((ctx) => ({
    cities: ctx.db.cities.filter((c) => c.enabled).sort((a, b) => a.sort - b.sort).map((c) => ({ id: c.id, name: c.name })),
    grades: ctx.db.grades.filter((g) => g.enabled).sort((a, b) => a.sort - b.sort).map((g) => ({ id: g.id, name: g.name, shortName: g.shortName })),
  }))

export const listHospitals = (q: { keyword: string; cityId: string; gradeId: string; cursor: string | null }) =>
  userQuery((ctx): C.Page<C.HospitalCard> => {
    const kw = (q.keyword || '').trim()
    const all = ctx.db.hospitals
      .filter((h) => h.enabled && ctx.db.cities.some((c) => c.id === h.cityId && c.enabled))
      .filter((h) => ctx.db.campuses.some((c) => c.hospitalId === h.id && c.enabled))
      .map((h) => hospitalCard(ctx.db, h))
      .filter((h) => (!q.cityId || h.cityId === q.cityId) && (!q.gradeId || h.gradeId === q.gradeId))
      .filter((h) => !kw || h.name.includes(kw) || h.district.includes(kw))
    const size = 10
    const start = q.cursor ? Number(q.cursor) : 0
    return { items: all.slice(start, start + size), nextCursor: start + size < all.length ? String(start + size) : null }
  })

export const getHospitalTree = (hospitalId: string) =>
  userQuery((ctx): C.HospitalTree => {
    const h = ctx.db.hospitals.find((x) => x.id === hospitalId && x.enabled)
    if (!h) fail('NOT_AVAILABLE', '该医院暂不可预约')
    const campuses = ctx.db.campuses
      .filter((c) => c.hospitalId === h.id && c.enabled)
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({
        id: c.id, name: c.name, address: c.address,
        departments: ctx.db.departments
          .filter((d) => d.campusId === c.id && d.enabled)
          .sort((a, b) => a.sort - b.sort)
          .map((d) => ({
            id: d.id, name: d.name,
            wards: ctx.db.wards.filter((w) => w.departmentId === d.id && w.enabled).sort((a, b) => a.sort - b.sort).map((w) => ({ id: w.id, name: w.name })),
          })),
      }))
    return { hospital: hospitalCard(ctx.db, h), campuses }
  })

export const listOfferings = (sel: C.LocationSelection) =>
  userQuery((ctx) => {
    const loc = resolveLocation(ctx.db, sel)
    return offeringsFor(ctx, loc.campus.id)
  })

export const settings = () => userQuery((ctx) => settingsDto(ctx.db))

export const getAgreements = (types: C.AgreementType[]) =>
  userQuery((ctx) => publishedAgreements(ctx.db).filter((a) => types.includes(a.type)).map(agreementDto))

// ───────────── patients ─────────────

function validatePatient(p: C.PatientInput): string | null {
  if (!p.name || !p.name.trim()) return '请填写就诊人姓名'
  if (p.name.trim().length > 20) return '姓名不超过 20 个字'
  if (p.age !== null && (!Number.isInteger(p.age) || p.age < 0 || p.age > 120)) return '请填写正确的年龄'
  if (!p.contactName || !p.contactName.trim()) return '请填写联系人姓名'
  if (!PHONE_RE.test(p.contactPhone || '')) return '请填写 11 位手机号'
  if (!p.contactRelation || !p.contactRelation.trim()) return '请填写联系人与就诊人的关系'
  return null
}

export const listPatients = () =>
  userQuery((ctx) =>
    ctx.db.patients
      .filter((p) => p.ownerUserId === ctx.userId)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt - a.updatedAt)
      .map(patientDto),
  )

export const getPatient = (id: string) =>
  userQuery((ctx) => {
    const p = ctx.db.patients.find((x) => x.id === id && x.ownerUserId === ctx.userId)
    if (!p) fail('FORBIDDEN', '就诊人不存在或无权查看')
    return patientDto(p)
  })

export const savePatient = (id: string | null, input: C.PatientInput) =>
  userMutate((ctx) => {
    const err = validatePatient(input)
    if (err) fail('VALIDATION_FAILED', err)
    const mine = ctx.db.patients.filter((x) => x.ownerUserId === ctx.userId)
    const fields = {
      name: input.name.trim(), gender: fromGender(input.gender), age: input.age, contactName: input.contactName.trim(),
      contactPhone: input.contactPhone, relationship: input.contactRelation.trim(), isDefault: !!input.isDefault,
    }
    let p: Patient
    if (id) {
      const found = mine.find((x) => x.id === id)
      if (!found) fail('FORBIDDEN', '就诊人不存在或无权修改')
      Object.assign(found, fields, { updatedAt: ctx.now })
      p = found
    } else {
      p = { ...fields, id: ctx.id('pat'), ownerUserId: ctx.userId, isDefault: fields.isDefault || mine.length === 0, note: '', createdAt: ctx.now, updatedAt: ctx.now, demo: true }
      ctx.db.patients.push(p)
    }
    if (p.isDefault) for (const x of mine) if (x.id !== p.id) x.isDefault = false
    return patientDto(p)
  })

/** 移除常用档案：订单保存的是快照，不受影响 */
export const removePatient = (id: string) =>
  userMutate((ctx) => {
    const idx = ctx.db.patients.findIndex((x) => x.id === id && x.ownerUserId === ctx.userId)
    if (idx < 0) fail('FORBIDDEN', '就诊人不存在或无权删除')
    const wasDefault = ctx.db.patients[idx].isDefault
    ctx.db.patients.splice(idx, 1)
    if (wasDefault) {
      const next = ctx.db.patients.find((x) => x.ownerUserId === ctx.userId)
      if (next) next.isDefault = true
    }
    return true
  })

// ───────────── quote & order ─────────────

function withinBusinessHours(db: Db, now: number): boolean {
  const s = db.settings
  if (!s.businessHoursEnabled) return true
  const d = new Date(now + 8 * 3600 * 1000)
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes()
  const [sh, sm] = s.businessStart.split(':').map(Number)
  const [eh, em] = s.businessEnd.split(':').map(Number)
  const start = sh * 60 + sm
  const end = eh * 60 + em
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

function assertAcceptingOrders(db: Db, now: number) {
  if (db.settings.pauseOrders) fail('NOT_AVAILABLE', db.settings.pauseNotice || '当前暂停接单，请稍后再试或联系客服')
  if (!withinBusinessHours(db, now)) fail('NOT_AVAILABLE', `当前不在接单时间（${db.settings.businessStart}–${db.settings.businessEnd}）`)
}

export const quote = (input: C.QuoteInput) =>
  userMutate((ctx): C.Quote => {
    const { db, now } = ctx
    assertAcceptingOrders(db, now)
    const loc = resolveLocation(db, input.location)
    const offering = offeringsFor(ctx, loc.campus.id).find((o) => o.id === input.offeringId)
    if (!offering) fail('NOT_AVAILABLE', '该套餐已下架或不适用于所选地点')
    if (!Number.isInteger(input.units) || input.units < 1 || input.units > offering.maxUnits) {
      fail('VALIDATION_FAILED', `服务时长需在 1–${offering.maxUnits} ${offering.pkg.unitLabel}之间`)
    }
    if (!Number.isFinite(input.startAt) || input.startAt < now + db.settings.leadTimeMinutes * MINUTE - MINUTE) {
      fail('VALIDATION_FAILED', `请至少提前 ${db.settings.leadTimeMinutes / 60} 小时预约`)
    }
    if (input.startAt > now + MAX_ADVANCE_DAYS * DAY) fail('VALIDATION_FAILED', `最多可预约 ${MAX_ADVANCE_DAYS} 天内的服务`)
    const assessment = input.assessment || {}
    if (!ASSESSMENT_ITEMS.every((i) => ['CAN', 'NEED_HELP', 'UNSURE'].includes(assessment[i.key as C.AssessmentKey] as string))) {
      fail('VALIDATION_FAILED', '请完成照护需求评估')
    }
    const pkg = db.packages.find((p) => p.id === offering.packageId)!
    const pv = effectiveVersionAt(db.priceVersions.filter((v) => v.packageId === pkg.id), now)!
    const q = priceQuote({ priceVersion: pv, units: input.units, startAt: input.startAt })
    const id = ctx.id('q')
    db.quotes = db.quotes.filter((x) => x.expiresAt > now)
    db.quotes.push({
      id, userId: ctx.userId, packageId: pkg.id, priceVersionId: pv.id, hospitalId: loc.hospital.id, campusId: loc.campus.id,
      departmentId: input.location.departmentId, wardId: loc.snapshot.wardId, startAt: q.startAt, endAt: q.endAt, units: input.units,
      unitPriceFen: pv.unitPriceFen, totalFen: q.totalFen, assessment: assessment as Record<string, string>, expiresAt: now + QUOTE_TTL, createdAt: now,
    })
    return {
      id, offeringId: offering.id, location: loc.snapshot, startAt: q.startAt, endAt: q.endAt, units: input.units,
      unitPriceFen: pv.unitPriceFen,
      lines: q.lines.map((l) => ({ label: pkg.name, detail: `${formatFen(l.unitPriceFen)} × ${l.quantity} ${offering.pkg.unitLabel}`, amountFen: l.amountFen })),
      totalFen: q.totalFen, expiresAt: now + QUOTE_TTL, assessment,
    }
  })

export const createOrder = (input: C.CreateOrderInput) =>
  userMutate((ctx): C.Order => {
    const { db, now } = ctx
    if (!input.requestId) fail('VALIDATION_FAILED', '缺少请求编号')
    // 幂等：同一用户同一请求编号只创建一个订单（双击、网络重试）
    const idemKey = `${ctx.userId}:${input.requestId}`
    const existingId = db.idempotency[idemKey]
    if (existingId) return orderDto(db, myOrder(ctx, existingId))

    assertAcceptingOrders(db, now)
    const q = db.quotes.find((x) => x.id === input.quoteId && x.userId === ctx.userId)
    if (!q || q.expiresAt < now) fail('PRICE_CHANGED', '报价已过期，请重新确认费用')
    const pkg = db.packages.find((p) => p.id === q.packageId)
    if (!pkg || pkg.status !== 'ON_SHELF' || !pkg.campusIds.includes(q.campusId)) fail('NOT_AVAILABLE', '该套餐已下架，请重新选择')
    const pv = effectiveVersionAt(db.priceVersions.filter((v) => v.packageId === pkg.id), now)
    if (!pv || pv.id !== q.priceVersionId) fail('PRICE_CHANGED', '套餐价格已调整，请重新确认费用')
    const loc = resolveLocation(db, { hospitalId: q.hospitalId, campusId: q.campusId, departmentId: q.departmentId, wardId: q.wardId })
    if (q.startAt < now + db.settings.leadTimeMinutes * MINUTE - MINUTE) fail('VALIDATION_FAILED', '到岗时间已不满足提前量，请重新选择')

    const required = publishedAgreements(db).filter((a) => a.type === 'SERVICE' || a.type === 'PRIVACY' || a.type === 'REFUND')
    const consents = input.consents || []
    if (!required.every((a) => consents.some((c) => c.type === a.type && c.version === a.version))) {
      fail('AGREEMENT_CHANGED', '服务说明已更新，请重新阅读并确认')
    }
    const p = db.patients.find((x) => x.id === input.patientId && x.ownerUserId === ctx.userId)
    if (!p) fail('VALIDATION_FAILED', '请选择就诊人')
    if (p.relationship !== '本人' && !input.proxyConsent) fail('VALIDATION_FAILED', '为他人预约需确认已取得就诊人同意')
    const bed = input.bed || { room: '', bedNo: '', unsure: true }
    if (!bed.unsure && (!bed.room.trim() || !bed.bedNo.trim())) fail('VALIDATION_FAILED', '请填写病房与床号，或选择“暂不确定”')

    db.counters.order += 1
    const orderNo = `HG${formatDate(now).replace(/-/g, '')}${String(db.counters.order).padStart(4, '0')}`
    const city = db.cities.find((c) => c.id === loc.hospital.cityId)
    const priced = priceQuote({ priceVersion: pv, units: q.units, startAt: q.startAt })
    const order: Order = {
      id: ctx.id('ord'), orderNo, userId: ctx.userId, patientId: p.id,
      hospitalId: q.hospitalId, campusId: q.campusId, departmentId: q.departmentId,
      locationSnapshot: {
        cityName: city?.name ?? '', hospitalName: loc.snapshot.hospitalName, campusName: loc.snapshot.campusName, campusAddress: loc.snapshot.address,
        departmentName: loc.snapshot.departmentName, wardName: loc.snapshot.wardName || null,
        room: bed.unsure ? null : bed.room.trim(), bedNo: bed.unsure ? null : bed.bedNo.trim(),
      },
      patientSnapshot: { name: p.name, gender: p.gender, age: p.age },
      contactSnapshot: { name: p.contactName, phone: p.contactPhone, relationship: p.relationship },
      packageSnapshot: {
        packageId: pkg.id, name: pkg.name, type: pkg.type, content: pkg.content, exclusions: pkg.exclusions, unit: pkg.unit,
        priceVersionId: pv.id, priceVersion: pv.version, unitPriceFen: pv.unitPriceFen,
      },
      assessmentSnapshot: q.assessment as Order['assessmentSnapshot'],
      needsNote: p.relationship !== '本人' ? `家属代为预约（${p.relationship}），已确认取得就诊人同意` : '',
      agreementVersions: required.map((a) => ({ type: a.type, version: a.version })),
      units: q.units, startAt: q.startAt, endAt: q.endAt, priceLines: priced.lines, totalFen: priced.totalFen,
      businessStatus: 'PENDING_CONFIRM', paymentStatus: 'UNPAID', paymentDeadlineAt: null, actualStartAt: null, actualEndAt: null,
      closeReason: null, timeline: [{ at: now, title: '提交预约', detail: '等待调度核实需求与安排人员', actorName: '用户' }], remarks: [],
      version: 1, createdAt: now, updatedAt: now, demo: true,
    }
    db.orders.push(order)
    db.idempotency[idemKey] = order.id
    db.quotes = db.quotes.filter((x) => x.id !== q.id)
    pushMessage(ctx, ctx.userId, order.id, '预约已提交', `你为${p.name}预约的${pkg.name}已提交，我们会在 ${CONFIRM_WITHIN_MINUTES} 分钟内联系${p.contactName}核实需求。`)
    return orderDto(db, order)
  })

export const listOrders = (q: { tab: string; patientId: string }) =>
  userQuery((ctx) =>
    ctx.db.orders
      .filter((o) => o.userId === ctx.userId)
      .filter((o) => !q.patientId || o.patientId === q.patientId)
      .filter((o) => {
        if (!q.tab || q.tab === 'ALL') return true
        if (q.tab === 'AFTER_SALE') return ctx.db.refunds.some((r) => r.orderId === o.id)
        return o.businessStatus === q.tab
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((o) => orderDto(ctx.db, o)),
  )

export const getOrder = (id: string) => userQuery((ctx) => orderDto(ctx.db, myOrder(ctx, id)))

export const cancelOrder = (id: string, reason: string, version: number) =>
  userMutate((ctx) => {
    const o = myOrder(ctx, id)
    if (o.version !== version) fail('STATE_CONFLICT', '订单状态已更新，请刷新后再试')
    if (o.paymentStatus !== 'UNPAID' || !['PENDING_CONFIRM', 'PENDING_PAYMENT'].includes(o.businessStatus)) {
      fail('STATE_CONFLICT', '当前状态不能直接取消，已支付订单请申请售后')
    }
    // 取消前先核对渠道：用户可能刚在另一处完成付款
    if (reconcileBeforeClose(ctx, o)) fail('STATE_CONFLICT', '该订单已付款成功，如需取消请申请售后')
    releaseAssignments(ctx, o.id, '用户取消')
    o.businessStatus = 'CANCELLED'
    o.closeReason = reason || '用户取消'
    o.paymentDeadlineAt = null
    bump(ctx, o, '用户取消', `${o.closeReason}；已关闭支付单并释放容量`)
    pushMessage(ctx, o.userId, o.id, '预约已取消', `订单 ${o.orderNo} 已取消，未产生费用。`)
    return orderDto(ctx.db, o)
  })

// ───────────── payments & refunds ─────────────

export const preparePayment = (orderId: string) =>
  userMutate((ctx): C.PrepayResult => {
    const o = myOrder(ctx, orderId)
    if (o.businessStatus !== 'PENDING_PAYMENT' || o.paymentStatus !== 'UNPAID') fail('STATE_CONFLICT', '订单当前不可支付')
    if (o.paymentDeadlineAt && o.paymentDeadlineAt < ctx.now) fail('STATE_CONFLICT', '已超过付款期限，请刷新订单')
    const attempt = ctx.db.payments.find((p) => p.orderId === o.id && p.status === 'PENDING')
    if (!attempt) fail('NOT_AVAILABLE', '支付单不存在，请联系客服')
    if (attempt.amountFen !== o.totalFen) fail('VALIDATION_FAILED', '支付金额与订单不一致，已停止支付')
    return createPrepay(attempt)
  })

/** 以服务端记录为准返回支付状态，不采信前端的支付成功回调 */
export const queryPayment = (orderId: string) =>
  userQuery((ctx) => {
    const o = myOrder(ctx, orderId)
    return { paymentStatus: o.paymentStatus, businessStatus: o.businessStatus }
  })

export const requestRefund = (orderId: string, reason: string, version: number) =>
  userMutate((ctx) => {
    const o = myOrder(ctx, orderId)
    const text = (reason || '').trim()
    if (!text) fail('VALIDATION_FAILED', '请填写申请原因')
    if (text.length > 200) fail('VALIDATION_FAILED', '原因不超过 200 字')
    if (o.version !== version) fail('STATE_CONFLICT', '订单状态已更新，请刷新后再试')
    if (o.paymentStatus !== 'PAID' && o.paymentStatus !== 'PARTIALLY_REFUNDED') fail('STATE_CONFLICT', '订单未支付，无需退款')
    if (ctx.db.refunds.some((r) => r.orderId === o.id && OPEN_REFUND.includes(r.status))) fail('STATE_CONFLICT', '已有处理中的售后申请')
    const cap = orderRefundSummary(ctx, o.id).capFen
    if (cap <= 0) fail('STATE_CONFLICT', '该订单已无可退金额')
    // 用户只提交申请；按可退上限占额，实际退款金额由财务按公示规则核定
    const r = createRefund(ctx, o, cap, `用户申请：${text}`, 'USER')
    bump(ctx, o, '用户申请售后', text)
    pushMessage(ctx, o.userId, o.id, '售后申请已提交', `订单 ${o.orderNo} 的售后申请已提交（${r.outRefundNo}），客服会尽快联系你。`)
    return orderDto(ctx.db, o)
  })

// ───────────── messages ─────────────

function myMessages(ctx: UserCtx) {
  return ctx.db.messages.filter((m) => m.recipientUserId === ctx.userId).sort((a, b) => b.createdAt - a.createdAt)
}

export const listMessages = () =>
  userQuery((ctx): C.Message[] =>
    myMessages(ctx).map((m) => ({
      id: m.id, orderId: m.orderId, type: m.orderId ? 'ORDER' : 'SYSTEM', title: m.title, body: m.body,
      sender: m.type === 'MANUAL' ? '客服' : '系统', readAt: m.readAt, createdAt: m.createdAt,
    })),
  )

export const readMessage = (id: string) =>
  userMutate((ctx): C.Message => {
    const m = ctx.db.messages.find((x) => x.id === id && x.recipientUserId === ctx.userId)
    if (!m) fail('FORBIDDEN', '消息不存在或已失效')
    if (m.orderId && !ctx.db.orders.some((o) => o.id === m.orderId && o.userId === ctx.userId)) fail('FORBIDDEN', '关联订单已失效')
    if (!m.readAt) m.readAt = ctx.now
    return { id: m.id, orderId: m.orderId, type: m.orderId ? 'ORDER' : 'SYSTEM', title: m.title, body: m.body, sender: m.type === 'MANUAL' ? '客服' : '系统', readAt: m.readAt, createdAt: m.createdAt }
  })

export const readAllMessages = () =>
  userMutate((ctx) => {
    for (const m of ctx.db.messages) if (m.recipientUserId === ctx.userId && !m.readAt) m.readAt = ctx.now
    return true
  })

export const unreadCount = () => userQuery((ctx) => myMessages(ctx).filter((m) => !m.readAt).length)

// ───────────── 当前身份 ─────────────

export const me = () =>
  userQuery((ctx): C.DemoUser => {
    const u = ctx.db.users.find((x) => x.id === ctx.userId)!
    return { id: u.id, nickname: u.nickname }
  })

