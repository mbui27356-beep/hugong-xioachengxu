import { catalog, orders, refunds } from '../../services/index'
import { payOrder } from '../../services/payment'
import { durationLabel, orderActions } from '../../core/domain'
import { BUSINESS_STATUS, displayStatus, PAYMENT_STATUS, REFUND_STATUS } from '../../core/status'
import { dateTime, fullDateTime, genderLabel, maskPhone, money, phoneLabel, time } from '../../core/format'
import type { BusinessStatus, Order } from '../../core/types'

const STEPS = ['提交', '确认', '支付', '服务中', '完成']
const STEP_INDEX: Partial<Record<BusinessStatus, number>> = {
  PENDING_CONFIRM: 0,
  PENDING_PAYMENT: 1,
  PENDING_SERVICE: 2,
  IN_SERVICE: 3,
  COMPLETED: 4,
}

const CANCEL_REASONS = ['计划有变', '已找到其他陪护', '信息填写有误', '其他原因']

Page({
  data: {
    scrolled: false,
    id: '',
    autoPay: false,
    loading: true,
    error: '',
    paying: false,
    o: null as Order | null,
    status: { label: '', tone: 'neutral' },
    hint: '',
    progress: [] as Array<{ label: string; done: boolean; current: boolean }>,
    progressPct: 0,
    deadline: '',
    place: '',
    bedLabel: '',
    startLabel: '',
    endLabel: '',
    duration: '',
    patientMeta: '',
    contactPhone: '',
    caregiverInitial: '',
    exText: '',
    lines: [] as Array<{ label: string; detail: string; amount: string }>,
    total: '',
    paymentLabel: '',
    paidRecords: [] as Array<{ outTradeNo: string; amount: string; time: string }>,
    refundRecords: [] as Array<{ outRefundNo: string; reason: string; time: string; label: string; tone: string }>,
    events: [] as Array<{ at: number; title: string; detail: string; time: string }>,
    createdLabel: '',
    consentVersion: 0,
    actions: { pay: false, cancel: false, refund: false, rebook: false },
    servicePhone: '',
    servicePhoneLabel: '',
  },

  onLoad(q: Record<string, string | undefined>) {
    this.setData({ id: q.id || '', autoPay: q.pay === '1' })
    catalog.settings().then((r) => r.ok && this.setData({ servicePhone: r.data.servicePhone, servicePhoneLabel: phoneLabel(r.data.servicePhone) }))
  },

  onShow() {
    this.load().then(() => {
      if (this.data.autoPay && this.data.actions.pay) {
        this.setData({ autoPay: false })
        this.pay()
      }
    })
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 40
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  async load() {
    const res = await orders.detail(this.data.id)
    if (!res.ok) {
      this.setData({ loading: false, error: res.error.message })
      return
    }
    this.render(res.data)
  },

  render(o: Order) {
    const l = o.location
    const idx = STEP_INDEX[o.businessStatus]
    const actions = orderActions(o)
    this.setData({
      loading: false,
      error: '',
      o,
      status: displayStatus(o),
      hint: BUSINESS_STATUS[o.businessStatus].hint,
      progress: idx === undefined ? [] : STEPS.map((label, i) => ({ label, done: i < idx || idx === 4, current: i === idx && idx !== 4 })),
      progressPct: idx === undefined ? 0 : (idx / 4) * 100,
      deadline: actions.pay && o.paymentDeadline ? time(o.paymentDeadline) : '',
      place: [l.campusName, l.departmentName, l.wardName].filter(Boolean).join(' · '),
      bedLabel: o.bed.unsure ? '待确认' : `${o.bed.room} 房 ${o.bed.bedNo} 床`,
      startLabel: dateTime(o.startAt),
      endLabel: dateTime(o.endAt),
      duration: durationLabel(o.units, o.pkg.unitHours),
      patientMeta: [genderLabel(o.patient.gender), o.patient.age !== null ? `${o.patient.age} 岁` : ''].filter(Boolean).join(' · '),
      contactPhone: maskPhone(o.contact.phone),
      caregiverInitial: o.caregiver ? o.caregiver.name.slice(0, 1) : '',
      exText: o.pkg.exclusions.join('、'),
      lines: o.lines.map((x) => ({ label: x.label, detail: x.detail, amount: money(x.amountFen) })),
      total: money(o.totalFen),
      paymentLabel: PAYMENT_STATUS[o.paymentStatus],
      paidRecords: o.payments.filter((p) => p.status === 'SUCCESS').map((p) => ({ outTradeNo: p.outTradeNo, amount: money(p.amountFen), time: p.paidAt ? fullDateTime(p.paidAt) : '' })),
      refundRecords: o.refunds.map((r) => ({ outRefundNo: r.outRefundNo, reason: r.reason, time: fullDateTime(r.createdAt), label: REFUND_STATUS[r.status].label, tone: REFUND_STATUS[r.status].tone })),
      events: o.events.slice().reverse().map((e) => ({ ...e, time: fullDateTime(e.at) })),
      createdLabel: fullDateTime(o.createdAt),
      consentVersion: (o.consents.find((c) => c.type === 'SERVICE') || { version: 0 }).version,
      actions,
    })
  },

  async pay() {
    if (this.data.paying) return
    this.setData({ paying: true })
    wx.showLoading({ title: '正在下单', mask: true })
    const outcome = await payOrder(this.data.o!.id)
    wx.hideLoading()
    this.setData({ paying: false })
    if (outcome.status === 'PAID') {
      wx.vibrateShort({ type: 'medium' })
      wx.showToast({ title: '支付成功', icon: 'success' })
    } else if (outcome.status === 'PENDING') {
      wx.showModal({ title: '支付结果确认中', content: '如已付款请勿重复支付，稍后刷新订单查看。', showCancel: false })
    } else if (outcome.status === 'ERROR') {
      wx.showModal({ title: '暂时无法支付', content: outcome.message, showCancel: false })
    }
    this.load()
  },

  cancel() {
    const o = this.data.o!
    wx.showActionSheet({
      itemList: CANCEL_REASONS,
      success: (sheet) => {
        const reason = CANCEL_REASONS[sheet.tapIndex]
        wx.showModal({
          title: '取消这次预约？',
          content: '尚未付款，取消后不产生费用，已预留的人员将被释放。',
          confirmText: '取消预约',
          confirmColor: '#D70015',
          cancelText: '再想想',
          success: async (r) => {
            if (!r.confirm) return
            wx.showLoading({ title: '正在取消', mask: true })
            const res = await orders.cancel(o.id, reason, o.version)
            wx.hideLoading()
            if (!res.ok) {
              wx.showModal({ title: '未能取消', content: res.error.message, showCancel: false })
              this.load()
              return
            }
            wx.showToast({ title: '已取消', icon: 'none' })
            this.render(res.data)
          },
        })
      },
    })
  },

  refund() {
    const o = this.data.o!
    wx.showModal({
      title: '申请售后',
      editable: true,
      placeholderText: '请简要说明原因，如提前出院',
      confirmText: '提交申请',
      success: async (r) => {
        if (!r.confirm) return
        const reason = (r.content || '').trim()
        if (!reason) {
          wx.showToast({ title: '请填写申请原因', icon: 'none' })
          return
        }
        const res = await refunds.request(o.id, reason, o.version)
        if (!res.ok) {
          wx.showModal({ title: '未能提交', content: res.error.message, showCancel: false })
          this.load()
          return
        }
        wx.showToast({ title: '已提交', icon: 'success' })
        this.render(res.data)
      },
    })
  },

  rebook() {
    wx.switchTab({ url: '/pages/hospitals/index' })
  },

  callCaregiver() {
    const c = this.data.o!.caregiver
    if (c) wx.makePhoneCall({ phoneNumber: c.phone, fail: () => {} })
  },

  callService() {
    if (this.data.servicePhone) wx.makePhoneCall({ phoneNumber: this.data.servicePhone, fail: () => {} })
  },

  copyNo() {
    wx.setClipboardData({ data: this.data.o!.orderNo })
  },

  openAgreement() {
    wx.navigateTo({ url: '/pages/agreement/index?type=SERVICE' })
  },

  backToList() {
    wx.switchTab({ url: '/pages/orders/index' })
  },
})
