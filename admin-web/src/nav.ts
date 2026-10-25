import type { IconName } from '@/components/icons/paths'
import type { Permission } from '@/domain/permissions'

export interface NavItem {
  path: string
  name: string
  title: string
  icon: IconName
  perm: Permission
  keywords?: string
}

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: '概览',
    items: [{ path: '/dashboard', name: 'dashboard', title: '工作台', icon: 'dashboard', perm: 'dashboard.view', keywords: 'kpi 首页' }],
  },
  {
    label: '履约',
    items: [
      { path: '/orders', name: 'orders', title: '预约订单', icon: 'orders', perm: 'order.view', keywords: '订单 确认 拒绝' },
      { path: '/dispatch', name: 'dispatch', title: '护工与调度', icon: 'caregiver', perm: 'dispatch.view', keywords: '派单 改派 护工' },
      { path: '/payments', name: 'payments', title: '支付退款', icon: 'card', perm: 'payment.view', keywords: '流水 退款 对账' },
      { path: '/patients', name: 'patients', title: '就诊人资料', icon: 'patient', perm: 'patient.view', keywords: '患者 脱敏' },
      { path: '/messages', name: 'messages', title: '消息管理', icon: 'bell', perm: 'message.view', keywords: '通知 站内信' },
    ],
  },
  {
    label: '服务目录',
    items: [
      { path: '/regions', name: 'regions', title: '服务地区', icon: 'region', perm: 'catalog.view', keywords: '城市 区县' },
      { path: '/hospitals', name: 'hospitals', title: '医院管理', icon: 'hospital', perm: 'catalog.view', keywords: '院区 等级' },
      { path: '/departments', name: 'departments', title: '科室管理', icon: 'layers', perm: 'catalog.view', keywords: '病区 护理单元' },
      { path: '/packages', name: 'packages', title: '服务套餐', icon: 'package', perm: 'catalog.view', keywords: '价格 上架' },
    ],
  },
  {
    label: '配置',
    items: [
      { path: '/agreements', name: 'agreements', title: '协议配置', icon: 'doc', perm: 'agreement.view', keywords: '知情说明 隐私 版本' },
      { path: '/settings', name: 'settings', title: '系统设置', icon: 'sliders', perm: 'settings.view', keywords: '角色 日志 营业时间' },
    ],
  },
]

export const NAV_ITEMS = NAV.flatMap((g) => g.items)
