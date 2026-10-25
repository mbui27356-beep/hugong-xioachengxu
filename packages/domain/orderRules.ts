import type { BusinessStatus, Order, PaymentStatus } from '../contracts'
import type { Permission } from './permissions'

// 订单动作与前置条件，对应开发文档 5.2 动作表。页面只能通过这里判断按钮是否可用，
// 真正的状态变更由 service 再次校验后执行。

export type OrderAction = 'confirm' | 'reject' | 'start' | 'complete' | 'cancel' | 'endEarly'

export interface ActionRule {
  label: string
  /** 弹窗中的说明 */
  description: string
  from: BusinessStatus[]
  payment: PaymentStatus[]
  reasonRequired: boolean
  reasonLabel: string
  permission: Permission
  destructive?: boolean
  requiresAssignment?: boolean
  demoOnly?: boolean
}

export const ACTION_RULES: Record<OrderAction, ActionRule> = {
  confirm: {
    label: '确认预约',
    description: '已与家属核实需求，且人员或班组容量可满足。确认后开放付款，并记录付款截止时间。',
    from: ['PENDING_CONFIRM'],
    payment: ['UNPAID'],
    reasonRequired: false,
    reasonLabel: '确认备注（选填）',
    permission: 'order.operate',
  },
  reject: {
    label: '拒绝',
    description: '仅限尚未付款的订单。拒绝后会释放预留容量并通知用户。',
    from: ['PENDING_CONFIRM', 'PENDING_PAYMENT'],
    payment: ['UNPAID'],
    reasonRequired: true,
    reasonLabel: '拒绝理由（将告知用户）',
    permission: 'order.operate',
    destructive: true,
  },
  start: {
    label: '开始服务',
    description: '护工已到岗。将记录实际开始时间与到岗记录。',
    from: ['PENDING_SERVICE'],
    payment: ['PAID'],
    reasonRequired: false,
    reasonLabel: '到岗说明（选填）',
    permission: 'order.operate',
    requiresAssignment: true,
  },
  complete: {
    label: '结束服务',
    description: '记录实际结束时间与完成凭据，并通知用户。',
    from: ['IN_SERVICE'],
    payment: ['PAID', 'PARTIALLY_REFUNDED'],
    reasonRequired: true,
    reasonLabel: '完成凭据（如交接记录、家属确认方式）',
    permission: 'order.operate',
  },
  cancel: {
    label: '取消订单',
    description: '未付款订单直接取消并关闭支付单；已付款订单取消后会创建独立退款申请，由财务审核。',
    from: ['PENDING_CONFIRM', 'PENDING_PAYMENT', 'PENDING_SERVICE'],
    payment: ['UNPAID', 'PAID'],
    reasonRequired: true,
    reasonLabel: '取消原因',
    permission: 'order.operate',
    destructive: true,
  },
  endEarly: {
    label: '提前结束',
    description: '结束服务并按核准规则为未服务部分创建退款申请，由财务审核后执行。折算规则为业务待定项，请填写核定金额。',
    from: ['IN_SERVICE'],
    payment: ['PAID'],
    reasonRequired: true,
    reasonLabel: '提前结束原因',
    permission: 'order.operate',
    destructive: true,
  },
}

export interface TransitionContext {
  hasActiveAssignment: boolean
}

export type TransitionCheck = { ok: true } | { ok: false; message: string }

export function checkTransition(
  order: Pick<Order, 'businessStatus' | 'paymentStatus'>,
  action: OrderAction,
  ctx: TransitionContext,
): TransitionCheck {
  const rule = ACTION_RULES[action]
  if (!rule.from.includes(order.businessStatus)) {
    return { ok: false, message: `当前业务状态不能执行「${rule.label}」` }
  }
  if (!rule.payment.includes(order.paymentStatus)) {
    return { ok: false, message: `当前支付状态不能执行「${rule.label}」` }
  }
  // 待服务的订单只有在已付款时才可走“已付款取消”分支
  if (action === 'cancel' && order.businessStatus === 'PENDING_SERVICE' && order.paymentStatus !== 'PAID') {
    return { ok: false, message: '该订单资金状态异常，请先在支付退款中处理' }
  }
  if (action === 'cancel' && order.businessStatus !== 'PENDING_SERVICE' && order.paymentStatus !== 'UNPAID') {
    return { ok: false, message: '已付款订单请走退款流程' }
  }
  if (rule.requiresAssignment && !ctx.hasActiveAssignment) {
    return { ok: false, message: '尚无有效派单，请先在「护工与调度」安排人员' }
  }
  return { ok: true }
}

export function availableActions(
  order: Pick<Order, 'businessStatus' | 'paymentStatus'>,
  ctx: TransitionContext,
): { action: OrderAction; rule: ActionRule; check: TransitionCheck }[] {
  const order_: OrderAction[] = ['confirm', 'start', 'complete', 'endEarly', 'reject', 'cancel']
  return order_
    .filter((a) => ACTION_RULES[a].from.includes(order.businessStatus))
    .map((a) => ({ action: a, rule: ACTION_RULES[a], check: checkTransition(order, a, ctx) }))
    .filter((x) => x.check.ok || ACTION_RULES[x.action].requiresAssignment)
}

export function isPaidCancel(order: Pick<Order, 'businessStatus' | 'paymentStatus'>): boolean {
  return order.businessStatus === 'PENDING_SERVICE' && order.paymentStatus === 'PAID'
}

export const OPEN_STATUSES: BusinessStatus[] = ['PENDING_CONFIRM', 'PENDING_PAYMENT', 'PENDING_SERVICE', 'IN_SERVICE']
