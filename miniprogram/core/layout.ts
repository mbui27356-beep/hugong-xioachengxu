export interface Layout {
  statusBar: number
  navHeight: number
  capsuleWidth: number
  windowWidth: number
}

let cached: Layout | null = null

export function getLayout(): Layout {
  if (cached) return cached
  const win = wx.getSystemInfoSync()
  const menu = wx.getMenuButtonBoundingClientRect()
  const statusBar = win.statusBarHeight || 20
  const gap = menu.top - statusBar
  cached = {
    statusBar,
    navHeight: gap > 0 ? gap * 2 + menu.height : 44,
    capsuleWidth: menu.left > 0 ? win.windowWidth - menu.left : 96,
    windowWidth: win.windowWidth,
  }
  return cached
}
