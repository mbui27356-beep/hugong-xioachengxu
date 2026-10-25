import { sumFen } from '../../../../packages/domain/money'
import { DAY, startOfDayShanghai } from '../../../../packages/domain/time'
import { query } from '../../core/ctx'
import { toOrderRow } from './orders'

// 工作台：区分预约金额（下单总额）、实收金额（支付成功）与已退金额（退款成功）。

export const getOverview = () =>
  query((ctx) => {
    ctx.require('dashboard.view')
    const { db, now } = ctx
    const today = startOfDayShanghai(now)
    const orders = db.orders.filter((o) => ctx.canHospital(o.hospitalId))
    const ids = new Set(orders.map((o) => o.id))
    const occupied = new Set(db.assignments.filter((a) => ['RESERVED', 'ACTIVE'].includes(a.status)).map((a) => a.orderId))

    const pendingConfirm = orders.filter((o) => o.businessStatus === 'PENDING_CONFIRM').length
    const needDispatch = orders.filter((o) => ['PENDING_PAYMENT', 'PENDING_SERVICE'].includes(o.businessStatus) && !occupied.has(o.id)).length
    const arrivingToday = orders.filter(
      (o) => ['PENDING_SERVICE', 'IN_SERVICE'].includes(o.businessStatus) && o.startAt >= today && o.startAt < today + DAY,
    ).length
    const refunds = db.refunds.filter((r) => ids.has(r.orderId))
    const refundTodo = refunds.filter((r) => ['REQUESTED', 'APPROVED', 'FAILED'].includes(r.status)).length

    const since = today - 29 * DAY
    const inWindow = (t: number) => t >= since
    const bookedFen = sumFen(orders.filter((o) => inWindow(o.createdAt) && o.businessStatus !== 'REJECTED' && !(o.businessStatus === 'CANCELLED' && o.paymentStatus === 'UNPAID')).map((o) => o.totalFen))
    const payments = db.payments.filter((p) => ids.has(p.orderId) && p.status === 'SUCCESS' && p.paidAt && inWindow(p.paidAt))
    const receivedFen = sumFen(payments.map((p) => p.amountFen))
    const refundedFen = sumFen(refunds.filter((r) => r.status === 'SUCCEEDED' && inWindow(r.updatedAt)).map((r) => r.amountFen))

    const days = 14
    const trend = Array.from({ length: days }, (_, i) => {
      const start = today - (days - 1 - i) * DAY
      const dayOrders = orders.filter((o) => o.createdAt >= start && o.createdAt < start + DAY)
      return {
        day: start,
        orders: dayOrders.length,
        receivedFen: sumFen(db.payments.filter((p) => ids.has(p.orderId) && p.status === 'SUCCESS' && p.paidAt && p.paidAt >= start && p.paidAt < start + DAY).map((p) => p.amountFen)),
      }
    })

    const inService = orders.filter((o) => o.businessStatus === 'IN_SERVICE').length
    const onDuty = db.caregivers.filter((c) => c.duty === 'ON_DUTY').length
    const recent = [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6).map((o) => toOrderRow(ctx, o))

    return {
      kpis: { pendingConfirm, needDispatch, arrivingToday, refundTodo },
      money: { bookedFen, receivedFen, refundedFen, windowDays: 30 },
      trend,
      inService,
      onDuty,
      caregiverTotal: db.caregivers.length,
      recent,
      scopeAll: ctx.admin.allowedHospitalIds === '*',
    }
  })
