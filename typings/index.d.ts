/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    /** 布局信息：状态栏与胶囊按钮，供自定义导航栏使用 */
    layout?: { statusBar: number; navHeight: number; capsuleWidth: number; windowWidth: number }
  }
}
