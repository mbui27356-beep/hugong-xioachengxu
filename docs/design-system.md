# 设计规范（小程序与管理后台共用）

方向：Apple 的克制与层级 + OpenAI 的单色与留白。内容优先，装饰最少；一屏只有一个主操作。

## 颜色

| Token | 值 | 用途 |
|---|---|---|
| label | #1D1D1F | 主文字、主按钮底色 |
| label-2 | #6E6E73 | 次要文字 |
| label-3 | #86868B | 辅助说明、占位 |
| label-4 | #AEAEB2 | 禁用、箭头 |
| bg | #F5F5F7 | 页面底色 |
| surface | #FFFFFF | 卡片、分组列表 |
| separator | rgba(0,0,0,0.08) | 发丝分割线 |
| fill | rgba(118,118,128,0.12) | 输入框、分段控件底 |
| accent | #0071E3（按下 #0062C4） | 链接、选中、焦点 |
| success | #1F9D55 / 浅底 #E8F5EC | 服务中、成功 |
| warning | #B25E00 / 浅底 #FFF4E5 | 待确认、需关注 |
| danger | #D70015 / 浅底 #FDECEE | 错误、退款失败 |
| indigo | #5E5CE6 / 浅底 #EFEFFD | 待服务 |

订单状态：待确认 warning，待支付 accent，待服务 indigo，服务中 success，已完成/已取消/已拒绝 label-3 灰。

## 字体

`-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif`；数字用 `font-variant-numeric: tabular-nums`。

| 层级 | 字号/行高/字重 | 字距 |
|---|---|---|
| Large Title | 34/41 700 | -0.4px |
| Title 2 | 22/28 600 | -0.3px |
| Headline | 17/22 600 | -0.2px |
| Body | 17/24 400 | — |
| Subhead | 15/20 400 | — |
| Footnote | 13/18 400 | — |
| Caption | 12/16 500 | 0.2px |

小程序按 1px ≈ 2rpx 换算。

## 形状与层次

- 圆角：控件 12px，卡片 20px，按钮与标签为胶囊。
- 阴影只用于浮层：`0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)`；普通卡片靠白底与灰底对比，不加描边。
- 毛玻璃导航/标签栏：`rgba(255,255,255,.72)` + `backdrop-filter: saturate(180%) blur(20px)`，底部发丝线。
- 间距 4 的倍数；页面左右边距 16px（小程序 32rpx），分组间距 28–36px。

## 组件

- 主按钮：黑色胶囊，白字 17/600，高 50px；按下缩放 0.98、透明度 0.85。次按钮：fill 底黑字。文字按钮：accent。
- 分组列表（iOS Settings 风格）：白底圆角 20px，行高 ≥ 52px，行间发丝线左缩进，右侧箭头 label-4。
- 分段控件：fill 底，选中项白底 + 轻阴影。
- 状态标签：浅底深字胶囊，12/500。
- 空状态：线性图标 + 一句标题 + 一句说明 + 一个操作。
- 动效：200–300ms `cubic-bezier(.2,.8,.2,1)`；不做花哨转场。

## 文案

短句、动词开头、不用感叹号。演示数据显著标注“演示”。金额以“¥”+ 两位小数展示，内部一律整数分。
