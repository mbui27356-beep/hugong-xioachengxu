import { catalog, orders } from '../../services/index'
import { dateTime } from '../../core/format'
import type { Order } from '../../core/types'

Page({
  data: {
    order: null as Order | null,
    startLabel: '',
    confirmMinutes: 30,
    steps: [
      { t: '核实需求，安排人员', d: '客服电话联系你确认照护细节' },
      { t: '确认后付款', d: '收到通知后，在订单中完成微信支付' },
      { t: '护工到岗', d: '按约定时间到达病房开始服务' },
    ],
  },

  async onLoad(q: Record<string, string | undefined>) {
    const [res, s] = await Promise.all([orders.detail(q.orderId || ''), catalog.settings()])
    if (s.ok) this.setData({ confirmMinutes: s.data.confirmWithinMinutes })
    if (!res.ok) {
      wx.showModal({ title: '无法加载订单', content: res.error.message, showCancel: false, success: () => this.home() })
      return
    }
    this.setData({ order: res.data, startLabel: dateTime(res.data.startAt) })
    wx.vibrateShort({ type: 'medium' })
  },

  copy() {
    wx.setClipboardData({ data: this.data.order!.orderNo })
  },

  viewOrder() {
    wx.redirectTo({ url: `/pages/order-detail/index?id=${this.data.order!.id}` })
  },

  home() {
    wx.switchTab({ url: '/pages/hospitals/index' })
  },
})
