import { catalog, orders } from '../../services/index'
import { getDraft, patch } from '../../store/booking'
import { assessmentComplete, earliestStart, endAt, priceLines } from '../../core/domain'
import { ASSESSMENT_ITEMS, ASSESSMENT_OPTIONS } from '../../core/status'
import { DAY, HOUR, date, dayLabel, moneyParts, parts, startOfDay, time, weekday } from '../../core/format'
import type { Assessment, AssessmentAnswer, AssessmentKey, OfferingView, ServiceSettings } from '../../core/types'

type OfferingCard = OfferingView & { priceInt: string; priceDec: string; exText: string }

const HOURS = Array.from({ length: 24 }, (_, i) => `${i < 10 ? '0' : ''}${i} 时`)
const MINUTES = ['00 分', '30 分']

Page({
  data: {
    scrolled: false,
    loading: true,
    error: '',
    submitting: false,
    locationLabel: '',
    offerings: [] as OfferingCard[],
    offeringId: '',
    settings: null as ServiceSettings | null,
    days: [] as number[],
    columns: [[], HOURS, MINUTES] as string[][],
    pickerValue: [0, 0, 0],
    startAt: 0,
    startLabel: '',
    startError: '',
    startHint: '',
    units: 1,
    maxUnits: 30,
    unitLabel: '天',
    endLabel: '',
    items: ASSESSMENT_ITEMS,
    options: ASSESSMENT_OPTIONS,
    assessment: {} as Assessment,
    answered: 0,
    estInt: '0',
    estDec: '00',
    canNext: false,
  },

  onLoad() {
    const d = getDraft()
    if (!d.location) {
      wx.redirectTo({ url: '/pages/hospitals/index' })
      return
    }
    const l = d.location
    this.setData({
      locationLabel: [l.hospitalName, l.campusName, l.departmentName, l.wardName].filter(Boolean).join(' · '),
      units: d.units,
      assessment: d.assessment,
      answered: ASSESSMENT_ITEMS.filter((i) => !!d.assessment[i.key]).length,
    })
    this.load()
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 40
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  async load() {
    const d = getDraft()
    this.setData({ loading: true, error: '' })
    const [s, o] = await Promise.all([catalog.settings(), catalog.listOfferings(d.location!)])
    if (!s.ok || !o.ok) {
      this.setData({ loading: false, error: (!s.ok ? s.error.message : !o.ok ? o.error.message : '') || '加载失败' })
      return
    }
    const offerings: OfferingCard[] = o.data.map((x) => {
      const p = moneyParts(x.unitPriceFen)
      return { ...x, priceInt: p.int, priceDec: p.dec, exText: x.pkg.exclusions.join('、') }
    })
    const prevId = d.offering ? d.offering.id : ''
    const offeringId = offerings.some((x) => x.id === prevId) ? prevId : offerings.length === 1 ? offerings[0].id : ''
    this.setData({ loading: false, offerings, offeringId, settings: s.data })
    this.buildDays(d.startAt)
    this.recompute()
  },

  /** 构造日期列：从最早可预约日起 maxAdvanceDays 天 */
  buildDays(preferred: number) {
    const s = this.data.settings!
    const now = Date.now()
    const earliest = earliestStart(now, s.leadTimeMinutes)
    const first = startOfDay(earliest)
    const days = Array.from({ length: s.maxAdvanceDays }, (_, i) => first + i * DAY)
    const labels = days.map((t) => {
      const rel = dayLabel(t, now)
      return rel === date(t) ? `${date(t)} ${weekday(t)}` : `${rel} ${date(t)}`
    })
    const start = preferred && preferred >= earliest ? preferred : earliest
    const p = parts(start)
    const di = Math.max(0, days.findIndex((t) => t === startOfDay(start)))
    this.setData({
      days,
      columns: [labels, HOURS, MINUTES],
      pickerValue: [di, p.h, p.min >= 30 ? 1 : 0],
      startAt: start,
      startHint: `最早可预约 ${dayLabel(earliest, now)} ${time(earliest)}，需提前 ${s.leadTimeMinutes / 60} 小时`,
    })
  },

  onColumn(e: WechatMiniprogram.CustomEvent<{ column: number; value: number }>) {
    const v = this.data.pickerValue.slice()
    v[e.detail.column] = e.detail.value
    this.setData({ pickerValue: v })
  },

  onPick(e: WechatMiniprogram.CustomEvent<{ value: number[] }>) {
    const [di, h, mi] = e.detail.value
    const startAt = this.data.days[di] + h * HOUR + (mi ? 30 : 0) * 60 * 1000
    this.setData({ pickerValue: e.detail.value, startAt })
    this.recompute()
  },

  pickOffering(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (id !== this.data.offeringId) {
      this.setData({ offeringId: id })
      wx.vibrateShort({ type: 'light' })
      this.recompute()
    }
  },

  dec() {
    if (this.data.units > 1) {
      this.setData({ units: this.data.units - 1 })
      this.recompute()
    }
  },

  inc() {
    if (this.data.units < this.data.maxUnits) {
      this.setData({ units: this.data.units + 1 })
      this.recompute()
    }
  },

  answer(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as AssessmentKey
    const value = e.currentTarget.dataset.value as AssessmentAnswer
    const assessment = { ...this.data.assessment, [key]: value }
    this.setData({ assessment, answered: ASSESSMENT_ITEMS.filter((i) => !!assessment[i.key]).length })
    this.recompute()
  },

  recompute() {
    const { offerings, offeringId, units, startAt, assessment, settings } = this.data
    const o = offerings.find((x) => x.id === offeringId)
    const unitHours = o ? o.pkg.unitHours : 24
    const est = o ? priceLines(o.pkg, o.unitPriceFen, units).totalFen : 0
    const p = moneyParts(est)
    const earliest = settings ? earliestStart(Date.now(), settings.leadTimeMinutes) : 0
    const startError = startAt && startAt < earliest ? `所选时间已过最早可预约时间，请重新选择` : ''
    const end = endAt(startAt, units, unitHours)
    this.setData({
      unitLabel: o ? o.pkg.unitLabel : '天',
      maxUnits: o ? o.maxUnits : 30,
      startLabel: startAt ? `${dayLabel(startAt)} ${time(startAt)}` : '请选择',
      endLabel: startAt ? `${dayLabel(end)} ${date(end)} ${time(end)}` : '—',
      startError,
      estInt: p.int,
      estDec: p.dec,
      canNext: !!o && !startError && assessmentComplete(assessment),
    })
    patch({ offering: o || null, units, startAt, assessment })
  },

  async next() {
    const { offeringId, startAt, units, assessment, canNext, submitting } = this.data
    if (submitting) return
    if (!canNext) {
      const msg = !offeringId ? '请选择套餐' : this.data.startError ? '请重新选择到岗时间' : '请完成照护需求评估'
      wx.showToast({ title: msg, icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    const res = await orders.quote({ offeringId, location: getDraft().location!, startAt, units, assessment })
    this.setData({ submitting: false })
    if (!res.ok) {
      wx.showModal({ title: '无法核算费用', content: res.error.message, showCancel: false, confirmText: '知道了' })
      return
    }
    getDraft().quote = res.data
    wx.navigateTo({ url: '/pages/checkout/index' })
  },
})

