import { messages } from '../services/index'

/** 在 tab 页 onShow 中调用：同步选中项与消息未读角标 */
export function syncTabBar(page: WechatMiniprogram.Page.TrivialInstance, selected: number) {
  const bar = typeof page.getTabBar === 'function' ? page.getTabBar() : null
  if (!bar) return
  bar.setData({ selected })
  messages.unread().then((res) => {
    if (res.ok) bar.setData({ badge: res.data })
  })
}
