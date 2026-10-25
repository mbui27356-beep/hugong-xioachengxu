import { catalog } from '../../services/index'
import { setHospital } from '../../store/booking'
import { syncTabBar } from '../../core/tab'
import type { City, HospitalCard, HospitalGrade } from '../../core/types'

let searchTimer = 0

Page({
  data: {
    scrolled: false,
    keyword: '',
    cityId: '',
    gradeId: '',
    cities: [] as City[],
    grades: [] as HospitalGrade[],
    items: [] as HospitalCard[],
    nextCursor: null as string | null,
    loading: true,
    loadingMore: false,
    error: '',
    filtered: false,
    steps: [
      { t: '选择医院与科室', d: '精确到病区，护工直接到床旁。' },
      { t: '确认照护需求', d: '阅读服务说明，选择时间与套餐。' },
      { t: '人工核实后付款', d: '确认可安排人员后才开放支付。' },
      { t: '按时到岗服务', d: '订单与消息中随时查看进度。' },
    ],
  },

  onLoad() {
    catalog.filters().then((res) => {
      if (res.ok) this.setData({ cities: res.data.cities, grades: res.data.grades })
    })
    this.reload()
  },

  onShow() {
    syncTabBar(this, 0)
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 48
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  onPullDownRefresh() {
    this.reload().then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.nextCursor && !this.data.loadingMore) this.fetch(true)
  },

  reload() {
    this.setData({ items: [], nextCursor: null, error: '', filtered: !!(this.data.keyword || this.data.cityId || this.data.gradeId) })
    return this.fetch(false)
  },

  async fetch(more: boolean) {
    this.setData(more ? { loadingMore: true } : { loading: true })
    const { keyword, cityId, gradeId, nextCursor } = this.data
    const res = await catalog.listHospitals({ keyword, cityId, gradeId, cursor: more ? nextCursor : null })
    if (res.ok) {
      this.setData({ items: more ? this.data.items.concat(res.data.items) : res.data.items, nextCursor: res.data.nextCursor })
    } else {
      this.setData({ error: res.error.message })
    }
    this.setData({ loading: false, loadingMore: false })
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ keyword: e.detail.value })
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => this.reload(), 320) as unknown as number
  },

  onSearch() {
    clearTimeout(searchTimer)
    this.reload()
  },

  clearKeyword() {
    this.setData({ keyword: '' })
    this.reload()
  },

  pickCity(e: WechatMiniprogram.TouchEvent) {
    this.setData({ cityId: e.currentTarget.dataset.id as string })
    this.reload()
  },

  pickGrade(e: WechatMiniprogram.TouchEvent) {
    this.setData({ gradeId: e.currentTarget.dataset.id as string })
    this.reload()
  },

  clearAll() {
    this.setData({ keyword: '', cityId: '', gradeId: '' })
    this.reload()
  },

  openHospital(e: WechatMiniprogram.TouchEvent) {
    const h = this.data.items[Number(e.currentTarget.dataset.index)]
    setHospital(h)
    wx.navigateTo({ url: `/pages/location/index?hospitalId=${h.id}` })
  },

  openHelp() {
    wx.navigateTo({ url: '/pages/help/index' })
  },
})
