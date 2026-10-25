// app.ts
import { getLayout } from './core/layout'

App<IAppOption>({
  globalData: {},
  onLaunch() {
    // 预先计算状态栏与胶囊按钮位置，供自定义导航栏复用
    this.globalData.layout = getLayout()
  },
})
