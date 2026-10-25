import type { Campus, City, Department, District, Hospital, HospitalGrade, Ward } from '../../../../packages/contracts'
import { OPEN_STATUSES } from '../../../../packages/domain/orderRules'
import { fail, findOr404, mutate, query, requireText, touch, type Ctx } from '../../core/ctx'

// 目录：服务地区、医院等级、医院、院区、科室、病区。目录优先启停，有下级引用时禁止硬删除。

type Sortable = { id: string; sort: number }

function move<T extends Sortable>(siblings: T[], id: string, dir: -1 | 1, now: number): void {
  const list = [...siblings].sort((a, b) => a.sort - b.sort)
  const i = list.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  list.forEach((x, idx) => {
    x.sort = idx + 1
    ;(x as unknown as { updatedAt: number }).updatedAt = now
  })
}

const nextSort = (list: Sortable[]) => list.reduce((m, x) => Math.max(m, x.sort), 0) + 1
const meta = (now: number) => ({ createdAt: now, updatedAt: now, demo: true as const })

function uniqueName(list: { id: string; name: string }[], name: string, id: string | undefined, label: string) {
  if (list.some((x) => x.name === name && x.id !== id)) fail('VALIDATION_FAILED', `${label}「${name}」已存在`)
}

// ---------- 服务地区 ----------
export interface CityRow extends City {
  districts: (District & { hospitalCount: number })[]
  hospitalCount: number
}

export const listRegions = () =>
  query((ctx): CityRow[] => {
    ctx.require('catalog.view')
    const { db } = ctx
    return [...db.cities]
      .sort((a, b) => a.sort - b.sort)
      .map((c) => ({
        ...c,
        hospitalCount: db.hospitals.filter((h) => h.cityId === c.id).length,
        districts: db.districts
          .filter((d) => d.cityId === c.id)
          .sort((a, b) => a.sort - b.sort)
          .map((d) => ({ ...d, hospitalCount: db.hospitals.filter((h) => h.districtId === d.id).length })),
      }))
  })

export const saveCity = (input: { id?: string; name: string; code: string }) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const name = requireText(input.name, '城市名称', 20)
    const code = requireText(input.code, '行政区划代码', 12)
    if (!/^\d{6}$/.test(code)) fail('VALIDATION_FAILED', '行政区划代码应为 6 位数字')
    if (/区$|县$/.test(name)) fail('VALIDATION_FAILED', '区县请添加在城市下级，不要与城市并列')
    uniqueName(ctx.db.cities, name, input.id, '城市')
    if (input.id) {
      const c = findOr404(ctx.db.cities, input.id, '城市')
      Object.assign(c, { name, code })
      touch(c, ctx.now)
      ctx.audit({ action: 'catalog.city.update', targetType: '城市', targetId: c.id, summary: `编辑城市 ${name}`, reason: null })
      return c
    }
    const c: City = { id: ctx.id('city'), name, code, enabled: true, sort: nextSort(ctx.db.cities), ...meta(ctx.now) }
    ctx.db.cities.push(c)
    ctx.audit({ action: 'catalog.city.create', targetType: '城市', targetId: c.id, summary: `新增城市 ${name}`, reason: null })
    return c
  })

export const toggleCity = (id: string, enabled: boolean) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const c = findOr404(ctx.db.cities, id, '城市')
    c.enabled = enabled
    touch(c, ctx.now)
    ctx.audit({ action: 'catalog.city.toggle', targetType: '城市', targetId: id, summary: `${enabled ? '启用' : '停用'}城市 ${c.name}`, reason: null })
    return c
  })

export const deleteCity = (id: string) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const c = findOr404(ctx.db.cities, id, '城市')
    const d = ctx.db.districts.filter((x) => x.cityId === id).length
    const h = ctx.db.hospitals.filter((x) => x.cityId === id).length
    if (d || h) fail('VALIDATION_FAILED', `该城市下还有 ${d} 个区县、${h} 家医院，请先停用而不是删除`)
    ctx.db.cities = ctx.db.cities.filter((x) => x.id !== id)
    ctx.audit({ action: 'catalog.city.delete', targetType: '城市', targetId: id, summary: `删除城市 ${c.name}`, reason: null })
    return true
  })

export const moveCity = (id: string, dir: -1 | 1) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    move(ctx.db.cities, id, dir, ctx.now)
    return true
  })

export const saveDistrict = (input: { id?: string; cityId: string; name: string; code: string }) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    findOr404(ctx.db.cities, input.cityId, '城市')
    const name = requireText(input.name, '区县名称', 20)
    const code = requireText(input.code, '行政区划代码', 12)
    if (!/^\d{6}$/.test(code)) fail('VALIDATION_FAILED', '行政区划代码应为 6 位数字')
    const siblings = ctx.db.districts.filter((d) => d.cityId === input.cityId)
    uniqueName(siblings, name, input.id, '区县')
    if (input.id) {
      const d = findOr404(ctx.db.districts, input.id, '区县')
      if (d.cityId !== input.cityId) fail('VALIDATION_FAILED', '不能把区县移动到其他城市')
      Object.assign(d, { name, code })
      return touch(d, ctx.now)
    }
    const d: District = { id: ctx.id('dist'), cityId: input.cityId, name, code, enabled: true, sort: nextSort(siblings), ...meta(ctx.now) }
    ctx.db.districts.push(d)
    ctx.audit({ action: 'catalog.district.create', targetType: '区县', targetId: d.id, summary: `新增区县 ${name}`, reason: null })
    return d
  })

export const toggleDistrict = (id: string, enabled: boolean) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const d = findOr404(ctx.db.districts, id, '区县')
    d.enabled = enabled
    return touch(d, ctx.now)
  })

export const deleteDistrict = (id: string) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    findOr404(ctx.db.districts, id, '区县')
    const h = ctx.db.hospitals.filter((x) => x.districtId === id).length
    if (h) fail('VALIDATION_FAILED', `该区县下还有 ${h} 家医院，请先停用而不是删除`)
    ctx.db.districts = ctx.db.districts.filter((x) => x.id !== id)
    return true
  })

export const moveDistrict = (id: string, dir: -1 | 1) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const d = findOr404(ctx.db.districts, id, '区县')
    move(ctx.db.districts.filter((x) => x.cityId === d.cityId), id, dir, ctx.now)
    return true
  })

// ---------- 医院等级字典 ----------
export interface GradeRow extends HospitalGrade {
  hospitalCount: number
}

export const listGrades = () =>
  query((ctx): GradeRow[] => {
    ctx.require('catalog.view')
    return [...ctx.db.grades]
      .sort((a, b) => a.sort - b.sort)
      .map((g) => ({ ...g, hospitalCount: ctx.db.hospitals.filter((h) => h.gradeId === g.id).length }))
  })

export const saveGrade = (input: { id?: string; name: string; shortName: string }) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const name = requireText(input.name, '等级名称', 20)
    const shortName = requireText(input.shortName, '简称', 6)
    uniqueName(ctx.db.grades, name, input.id, '等级')
    if (input.id) {
      const g = findOr404(ctx.db.grades, input.id, '等级')
      Object.assign(g, { name, shortName })
      return touch(g, ctx.now)
    }
    const g: HospitalGrade = { id: ctx.id('grade'), name, shortName, enabled: true, sort: nextSort(ctx.db.grades), ...meta(ctx.now) }
    ctx.db.grades.push(g)
    ctx.audit({ action: 'catalog.grade.create', targetType: '医院等级', targetId: g.id, summary: `新增等级 ${name}`, reason: null })
    return g
  })

export const toggleGrade = (id: string, enabled: boolean) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const g = findOr404(ctx.db.grades, id, '等级')
    g.enabled = enabled
    return touch(g, ctx.now)
  })

export const deleteGrade = (id: string) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    findOr404(ctx.db.grades, id, '等级')
    const n = ctx.db.hospitals.filter((h) => h.gradeId === id).length
    if (n) fail('VALIDATION_FAILED', `有 ${n} 家医院正在使用该等级，请先停用`)
    ctx.db.grades = ctx.db.grades.filter((g) => g.id !== id)
    return true
  })

export const moveGrade = (id: string, dir: -1 | 1) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    move(ctx.db.grades, id, dir, ctx.now)
    return true
  })

// ---------- 医院 ----------
export interface HospitalRow extends Hospital {
  cityName: string
  districtName: string | null
  gradeName: string
  gradeShort: string
  campusCount: number
  departmentCount: number
  openOrderCount: number
}

function hospitalRow(ctx: Ctx, h: Hospital): HospitalRow {
  const { db } = ctx
  const campusIds = db.campuses.filter((c) => c.hospitalId === h.id).map((c) => c.id)
  const grade = db.grades.find((g) => g.id === h.gradeId)
  return {
    ...h,
    cityName: db.cities.find((c) => c.id === h.cityId)?.name ?? '—',
    districtName: db.districts.find((d) => d.id === h.districtId)?.name ?? null,
    gradeName: grade?.name ?? '—',
    gradeShort: grade?.shortName ?? '—',
    campusCount: campusIds.length,
    departmentCount: db.departments.filter((d) => campusIds.includes(d.campusId)).length,
    openOrderCount: db.orders.filter((o) => o.hospitalId === h.id && OPEN_STATUSES.includes(o.businessStatus)).length,
  }
}

export interface HospitalFilter {
  keyword?: string
  cityId?: string
  gradeId?: string
  enabled?: '' | 'on' | 'off'
}

export const listHospitals = (f: HospitalFilter = {}) =>
  query((ctx): HospitalRow[] => {
    ctx.require('catalog.view')
    const kw = (f.keyword ?? '').trim()
    return ctx.db.hospitals
      .filter((h) => (!kw || h.name.includes(kw) || h.displayAddress.includes(kw)))
      .filter((h) => !f.cityId || h.cityId === f.cityId)
      .filter((h) => !f.gradeId || h.gradeId === f.gradeId)
      .filter((h) => !f.enabled || (f.enabled === 'on' ? h.enabled : !h.enabled))
      .map((h) => hospitalRow(ctx, h))
  })

export interface CampusRow extends Campus {
  departmentCount: number
  wardCount: number
}

export const getHospital = (id: string) =>
  query((ctx) => {
    ctx.require('catalog.view')
    const h = findOr404(ctx.db.hospitals, id, '医院')
    const campuses: CampusRow[] = ctx.db.campuses
      .filter((c) => c.hospitalId === id)
      .sort((a, b) => a.sort - b.sort)
      .map((c) => {
        const deptIds = ctx.db.departments.filter((d) => d.campusId === c.id).map((d) => d.id)
        return { ...c, departmentCount: deptIds.length, wardCount: ctx.db.wards.filter((w) => deptIds.includes(w.departmentId)).length }
      })
    return { hospital: hospitalRow(ctx, h), campuses }
  })

export interface HospitalInput {
  id?: string
  name: string
  cityId: string
  districtId: string | null
  gradeId: string
  displayAddress: string
  phone: string
}

export const saveHospital = (input: HospitalInput) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const name = requireText(input.name, '医院名称', 40)
    const displayAddress = requireText(input.displayAddress, '展示地址', 80)
    const phone = (input.phone ?? '').trim()
    if (phone && !/^[\d-]{7,20}$/.test(phone)) fail('VALIDATION_FAILED', '联系电话格式不正确')
    const city = ctx.db.cities.find((c) => c.id === input.cityId)
    if (!city) fail('VALIDATION_FAILED', '请选择城市')
    if (input.districtId) {
      const d = ctx.db.districts.find((x) => x.id === input.districtId)
      if (!d || d.cityId !== city.id) fail('VALIDATION_FAILED', '所选区县不属于该城市')
    }
    if (!ctx.db.grades.some((g) => g.id === input.gradeId)) fail('VALIDATION_FAILED', '请选择医院等级')
    uniqueName(ctx.db.hospitals, name, input.id, '医院')
    const patch = { name, cityId: city.id, districtId: input.districtId || null, gradeId: input.gradeId, displayAddress, phone }
    if (input.id) {
      const h = findOr404(ctx.db.hospitals, input.id, '医院')
      Object.assign(h, patch)
      touch(h, ctx.now)
      ctx.audit({ action: 'catalog.hospital.update', targetType: '医院', targetId: h.id, summary: `编辑医院 ${name}`, reason: null })
      return h
    }
    const h: Hospital = { id: ctx.id('hosp'), ...patch, enabled: false, ...meta(ctx.now) }
    ctx.db.hospitals.push(h)
    ctx.audit({ action: 'catalog.hospital.create', targetType: '医院', targetId: h.id, summary: `新增医院 ${name}（默认未营业）`, reason: null })
    return h
  })

export const toggleHospital = (id: string, enabled: boolean, reason?: string) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const h = findOr404(ctx.db.hospitals, id, '医院')
    if (enabled && !ctx.db.campuses.some((c) => c.hospitalId === id && c.enabled)) {
      fail('VALIDATION_FAILED', '请先添加并启用至少一个院区')
    }
    const r = enabled ? null : requireText(reason, '停业原因', 100)
    h.enabled = enabled
    touch(h, ctx.now)
    ctx.audit({ action: 'catalog.hospital.toggle', targetType: '医院', targetId: id, summary: `${enabled ? '恢复营业' : '暂停营业'}：${h.name}`, reason: r })
    return h
  })

export interface CampusInput {
  id?: string
  hospitalId: string
  name: string
  address: string
  phone: string
}

export const saveCampus = (input: CampusInput) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    findOr404(ctx.db.hospitals, input.hospitalId, '医院')
    const name = requireText(input.name, '院区名称', 30)
    const address = requireText(input.address, '院区地址', 80)
    const siblings = ctx.db.campuses.filter((c) => c.hospitalId === input.hospitalId)
    uniqueName(siblings, name, input.id, '院区')
    if (input.id) {
      const c = findOr404(ctx.db.campuses, input.id, '院区')
      if (c.hospitalId !== input.hospitalId) fail('VALIDATION_FAILED', '院区不能跨医院移动')
      Object.assign(c, { name, address, phone: input.phone.trim() })
      return touch(c, ctx.now)
    }
    const c: Campus = {
      id: ctx.id('camp'), hospitalId: input.hospitalId, name, address, phone: input.phone.trim(), enabled: true,
      sort: nextSort(siblings), ...meta(ctx.now),
    }
    ctx.db.campuses.push(c)
    ctx.audit({ action: 'catalog.campus.create', targetType: '院区', targetId: c.id, summary: `新增院区 ${name}`, reason: null })
    return c
  })

export const toggleCampus = (id: string, enabled: boolean) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const c = findOr404(ctx.db.campuses, id, '院区')
    c.enabled = enabled
    touch(c, ctx.now)
    ctx.audit({ action: 'catalog.campus.toggle', targetType: '院区', targetId: id, summary: `${enabled ? '启用' : '停用'}院区 ${c.name}`, reason: null })
    return c
  })

export const moveCampus = (id: string, dir: -1 | 1) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const c = findOr404(ctx.db.campuses, id, '院区')
    move(ctx.db.campuses.filter((x) => x.hospitalId === c.hospitalId), id, dir, ctx.now)
    return true
  })

// ---------- 院区选项（供科室、套餐、护工使用） ----------
export interface CampusOption {
  hospitalId: string
  hospitalName: string
  hospitalEnabled: boolean
  campuses: { id: string; name: string; enabled: boolean }[]
}

export const listCampusOptions = () =>
  query((ctx): CampusOption[] => {
    ctx.require('catalog.view')
    return ctx.db.hospitals.map((h) => ({
      hospitalId: h.id,
      hospitalName: h.name,
      hospitalEnabled: h.enabled,
      campuses: ctx.db.campuses
        .filter((c) => c.hospitalId === h.id)
        .sort((a, b) => a.sort - b.sort)
        .map((c) => ({ id: c.id, name: c.name, enabled: c.enabled })),
    }))
  })

// ---------- 科室与病区 ----------
export interface DepartmentNode extends Department {
  wards: Ward[]
}

export const getDepartmentTree = (campusId: string) =>
  query((ctx): DepartmentNode[] => {
    ctx.require('catalog.view')
    findOr404(ctx.db.campuses, campusId, '院区')
    return ctx.db.departments
      .filter((d) => d.campusId === campusId)
      .sort((a, b) => a.sort - b.sort)
      .map((d) => ({ ...d, wards: ctx.db.wards.filter((w) => w.departmentId === d.id).sort((a, b) => a.sort - b.sort) }))
  })

export const saveDepartment = (input: { id?: string; campusId: string; name: string }) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    findOr404(ctx.db.campuses, input.campusId, '院区')
    const name = requireText(input.name, '科室名称', 30)
    const siblings = ctx.db.departments.filter((d) => d.campusId === input.campusId)
    uniqueName(siblings, name, input.id, '科室')
    if (input.id) {
      const d = findOr404(ctx.db.departments, input.id, '科室')
      if (d.campusId !== input.campusId) fail('VALIDATION_FAILED', '科室不属于当前院区，已阻止跨院区关联')
      d.name = name
      return touch(d, ctx.now)
    }
    const d: Department = { id: ctx.id('dept'), campusId: input.campusId, name, enabled: true, sort: nextSort(siblings), ...meta(ctx.now) }
    ctx.db.departments.push(d)
    ctx.audit({ action: 'catalog.department.create', targetType: '科室', targetId: d.id, summary: `新增科室 ${name}`, reason: null })
    return d
  })

export const toggleDepartment = (id: string, enabled: boolean) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const d = findOr404(ctx.db.departments, id, '科室')
    d.enabled = enabled
    return touch(d, ctx.now)
  })

export const reorderDepartments = (campusId: string, orderedIds: string[]) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const siblings = ctx.db.departments.filter((d) => d.campusId === campusId)
    const same = siblings.length === orderedIds.length && siblings.every((d) => orderedIds.includes(d.id))
    if (!same) fail('VALIDATION_FAILED', '排序列表与院区科室不一致，请刷新后重试')
    orderedIds.forEach((id, i) => {
      const d = siblings.find((x) => x.id === id)!
      d.sort = i + 1
      touch(d, ctx.now)
    })
    ctx.audit({ action: 'catalog.department.reorder', targetType: '院区', targetId: campusId, summary: `批量调整 ${orderedIds.length} 个科室排序`, reason: null })
    return true
  })

export const saveWard = (input: { id?: string; campusId: string; departmentId: string; name: string }) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const dept = findOr404(ctx.db.departments, input.departmentId, '科室')
    if (dept.campusId !== input.campusId) fail('VALIDATION_FAILED', '科室不属于当前院区，已阻止跨院区关联')
    const name = requireText(input.name, '病区名称', 30)
    const siblings = ctx.db.wards.filter((w) => w.departmentId === dept.id)
    uniqueName(siblings, name, input.id, '病区')
    if (input.id) {
      const w = findOr404(ctx.db.wards, input.id, '病区')
      if (w.departmentId !== dept.id) fail('VALIDATION_FAILED', '病区不能跨科室移动')
      w.name = name
      return touch(w, ctx.now)
    }
    const w: Ward = { id: ctx.id('ward'), departmentId: dept.id, name, enabled: true, sort: nextSort(siblings), ...meta(ctx.now) }
    ctx.db.wards.push(w)
    return w
  })

export const toggleWard = (id: string, enabled: boolean) =>
  mutate((ctx) => {
    ctx.require('catalog.edit')
    const w = findOr404(ctx.db.wards, id, '病区')
    w.enabled = enabled
    return touch(w, ctx.now)
  })
