import { account, catalog } from '../../services/index'
import { phoneLabel } from '../../core/format'
import { resetDraft } from '../../store/booking'
import type { DemoUser } from '../../core/types'

Page({
  data: {
    scrolled: false,
    providerName: '',
    phone: '',
    phoneText: '',
    nickname: '',
    docs: [
      { type: 'SERVICE', title: '预约及服务知情说明', icon: 'shield' },
      { type: 'PRIVACY', title: '隐私告知', icon: 'lock' },
      { type: 'REFUND', title: '取消与退款规则', icon: 'wallet' },
    ],
  },

  onLoad() {
    catalog.settings().then((r) => r.ok && this.setData({ providerName: r.data.providerName, phone: r.data.servicePhone, phoneText: phoneLabel(r.data.servicePhone) }))
  },

  onShow() {
    account.me().then((r) => this.setData({ nickname: r.ok ? r.data.nickname : '未连接' }))
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 48
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  openPatients() {
    wx.navigateTo({ url: '/pages/patients/index' })
  },

  openDoc(e: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/agreement/index?type=${e.currentTarget.dataset.type}` })
  },

  call() {
    if (this.data.phone) wx.makePhoneCall({ phoneNumber: this.data.phone, fail: () => {} })
  },

  /** ⚠ 演示：切换模拟账号，用于验证不同用户数据隔离 */
  async switchUser() {
    const r = await account.demoUsers()
    if (!r.ok) {
      wx.showToast({ title: r.error.message, icon: 'none' })
      return
    }
    const users: DemoUser[] = r.data
    wx.showActionSheet({
      itemList: users.map((u) => u.nickname),
      success: (sheet) => {
        account.switchDemoUser(users[sheet.tapIndex].id)
        resetDraft()
        this.setData({ nickname: users[sheet.tapIndex].nickname })
        wx.showToast({ title: '已切换', icon: 'success' })
      },
    })
  },
})
