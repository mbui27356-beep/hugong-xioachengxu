import { agreements } from '../../services/index'
import { date } from '../../core/format'
import type { Agreement, AgreementType } from '../../core/types'

Page({
  data: { scrolled: false, doc: {} as Agreement, published: '', error: '' },

  async onLoad(q: Record<string, string | undefined>) {
    const res = await agreements.getPublished([(q.type || 'SERVICE') as AgreementType])
    if (!res.ok || !res.data.length) {
      this.setData({ error: res.ok ? '未找到该协议' : res.error.message })
      return
    }
    this.setData({ doc: res.data[0], published: date(res.data[0].publishedAt) })
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 40
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },
})
