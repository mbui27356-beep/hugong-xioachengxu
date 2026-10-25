export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'indigo' | 'muted'

export interface SelectOption {
  label: string
  value: string
  disabled?: boolean
}

export interface SegmentOption {
  label: string
  value: string
  count?: number
}

export interface Column {
  key: string
  label: string
  width?: string
  align?: 'left' | 'right' | 'center'
  /** 手机卡片视图中隐藏 */
  hideOnMobile?: boolean
  /** 手机卡片视图的标题列 */
  primary?: boolean
}
