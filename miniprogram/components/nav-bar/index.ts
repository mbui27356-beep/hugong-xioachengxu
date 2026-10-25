import { getLayout } from '../../core/layout'

Component({
  options: { multipleSlots: true, styleIsolation: 'apply-shared' },
  properties: {
    title: { type: String, value: '' },
    back: { type: Boolean, value: true },
    /** 页面滚动后显示毛玻璃底与标题（大标题收起效果） */
    scrolled: { type: Boolean, value: false },
    alwaysTitle: { type: Boolean, value: false },
    solid: { type: Boolean, value: false },
  },
  data: { statusBar: 20, navHeight: 44, capsuleWidth: 96 },
  lifetimes: {
    attached() {
      const l = getLayout()
      this.setData({ statusBar: l.statusBar, navHeight: l.navHeight, capsuleWidth: l.capsuleWidth })
    },
  },
  methods: {
    onBack() {
      if (getCurrentPages().length > 1) wx.navigateBack()
      else wx.switchTab({ url: '/pages/hospitals/index' })
    },
  },
})
