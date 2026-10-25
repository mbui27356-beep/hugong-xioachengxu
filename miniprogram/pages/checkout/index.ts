import { agreements, catalog, newRequestId, orders, patients } from '../../services/index'
import { getDraft, patch, resetDraft } from '../../store/booking'
import { durationLabel } from '../../core/domain'
import { dateTime, genderLabel, maskPhone, money, moneyParts, phoneLabel, time } from '../../core/format'
import type { BedInfo, Patient, Quote } from '../../core/types'

Page({
  data: {
    scrolled: false,
    submitting: false,
    quote: null as Quote | null,
    locationLine: '',
    patient: null as Patient | null,
    isProxy: false,
    proxyConsent: false,
    patientMeta: '',
    contactPhone: '',
    bed: { room: '', bedNo: '', unsure: false } as BedInfo,
    pkgName: '',
    startLabel: '',
    endLabel: '',
    durationLabel: '',
    lines: [] as Array<{ label: string; detail: string; amount: string }>,
    totalInt: '0',
    totalDec: '00',
    expiresLabel: '',
    refundRule: '',
    providerName: '',
    servicePhone: '',
    servicePhoneLabel: '',
  },

  onLoad() {
    const d = getDraft()
    if (!d.quote || !d.offering) {
      wx.redirectTo({ url: '/pages/hospitals/index' })
      return
    }
    // 同一页面会话内复用请求号：双击或网络重试只创建一个订单
    if (!d.requestId) d.requestId = newRequestId()
    this.setData({ bed: d.bed })
    this.applyQuote(d.quote)
    catalog.settings().then((r) => r.ok && this.setData({ providerName: r.data.providerName, servicePhone: r.data.servicePhone, servicePhoneLabel: phoneLabel(r.data.servicePhone) }))
    agreements.getPublished(['REFUND']).then((r) => {
      if (!r.ok || !r.data.length) return
      this.setData({ refundRule: r.data[0].sections.map((s) => s.body).join('\n') })
    })
  },

  onShow() {
    this.loadPatient()
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 40
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  applyQuote(q: Quote) {
    const d = getDraft()
    const t = moneyParts(q.totalFen)
    const l = q.location
    this.setData({
      quote: q,
      locationLine: [l.campusName, l.departmentName, l.wardName].filter(Boolean).join(' · '),
      pkgName: d.offering!.pkg.name,
      startLabel: dateTime(q.startAt),
      endLabel: dateTime(q.endAt),
      durationLabel: durationLabel(q.units, d.offering!.pkg.unitHours),
      lines: q.lines.map((x) => ({ label: x.label, detail: x.detail, amount: money(x.amountFen) })),
      totalInt: t.int,
      totalDec: t.dec,
      expiresLabel: time(q.expiresAt),
    })
  },

  async loadPatient() {
    const res = await patients.list()
    if (!res.ok) return
    const d = getDraft()
    const p = res.data.find((x) => x.id === d.patientId) || res.data.find((x) => x.isDefault) || null
    patch({ patientId: p ? p.id : '' })
    this.setData({
      patient: p,
      patientMeta: p ? [genderLabel(p.gender), p.age !== null ? `${p.age} 岁` : ''].filter(Boolean).join(' · ') : '',
      isProxy: p ? p.contactRelation !== '本人' : false,
      contactPhone: p ? maskPhone(p.contactPhone) : '',
    })
  },

  pickPatient() {
    wx.navigateTo({ url: '/pages/patients/index?mode=select' })
  },

  onBed(e: WechatMiniprogram.Input) {
    const key = e.currentTarget.dataset.key as 'room' | 'bedNo'
    const bed = { ...this.data.bed, [key]: e.detail.value }
    this.setData({ bed })
    patch({ bed })
  },

  toggleProxy() {
    this.setData({ proxyConsent: !this.data.proxyConsent })
  },

  onUnsure(e: WechatMiniprogram.SwitchChange) {
    const bed = { ...this.data.bed, unsure: e.detail.value }
    this.setData({ bed })
    patch({ bed })
  },

  openAgreement() {
    wx.navigateTo({ url: '/pages/agreement/index?type=REFUND' })
  },

  call() {
    if (this.data.servicePhone) wx.makePhoneCall({ phoneNumber: this.data.servicePhone, fail: () => {} })
  },

  /** 提交前重新报价：报价过期或价格变化时请用户确认差异 */
  async ensureFreshQuote(): Promise<Quote | null> {
    const d = getDraft()
    const q = this.data.quote!
    if (q.expiresAt - Date.now() > 30 * 1000) return q
    const res = await orders.quote({ offeringId: q.offeringId, location: q.location, startAt: q.startAt, units: q.units, assessment: q.assessment })
    if (!res.ok) {
      wx.showModal({ title: '无法提交', content: res.error.message, showCancel: false })
      return null
    }
    d.quote = res.data
    this.applyQuote(res.data)
    if (res.data.totalFen !== q.totalFen) {
      const ok = await new Promise<boolean>((resolve) =>
        wx.showModal({
          title: '费用有变化',
          content: `合计由 ¥${money(q.totalFen)} 变为 ¥${money(res.data.totalFen)}，是否继续提交？`,
          confirmText: '继续提交',
          success: (r) => resolve(r.confirm),
        }),
      )
      return ok ? res.data : null
    }
    return res.data
  },

  async submit() {
    if (this.data.submitting) return
    const d = getDraft()
    if (!this.data.patient) {
      wx.showToast({ title: '请选择就诊人', icon: 'none' })
      return
    }
    if (this.data.isProxy && !this.data.proxyConsent) {
      wx.showToast({ title: '请确认已取得就诊人同意', icon: 'none' })
      return
    }
    const { bed } = this.data
    if (!bed.unsure && (!bed.room.trim() || !bed.bedNo.trim())) {
      wx.showToast({ title: '请填写病房与床号，或选择暂不确定', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    const q = await this.ensureFreshQuote()
    if (!q) {
      this.setData({ submitting: false })
      return
    }
    const res = await orders.create({ quoteId: q.id, patientId: this.data.patient.id, bed, consents: d.consents, proxyConsent: this.data.proxyConsent, requestId: d.requestId })
    this.setData({ submitting: false })
    if (!res.ok) {
      if (res.error.code === 'AGREEMENT_CHANGED') {
        patch({ consents: [] })
        wx.showModal({ title: '服务说明已更新', content: res.error.message, showCancel: false, success: () => wx.navigateTo({ url: '/pages/consent/index' }) })
        return
      }
      if (res.error.code === 'PRICE_CHANGED') {
        d.quote = { ...q, expiresAt: 0 }
        this.setData({ quote: d.quote })
      }
      wx.showModal({ title: '提交未成功', content: res.error.message, showCancel: false })
      return
    }
    const patientId = d.patientId
    resetDraft()
    patch({ patientId })
    wx.reLaunch({ url: `/pages/result/index?orderId=${res.data.id}` })
  },
})
