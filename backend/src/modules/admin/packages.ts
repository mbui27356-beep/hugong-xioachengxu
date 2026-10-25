import type { BillingUnit, PackageType, PriceVersion, ServicePackage, ShelfStatus } from '../../../../packages/contracts'
import { formatFen, parseYuanToFen } from '../../../../packages/domain/money'
import { effectiveVersionAt } from '../../../../packages/domain/pricing'
import { MINUTE, formatDateTime } from '../../../../packages/domain/time'
import { fail, findOr404, mutate, query, requireText, touch } from '../../core/ctx'

export interface PackageRow extends ServicePackage {
  currentVersion: PriceVersion | null
  scheduledVersion: PriceVersion | null
  versionCount: number
  campusNames: string[]
  orderCount: number
}

export const listPackages = () =>
  query((ctx): PackageRow[] => {
    ctx.require('catalog.view')
    const { db, now } = ctx
    return db.packages.map((p) => {
      const versions = db.priceVersions.filter((v) => v.packageId === p.id)
      const current = effectiveVersionAt(versions, now)
      const scheduled = versions.filter((v) => v.effectiveFrom > now).sort((a, b) => a.effectiveFrom - b.effectiveFrom)[0] ?? null
      return {
        ...p,
        currentVersion: current,
        scheduledVersion: scheduled,
        versionCount: versions.length,
        campusNames: p.campusIds.map((id) => {
          const c = db.campuses.find((x) => x.id === id)
          const h = c && db.hospitals.find((x) => x.id === c.hospitalId)
          return c ? `${h?.name ?? ''} · ${c.name}` : '已删除院区'
        }),
        orderCount: db.orders.filter((o) => o.packageSnapshot.packageId === p.id).length,
      }
    })
  })

export const listPriceVersions = (packageId: string) =>
  query((ctx) => {
    ctx.require('catalog.view')
    findOr404(ctx.db.packages, packageId, '套餐')
    return ctx.db.priceVersions.filter((v) => v.packageId === packageId).sort((a, b) => b.version - a.version)
  })

export interface PackageInput {
  id?: string
  name: string
  type: PackageType
  unit: BillingUnit
  content: string
  exclusions: string
  conditions: string
  limits: string
  consultPhone: string
  campusIds: string[]
  /** 新建时的首个价格（元，字符串） */
  initialPrice?: string
}

export const savePackage = (input: PackageInput) =>
  mutate((ctx) => {
    ctx.require('package.edit')
    const { db, now } = ctx
    const name = requireText(input.name, '套餐名称', 40)
    const content = requireText(input.content, '服务内容', 500)
    const exclusions = requireText(input.exclusions, '不包含项目', 300)
    if (!input.campusIds.length) fail('VALIDATION_FAILED', '请至少选择一个适用院区')
    for (const id of input.campusIds) if (!db.campuses.some((c) => c.id === id)) fail('VALIDATION_FAILED', '适用院区不存在')
    const phone = input.consultPhone.trim()
    if (phone && !/^[\d-]{7,20}$/.test(phone)) fail('VALIDATION_FAILED', '咨询电话格式不正确')
    const patch = {
      name, type: input.type, unit: input.unit, content, exclusions, conditions: input.conditions.trim(),
      limits: input.limits.trim(), consultPhone: phone, campusIds: [...input.campusIds],
    }
    if (input.id) {
      const p = findOr404(db.packages, input.id, '套餐')
      if (p.unit !== input.unit && db.priceVersions.some((v) => v.packageId === p.id)) {
        fail('VALIDATION_FAILED', '计费单位已有价格版本，请新建套餐而不是修改单位')
      }
      Object.assign(p, patch)
      touch(p, now)
      ctx.audit({ action: 'package.update', targetType: '套餐', targetId: p.id, summary: `编辑套餐 ${name}`, reason: null })
      return p
    }
    const fen = parseYuanToFen(input.initialPrice ?? '')
    if (fen == null || fen <= 0) fail('VALIDATION_FAILED', '请输入正确的首个单价，最多两位小数')
    const id = ctx.id('pkg')
    const pv: PriceVersion = {
      id: ctx.id('pv'), packageId: id, version: 1, unit: input.unit, unitPriceFen: fen, effectiveFrom: now, effectiveTo: null,
      note: '初始价格', operatorName: ctx.actor.name, createdAt: now, updatedAt: now, demo: true,
    }
    const p: ServicePackage = { id, ...patch, status: 'OFF_SHELF', currentPriceVersionId: pv.id, createdAt: now, updatedAt: now, demo: true }
    db.packages.push(p)
    db.priceVersions.push(pv)
    ctx.audit({ action: 'package.create', targetType: '套餐', targetId: id, summary: `新增套餐 ${name}，单价 ${formatFen(fen)}（默认下架）`, reason: null })
    return p
  })

export const setShelf = (id: string, status: ShelfStatus) =>
  mutate((ctx) => {
    ctx.require('package.edit')
    const p = findOr404(ctx.db.packages, id, '套餐')
    if (status === 'ON_SHELF') {
      const current = effectiveVersionAt(ctx.db.priceVersions.filter((v) => v.packageId === id), ctx.now)
      if (!current) fail('VALIDATION_FAILED', '没有生效中的价格版本，不能上架')
      if (!p.campusIds.length) fail('VALIDATION_FAILED', '未配置适用院区，不能上架')
    }
    p.status = status
    touch(p, ctx.now)
    ctx.audit({ action: 'package.shelf', targetType: '套餐', targetId: id, summary: `${status === 'ON_SHELF' ? '上架' : '下架'} ${p.name}`, reason: null })
    return p
  })

export const addPriceVersion = (packageId: string, input: { price: string; effectiveFrom: number | null; note: string }) =>
  mutate((ctx) => {
    ctx.require('package.edit')
    const { db, now } = ctx
    const p = findOr404(db.packages, packageId, '套餐')
    const fen = parseYuanToFen(input.price)
    if (fen == null || fen <= 0) fail('VALIDATION_FAILED', '请输入正确单价，最多两位小数')
    const from = input.effectiveFrom ?? now
    if (from < now - 5 * MINUTE) fail('VALIDATION_FAILED', '生效时间不能早于当前时间，历史价格不可追改')
    const note = requireText(input.note, '调价说明', 100)
    const versions = db.priceVersions.filter((v) => v.packageId === packageId)
    if (versions.some((v) => v.effectiveFrom > now)) fail('VALIDATION_FAILED', '已有待生效的价格版本，请等待生效后再调整')
    const prev = effectiveVersionAt(versions, from)
    if (prev) {
      prev.effectiveTo = from
      touch(prev, now)
    }
    const version = versions.reduce((m, v) => Math.max(m, v.version), 0) + 1
    const pv: PriceVersion = {
      id: ctx.id('pv'), packageId, version, unit: p.unit, unitPriceFen: fen, effectiveFrom: from, effectiveTo: null,
      note, operatorName: ctx.actor.name, createdAt: now, updatedAt: now, demo: true,
    }
    db.priceVersions.push(pv)
    if (from <= now) p.currentPriceVersionId = pv.id
    touch(p, now)
    ctx.audit({
      action: 'package.price.create', targetType: '套餐', targetId: packageId,
      summary: `${p.name} 新增价格版本 v${version}：${prev ? formatFen(prev.unitPriceFen) : '—'} → ${formatFen(fen)}，${formatDateTime(from)} 生效；历史订单不受影响`,
      reason: note,
    })
    return pv
  })
