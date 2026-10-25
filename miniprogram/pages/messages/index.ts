import { messages } from '../../services/index'
import { relative } from '../../core/format'
import { syncTabBar } from '../../core/tab'
import type { Message } from '../../core/types'

Page({
  data: {
    scrolled: false,
    loading: true,
    error: '',
    list: [] as Array<Message & { when: string }>,
    unread: 0,
  },

  onShow() {
    this.load()
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 48
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  async load() {
    syncTabBar(this, 2)
    const res = await messages.list()
    if (!res.ok) {
      this.setData({ loading: false, error: res.error.message })
      return
    }
    const now = Date.now()
    this.setData({
      loading: false,
      error: '',
      list: res.data.map((m) => ({ ...m, when: relative(m.createdAt, now) })),
      unread: res.data.filter((m) => !m.readAt).length,
    })
  },

  open(e: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/message-detail/index?id=${e.currentTarget.dataset.id}` })
  },

  async readAll() {
    await messages.readAll()
    this.load()
  },
})
