Component({
  data: {
    selected: 0,
    badge: 0,
    tabs: [
      { path: '/pages/hospitals/index', text: '预约陪护', icon: 'calendar', iconOn: 'calendar-fill', badge: false },
      { path: '/pages/orders/index', text: '订单', icon: 'orders', iconOn: 'orders-fill', badge: false },
      { path: '/pages/messages/index', text: '消息', icon: 'bell', iconOn: 'bell-fill', badge: true },
    ],
  },
  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget.dataset.index)
      if (index === this.data.selected) return
      wx.switchTab({ url: this.data.tabs[index].path })
    },
  },
})
