import { agreements } from '../../services/index'
import { patch } from '../../store/booking'
import { date } from '../../core/format'
import type { Agreement } from '../../core/types'

Page({
  data: {
    scrolled: false,
    loading: true,
    error: '',
    service: {} as Agreement,
    others: [] as Agreement[],
    all: [] as Agreement[],
    publishedLabel: '',
    checks: [] as Array<{ id: string; text: string; on: boolean }>,
    allOn: false,
  },

  onLoad() {
    this.load()
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 40
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  async load() {
    this.setData({ loading: true, error: '' })
    const res = await agreements.getPublished(['SERVICE', 'PRIVACY', 'REFUND'])
    if (!res.ok) {
      this.setData({ loading: false, error: res.error.message })
      return
    }
    const service = res.data.find((a) => a.type === 'SERVICE')!
    const others = res.data.filter((a) => a.type !== 'SERVICE')
    // 默认均不勾选
    const checks = res.data.map((a) => ({
      id: a.id,
      on: false,
      text: a.type === 'SERVICE' ? `我已阅读并理解《${a.title}》` : `我已阅读《${a.title}》`,
    }))
    this.setData({ loading: false, service, others, all: res.data, checks, publishedLabel: date(service.publishedAt), allOn: false })
  },

  toggle(e: WechatMiniprogram.TouchEvent) {
    const i = Number(e.currentTarget.dataset.index)
    const checks = this.data.checks.slice()
    checks[i] = { ...checks[i], on: !checks[i].on }
    this.setData({ checks, allOn: checks.every((c) => c.on) })
  },

  openDoc(e: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/agreement/index?type=${e.currentTarget.dataset.type}` })
  },

  decline() {
    wx.navigateBack()
  },

  accept() {
    if (!this.data.allOn) {
      wx.showToast({ title: '请先逐项确认', icon: 'none' })
      return
    }
    patch({ consents: this.data.all.map((a) => ({ agreementId: a.id, type: a.type, version: a.version })) })
    wx.redirectTo({ url: '/pages/service/index' })
  },
})
