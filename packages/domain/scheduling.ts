import type { Assignment, Caregiver } from '../contracts'

// 派单冲突规则（开发文档 4.2）：
// 一对一不允许同一护工在重叠时段重复指派；一对多按班组最大服务人数管理容量。
// 服务区间开始包含、结束不包含，相邻班次不算重叠。

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

export const OCCUPYING: Assignment['status'][] = ['RESERVED', 'ACTIVE']

export interface ConflictResult {
  blocked: boolean
  message: string | null
  conflicts: Assignment[]
}

export function checkCaregiverConflict(
  caregiver: Caregiver,
  assignments: Assignment[],
  startAt: number,
  endAt: number,
  excludeOrderId?: string,
): ConflictResult {
  const conflicts = assignments.filter(
    (a) =>
      a.caregiverId === caregiver.id &&
      a.orderId !== excludeOrderId &&
      OCCUPYING.includes(a.status) &&
      overlaps(a.startAt, a.endAt, startAt, endAt),
  )
  if (caregiver.duty === 'LEAVE') {
    return { blocked: true, message: `${caregiver.name} 正在请假，不能安排`, conflicts }
  }
  if (caregiver.mode === 'ONE_TO_ONE') {
    if (conflicts.length > 0) {
      return { blocked: true, message: `一对一护工在该时段已有 ${conflicts.length} 个安排，不能重复指派`, conflicts }
    }
  } else if (conflicts.length >= caregiver.capacity) {
    return { blocked: true, message: `班组在该时段已满（${conflicts.length}/${caregiver.capacity}）`, conflicts }
  }
  const warn = caregiver.duty === 'OFF_DUTY' ? '当前为休息状态，请确认可到岗' : null
  return {
    blocked: false,
    message:
      warn ?? (caregiver.mode === 'ONE_TO_MANY' && conflicts.length > 0 ? `班组该时段已安排 ${conflicts.length}/${caregiver.capacity}` : null),
    conflicts,
  }
}
