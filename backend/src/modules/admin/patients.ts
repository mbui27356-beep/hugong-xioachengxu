import { maskName, maskPhone } from '../../../../packages/domain/masking'
import { fail, findOr404, mutate, query, requireText } from '../../core/ctx'

// 就诊人资料：仅为处理相关订单查看，默认脱敏；查看完整资料需填写原因并记录审计日志。

export interface PatientRow {
  id: string
  name: string
  gender: string
  age: number | null
  contactName: string
  contactPhone: string
  relationship: string
  ownerNickname: string
  orderCount: number
  hospitals: string[]
  latestOrderNo: string | null
  updatedAt: number
}

export const listPatients = (keyword = '') =>
  query((ctx): PatientRow[] => {
    ctx.require('patient.view')
    const kw = keyword.trim()
    return ctx.db.patients
      .map((p) => {
        // 只能看到与自己负责医院订单相关的就诊人
        const orders = ctx.db.orders.filter((o) => o.patientId === p.id && ctx.canHospital(o.hospitalId))
        return { p, orders }
      })
      .filter(({ orders }) => orders.length > 0)
      .filter(({ p, orders }) => !kw || p.name.includes(kw) || orders.some((o) => o.orderNo.includes(kw.toUpperCase())) || (kw.length >= 4 && p.contactPhone.endsWith(kw)))
      .map(({ p, orders }) => ({
        id: p.id,
        name: maskName(p.name),
        gender: p.gender,
        age: p.age,
        contactName: maskName(p.contactName),
        contactPhone: maskPhone(p.contactPhone),
        relationship: p.relationship,
        ownerNickname: ctx.db.users.find((u) => u.id === p.ownerUserId)?.nickname ?? '—',
        orderCount: orders.length,
        hospitals: [...new Set(orders.map((o) => o.locationSnapshot.hospitalName))],
        latestOrderNo: [...orders].sort((a, b) => b.createdAt - a.createdAt)[0]?.orderNo ?? null,
        updatedAt: p.updatedAt,
      }))
  })


export const revealPatient = (id: string, reason: string, detail: string) =>
  mutate((ctx) => {
    ctx.require('patient.reveal')
    const p = findOr404(ctx.db.patients, id, '就诊人')
    const related = ctx.db.orders.filter((o) => o.patientId === p.id && ctx.canHospital(o.hospitalId))
    if (!related.length) fail('FORBIDDEN', '该就诊人没有你负责范围内的订单，不能查看')
    const r = requireText(reason, '查看原因', 50)
    const full = detail.trim() ? `${r}：${detail.trim()}` : r
    ctx.audit({
      action: 'patient.reveal', targetType: '就诊人', targetId: p.id,
      summary: `查看 ${maskName(p.name)} 的完整资料（关联订单 ${related[0].orderNo}）`, reason: full,
    })
    return {
      id: p.id, name: p.name, contactName: p.contactName, contactPhone: p.contactPhone,
      expiresAt: ctx.now + 60_000,
    }
  })

export const exportPatients = () =>
  mutate((ctx) => {
    ctx.require('patient.export')
    fail('NOT_AVAILABLE', '演示环境不开放导出；正式环境需审批并记录用途')
  })
