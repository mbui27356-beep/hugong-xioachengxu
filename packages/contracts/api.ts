// 统一响应约定（开发文档第 8 节）

export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'NOT_AVAILABLE'
  | 'NOT_FOUND'
  | 'PRICE_CHANGED'
  | 'AGREEMENT_CHANGED'
  | 'STATE_CONFLICT'
  | 'PAYMENT_PENDING'
  | 'NETWORK_ERROR'

export interface ApiError {
  code: ErrorCode
  message: string
}

export type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: ApiError; requestId: string }

export const ERROR_TITLE: Record<ErrorCode, string> = {
  AUTH_REQUIRED: '需要登录',
  FORBIDDEN: '没有权限',
  VALIDATION_FAILED: '信息有误',
  NOT_AVAILABLE: '暂不可用',
  NOT_FOUND: '记录不存在',
  PRICE_CHANGED: '价格已变化',
  AGREEMENT_CHANGED: '协议已更新',
  STATE_CONFLICT: '状态已变化',
  PAYMENT_PENDING: '支付确认中',
  NETWORK_ERROR: '网络异常',
}
