import { orders, patients } from '../../services/index'
import { orderActions } from '../../core/domain'
import { displayStatus, ORDER_TABS } from '../../core/status'
import { money, range, time } from '../../core/format'
import { syncTabBar } from '../../core/tab'
import type { Order } from '../../core/types'

type Row = Order & { statusLabel: string; tone: string; place: string; range: string; total: string; canPay: boolean; deadline: string }

Page({
  data: {
    scrolled: false,
    tabs: ORDER_TABS,
    tab: 'ALL',
    patientIds: [''] as string[],
    patientNames: ['全部就诊人'] as string[],
    patientIndex: 0,
    list: [] as Row[],
    loading: true,
    error: '',
  },

  onShow() {
    syncTabBar(this, 1)
    this.loadPatients()
    this.load()
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 48
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  async loadPatients() {
    const res = await patients.list()
    if (!res.ok) return
    const current = this.data.patientIds[this.data.patientIndex]
    const ids = [''].concat(res.data.map((p) => p.id))
    this.setData({ patientIds: ids, patientNames: ['全部就诊人'].concat(res.data.map((p) => p.name)), patientIndex: Math.max(0, ids.indexOf(current)) })
  },

  async load() {
    this.setData({ loading: true, error: '' })
    const res = await orders.list({ tab: this.data.tab, patientId: this.data.patientIds[this.data.patientIndex] })
    if (!res.ok) {
      this.setData({ loading: false, error: res.error.message })
      return
    }
    const list: Row[] = res.data.map((o) => {
      const s = displayStatus(o)
      const l = o.location
      const canPay = orderActions(o).pay
      return {
        ...o,
        statusLabel: s.label,
        tone: s.tone,
        place: [l.campusName, l.departmentName, l.wardName].filter(Boolean).join(' · '),
        range: range(o.startAt, o.endAt),
        total: money(o.totalFen),
        canPay,
        deadline: canPay && o.paymentDeadline ? time(o.paymentDeadline) : '',
      }
    })
    this.setData({ loading: false, list })
  },

  pickTab(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.key as string
    if (tab === this.data.tab) return
    this.setData({ tab, list: [] })
    this.load()
  },

  pickPatient(e: WechatMiniprogram.PickerChange) {
    this.setData({ patientIndex: Number(e.detail.value), list: [] })
    this.load()
  },

  open(e: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/order-detail/index?id=${e.currentTarget.dataset.id}` })
  },

  pay(e: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/order-detail/index?id=${e.currentTarget.dataset.id}&pay=1` })
  },

  book() {
    wx.switchTab({ url: '/pages/hospitals/index' })
  },
})
