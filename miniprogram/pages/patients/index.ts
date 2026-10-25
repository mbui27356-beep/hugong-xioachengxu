import { patients } from '../../services/index'
import { getDraft, patch } from '../../store/booking'
import { genderLabel, maskPhone } from '../../core/format'
import type { Patient } from '../../core/types'

type Row = Patient & { meta: string; phone: string; initial: string }

Page({
  data: {
    scrolled: false,
    selectMode: false,
    selectedId: '',
    loading: true,
    error: '',
    list: [] as Row[],
  },

  onLoad(q: Record<string, string | undefined>) {
    this.setData({ selectMode: q.mode === 'select', selectedId: getDraft().patientId })
  },

  onShow() {
    this.load()
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 48
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  async load() {
    if (!this.data.list.length) this.setData({ loading: true })
    const res = await patients.list()
    if (!res.ok) {
      this.setData({ loading: false, error: res.error.message })
      return
    }
    const list = res.data.map((p) => ({
      ...p,
      initial: p.name.slice(0, 1),
      meta: [genderLabel(p.gender), p.age !== null ? `${p.age} 岁` : '', p.contactRelation === '本人' ? '本人预约' : '家属代约'].filter(Boolean).join(' · '),
      phone: maskPhone(p.contactPhone),
    }))
    this.setData({ loading: false, error: '', list })
  },

  onTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (!this.data.selectMode) {
      wx.navigateTo({ url: `/pages/patient-edit/index?id=${id}` })
      return
    }
    this.setData({ selectedId: id })
    patch({ patientId: id })
    setTimeout(() => wx.navigateBack(), 160)
  },

  edit(e: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/patient-edit/index?id=${e.currentTarget.dataset.id}` })
  },

  add() {
    wx.navigateTo({ url: `/pages/patient-edit/index${this.data.selectMode ? '?select=1' : ''}` })
  },
})
