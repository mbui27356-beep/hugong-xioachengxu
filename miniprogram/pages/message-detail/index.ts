import { messages } from '../../services/index'
import { fullDateTime } from '../../core/format'
import type { Message } from '../../core/types'

Page({
  data: { m: null as Message | null, when: '', error: '' },

  async onLoad(q: Record<string, string | undefined>) {
    const res = await messages.read(q.id || '')
    if (!res.ok) {
      this.setData({ error: res.error.message })
      return
    }
    this.setData({ m: res.data, when: fullDateTime(res.data.createdAt) })
  },

  openOrder() {
    wx.navigateTo({ url: `/pages/order-detail/index?id=${this.data.m!.orderId}` })
  },

  back() {
    wx.navigateBack()
  },
})
