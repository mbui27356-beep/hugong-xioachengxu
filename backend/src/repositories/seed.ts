import type {
  AdminUser, Agreement, AppUser, AssessmentAnswer, Assignment, AssignmentStatus, AuditLog, BusinessStatus, Campus,
  Caregiver, City, Department, District, Hospital, HospitalGrade, Message, Order, Patient, PaymentAttempt,
  PaymentStatus, PriceVersion, Refund, RefundStatus, ServicePackage, Settings, TimelineEntry, Ward,
} from '../../../packages/contracts'
import { ASSESSMENT_ITEMS } from '../../../packages/contracts'
import { contentHash } from '../../../packages/domain/hash'
import { quote } from '../../../packages/domain/pricing'
import { formatFen } from '../../../packages/domain/money'
import { DAY, HOUR, MINUTE, formatDate } from '../../../packages/domain/time'
import { SCHEMA, type Db } from '../core/db'

// 全部为虚构演示数据：姓名、电话、地址、价格均不代表真实信息。

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildSeed(now: number): Db {
  const rand = rng(20261026)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
  const base = now - 40 * DAY
  const meta = (offset = 0) => ({ createdAt: base + offset, updatedAt: base + offset, demo: true as const })
  const hourNow = Math.floor(now / HOUR) * HOUR

  // ---------- 地区 ----------
  const cities: City[] = [
    { id: 'city_yc', name: '宜昌市', code: '420500', enabled: true, sort: 1, ...meta() },
    { id: 'city_wh', name: '武汉市', code: '420100', enabled: false, sort: 2, ...meta() },
  ]
  const districts: District[] = [
    { id: 'dist_xl', cityId: 'city_yc', name: '西陵区', code: '420502', enabled: true, sort: 1, ...meta() },
    { id: 'dist_wjg', cityId: 'city_yc', name: '伍家岗区', code: '420503', enabled: true, sort: 2, ...meta() },
    { id: 'dist_dj', cityId: 'city_yc', name: '点军区', code: '420504', enabled: true, sort: 3, ...meta() },
    { id: 'dist_yl', cityId: 'city_yc', name: '夷陵区', code: '420506', enabled: false, sort: 4, ...meta() },
    { id: 'dist_ja', cityId: 'city_wh', name: '江岸区', code: '420102', enabled: true, sort: 1, ...meta() },
  ]
  const grades: HospitalGrade[] = [
    { id: 'grade_3a', name: '三级甲等', shortName: '三甲', enabled: true, sort: 1, ...meta() },
    { id: 'grade_3b', name: '三级乙等', shortName: '三乙', enabled: true, sort: 2, ...meta() },
    { id: 'grade_2a', name: '二级甲等', shortName: '二甲', enabled: true, sort: 3, ...meta() },
  ]

  // ---------- 医院 ----------
  const hospitals: Hospital[] = [
    {
      id: 'hosp_center', cityId: 'city_yc', districtId: 'dist_xl', gradeId: 'grade_3a', name: '宜昌市中心人民医院',
      displayAddress: '宜昌市西陵区（演示地址，待运营核实）', phone: '0717-0000-0001', enabled: true, ...meta(),
    },
    {
      id: 'hosp_rehab', cityId: 'city_yc', districtId: 'dist_wjg', gradeId: 'grade_2a', name: '宜昌演示康复医院（虚构）',
      displayAddress: '宜昌市伍家岗区演示大道 66 号', phone: '0717-0000-0002', enabled: true, ...meta(),
    },
  ]
  const campuses: Campus[] = [
    { id: 'camp_ds', hospitalId: 'hosp_center', name: '东山院区（演示）', address: '宜昌市西陵区演示路 1 号', phone: '0717-0000-0011', enabled: true, sort: 1, ...meta() },
    { id: 'camp_bj', hospitalId: 'hosp_center', name: '滨江院区（演示）', address: '宜昌市西陵区滨江演示街 88 号', phone: '0717-0000-0012', enabled: true, sort: 2, ...meta() },
    { id: 'camp_rh', hospitalId: 'hosp_rehab', name: '本部（演示）', address: '宜昌市伍家岗区演示大道 66 号', phone: '0717-0000-0021', enabled: true, sort: 1, ...meta() },
  ]
  const deptDefs: [string, string, string][] = [
    ['dept_xxg', 'camp_ds', '心血管内科'],
    ['dept_sjn', 'camp_ds', '神经内科'],
    ['dept_gk', 'camp_ds', '骨科'],
    ['dept_pw', 'camp_ds', '普外科'],
    ['dept_lnyx', 'camp_ds', '老年医学科'],
    ['dept_hx', 'camp_bj', '呼吸与危重症医学科'],
    ['dept_zl', 'camp_bj', '肿瘤科'],
    ['dept_kfyx', 'camp_bj', '康复医学科'],
    ['dept_kf', 'camp_rh', '康复科'],
    ['dept_lnhl', 'camp_rh', '老年护理单元'],
  ]
  const departments: Department[] = deptDefs.map(([id, campusId, name], i) => ({
    id, campusId, name, enabled: id !== 'dept_pw', sort: i + 1, ...meta(),
  }))
  const wards: Ward[] = [
    { id: 'ward_xxg1', departmentId: 'dept_xxg', name: '一病区', enabled: true, sort: 1, ...meta() },
    { id: 'ward_xxg2', departmentId: 'dept_xxg', name: '二病区', enabled: true, sort: 2, ...meta() },
    { id: 'ward_sjn1', departmentId: 'dept_sjn', name: '一病区', enabled: true, sort: 1, ...meta() },
    { id: 'ward_zl1', departmentId: 'dept_zl', name: '日间病房', enabled: true, sort: 1, ...meta() },
    { id: 'ward_lnhl1', departmentId: 'dept_lnhl', name: 'A 护理单元', enabled: true, sort: 1, ...meta() },
  ]

  // ---------- 套餐与价格版本（演示价格） ----------
  const packages: ServicePackage[] = [
    {
      id: 'pkg_121', name: '一对一陪护 · 24 小时', type: 'ONE_TO_ONE', unit: 'DAY_24H',
      content: '协助进食饮水、翻身换位、洗漱如厕；陪同检查；夜间看护与呼叫。',
      exclusions: '注射、换药、吸痰等医疗操作；用药决定；代签医疗文书。',
      conditions: '适用于普通病房，特殊情况需人工确认。', limits: '单次 1–30 天；需提前 2 小时预约。',
      consultPhone: '400-000-0000', campusIds: ['camp_ds', 'camp_bj'], status: 'ON_SHELF',
      currentPriceVersionId: 'pv_121_2', ...meta(),
    },
    {
      id: 'pkg_12n', name: '一对多陪护 · 24 小时', type: 'ONE_TO_MANY', unit: 'DAY_24H',
      content: '同病区多位患者共用护工班组，按时巡视并协助基础生活照料。',
      exclusions: '医疗操作；专人全程陪同外出检查。',
      conditions: '患者生活基本可自理或部分需协助。', limits: '班组容量满后不可预约。',
      consultPhone: '400-000-0000', campusIds: ['camp_ds', 'camp_bj', 'camp_rh'], status: 'ON_SHELF',
      currentPriceVersionId: 'pv_12n_1', ...meta(),
    },
    {
      id: 'pkg_day', name: '白班陪护 · 12 小时', type: 'ONE_TO_ONE', unit: 'SHIFT_12H',
      content: '07:00–19:00 班次内一对一照护，交接班有记录。',
      exclusions: '夜间看护；医疗操作。',
      conditions: '家属可在夜间自行陪护。', limits: '按班次计费。',
      consultPhone: '400-000-0000', campusIds: ['camp_ds'], status: 'ON_SHELF',
      currentPriceVersionId: 'pv_day_1', ...meta(),
    },
    {
      id: 'pkg_post', name: '术后重点陪护 · 24 小时', type: 'ONE_TO_ONE', unit: 'DAY_24H',
      content: '术后早期重点看护，协助体位调整与观察呼叫。',
      exclusions: '医疗操作；用药决定。',
      conditions: '术后 72 小时内，必须人工确认后开放付款。', limits: '单次 1–7 天。',
      consultPhone: '400-000-0000', campusIds: ['camp_ds'], status: 'OFF_SHELF',
      currentPriceVersionId: 'pv_post_1', ...meta(),
    },
  ]
  const priceVersions: PriceVersion[] = [
    { id: 'pv_121_1', packageId: 'pkg_121', version: 1, unit: 'DAY_24H', unitPriceFen: 25800, effectiveFrom: base, effectiveTo: base + 20 * DAY, note: '演示初始价格', operatorName: '钱运营（演示）', ...meta() },
    { id: 'pv_121_2', packageId: 'pkg_121', version: 2, unit: 'DAY_24H', unitPriceFen: 26800, effectiveFrom: base + 20 * DAY, effectiveTo: null, note: '演示调价', operatorName: '钱运营（演示）', ...meta(20 * DAY) },
    { id: 'pv_12n_1', packageId: 'pkg_12n', version: 1, unit: 'DAY_24H', unitPriceFen: 16800, effectiveFrom: base, effectiveTo: null, note: '演示价格', operatorName: '钱运营（演示）', ...meta() },
    { id: 'pv_day_1', packageId: 'pkg_day', version: 1, unit: 'SHIFT_12H', unitPriceFen: 14800, effectiveFrom: base, effectiveTo: null, note: '演示价格', operatorName: '钱运营（演示）', ...meta() },
    { id: 'pv_post_1', packageId: 'pkg_post', version: 1, unit: 'DAY_24H', unitPriceFen: 32800, effectiveFrom: base, effectiveTo: null, note: '演示价格，待定', operatorName: '钱运营（演示）', ...meta() },
  ]

  // ---------- 用户与就诊人（虚构） ----------
  const users: AppUser[] = Array.from({ length: 12 }, (_, i) => ({
    id: `user_${i + 1}`,
    nickname: `演示用户${String(i + 1).padStart(2, '0')}`,
    phone: `1380000${String(i + 1).padStart(4, '0')}`,
    ...meta(i * HOUR),
  }))
  const patientNames = ['陈秀兰', '王建华', '李桂芳', '张德明', '刘淑珍', '杨国庆', '赵玉梅', '黄志强', '周丽华', '吴永胜', '徐秀英', '孙明辉', '马玉兰', '朱长青']
  const contactNames = ['陈晓雨', '王思远', '李佳宁', '张一帆', '刘子涵', '杨若溪', '赵可欣', '黄博文', '周雨桐', '吴昊然', '徐梓萱', '孙浩宇', '马诗涵', '朱宇航']
  const relationships = ['子女', '配偶', '子女', '孙辈', '本人', '子女']
  const patients: Patient[] = patientNames.map((name, i) => {
    const rel = relationships[i % relationships.length]
    return {
      id: `pat_${i + 1}`,
      ownerUserId: users[i % users.length].id,
      name,
      gender: i % 3 === 1 ? '男' : '女',
      age: 58 + ((i * 7) % 30),
      contactName: rel === '本人' ? name : contactNames[i],
      contactPhone: `1380001${String(i + 1).padStart(4, '0')}`,
      relationship: rel,
      isDefault: i < users.length,
      note: '演示档案',
      ...meta(i * 2 * HOUR),
    }
  })

  // ---------- 护工（虚构） ----------
  const caregivers: Caregiver[] = [
    { id: 'cg_1', name: '何翠兰', phone: '13900000001', gender: '女', campusIds: ['camp_ds'], mode: 'ONE_TO_ONE', capacity: 1, shifts: ['全天'], duty: 'ON_DUTY', note: '', ...meta() },
    { id: 'cg_2', name: '马秀芝', phone: '13900000002', gender: '女', campusIds: ['camp_ds', 'camp_bj'], mode: 'ONE_TO_ONE', capacity: 1, shifts: ['全天'], duty: 'ON_DUTY', note: '', ...meta() },
    { id: 'cg_3', name: '罗丽娟', phone: '13900000003', gender: '女', campusIds: ['camp_bj'], mode: 'ONE_TO_ONE', capacity: 1, shifts: ['白班'], duty: 'ON_DUTY', note: '', ...meta() },
    { id: 'cg_4', name: '高春梅', phone: '13900000004', gender: '女', campusIds: ['camp_ds'], mode: 'ONE_TO_ONE', capacity: 1, shifts: ['全天', '白班'], duty: 'OFF_DUTY', note: '', ...meta() },
    { id: 'cg_5', name: '林桂香', phone: '13900000005', gender: '女', campusIds: ['camp_ds', 'camp_bj'], mode: 'ONE_TO_ONE', capacity: 1, shifts: ['全天'], duty: 'LEAVE', note: '演示：请假至下周', ...meta() },
    { id: 'cg_6', name: '张建军', phone: '13900000006', gender: '男', campusIds: ['camp_ds', 'camp_bj'], mode: 'ONE_TO_ONE', capacity: 1, shifts: ['全天'], duty: 'ON_DUTY', note: '可服务男性患者', ...meta() },
    { id: 'cg_7', name: '郑红霞班组', phone: '13900000007', gender: '女', campusIds: ['camp_ds', 'camp_bj'], mode: 'ONE_TO_MANY', capacity: 4, shifts: ['全天'], duty: 'ON_DUTY', note: '一对多班组', ...meta() },
    { id: 'cg_8', name: '康复本部班组', phone: '13900000008', gender: '女', campusIds: ['camp_rh'], mode: 'ONE_TO_MANY', capacity: 3, shifts: ['全天'], duty: 'ON_DUTY', note: '一对多班组', ...meta() },
  ]

  // ---------- 管理员（虚构） ----------
  const admins: AdminUser[] = [
    { id: 'adm_super', name: '周超管（演示）', account: 'super.demo', roles: ['SUPER_ADMIN'], allowedHospitalIds: '*', enabled: true, ...meta() },
    { id: 'adm_ops', name: '钱运营（演示）', account: 'ops.demo', roles: ['OPERATOR'], allowedHospitalIds: '*', enabled: true, ...meta() },
    { id: 'adm_disp', name: '孙调度（演示）', account: 'dispatch.demo', roles: ['DISPATCHER'], allowedHospitalIds: ['hosp_center'], enabled: true, ...meta() },
    { id: 'adm_fin', name: '李财务（演示）', account: 'finance.demo', roles: ['FINANCE'], allowedHospitalIds: '*', enabled: true, ...meta() },
    { id: 'adm_cs', name: '吴客服（演示）', account: 'support.demo', roles: ['SUPPORT'], allowedHospitalIds: ['hosp_center'], enabled: true, ...meta() },
    { id: 'adm_multi', name: '郑兼岗（演示）', account: 'multi.demo', roles: ['DISPATCHER', 'SUPPORT'], allowedHospitalIds: ['hosp_rehab'], enabled: true, ...meta() },
  ]

  // ---------- 订单 ----------
  const orders: Order[] = []
  const payments: PaymentAttempt[] = []
  const refunds: Refund[] = []
  const assignments: Assignment[] = []
  const messages: Message[] = []
  const counters = { order: 0, refund: 0, trade: 0, id: 1000 }

  interface Spec {
    status: BusinessStatus
    pay: PaymentStatus
    patient: number
    pkg: string
    campus: string
    dept: string
    ward?: string
    startH: number
    units: number
    createdH: number
    caregiver?: string
    asg?: AssignmentStatus
    payAttempt?: 'SUCCESS' | 'PENDING' | 'PENDING_CHANNEL_PAID' | 'CLOSED'
    refund?: { status: RefundStatus; fen: 'full' | number; reason: string; source: 'USER' | 'ADMIN'; failReason?: string }
    closeReason?: string
    room?: string
    bed?: string
  }

  const S = (s: Spec) => s
  const specs: Spec[] = [
    // 待确认
    S({ status: 'PENDING_CONFIRM', pay: 'UNPAID', patient: 0, pkg: 'pkg_121', campus: 'camp_ds', dept: 'dept_xxg', ward: 'ward_xxg1', startH: 20, units: 3, createdH: 0.3, room: '12', bed: '3' }),
    S({ status: 'PENDING_CONFIRM', pay: 'UNPAID', patient: 1, pkg: 'pkg_12n', campus: 'camp_bj', dept: 'dept_hx', startH: 28, units: 5, createdH: 1.2, room: '305', bed: '暂不确定' }),
    S({ status: 'PENDING_CONFIRM', pay: 'UNPAID', patient: 2, pkg: 'pkg_day', campus: 'camp_ds', dept: 'dept_gk', startH: 40, units: 2, createdH: 2.5, room: '8', bed: '1' }),
    S({ status: 'PENDING_CONFIRM', pay: 'UNPAID', patient: 12, pkg: 'pkg_12n', campus: 'camp_rh', dept: 'dept_kf', startH: 26, units: 7, createdH: 3.1, room: '201', bed: '2' }),
    S({ status: 'PENDING_CONFIRM', pay: 'UNPAID', patient: 3, pkg: 'pkg_121', campus: 'camp_bj', dept: 'dept_zl', ward: 'ward_zl1', startH: 50, units: 2, createdH: 5, room: '日间', bed: '6' }),
    // 待支付
    S({ status: 'PENDING_PAYMENT', pay: 'UNPAID', patient: 4, pkg: 'pkg_121', campus: 'camp_ds', dept: 'dept_sjn', ward: 'ward_sjn1', startH: 22, units: 4, createdH: 6, caregiver: 'cg_2', asg: 'RESERVED', payAttempt: 'PENDING', room: '17', bed: '2' }),
    S({ status: 'PENDING_PAYMENT', pay: 'UNPAID', patient: 5, pkg: 'pkg_12n', campus: 'camp_ds', dept: 'dept_lnyx', startH: 30, units: 3, createdH: 7, payAttempt: 'PENDING_CHANNEL_PAID', room: '6', bed: '4' }),
    S({ status: 'PENDING_PAYMENT', pay: 'UNPAID', patient: 6, pkg: 'pkg_day', campus: 'camp_ds', dept: 'dept_xxg', ward: 'ward_xxg2', startH: 44, units: 3, createdH: 9, room: '22', bed: '1' }),
    // 待服务
    S({ status: 'PENDING_SERVICE', pay: 'PAID', patient: 7, pkg: 'pkg_121', campus: 'camp_ds', dept: 'dept_gk', startH: 3, units: 5, createdH: 26, caregiver: 'cg_1', asg: 'ACTIVE', payAttempt: 'SUCCESS', room: '9', bed: '2' }),
    S({ status: 'PENDING_SERVICE', pay: 'PAID', patient: 8, pkg: 'pkg_12n', campus: 'camp_bj', dept: 'dept_kfyx', startH: 6, units: 6, createdH: 30, payAttempt: 'SUCCESS', room: '412', bed: '5' }),
    S({ status: 'PENDING_SERVICE', pay: 'PAID', patient: 9, pkg: 'pkg_121', campus: 'camp_bj', dept: 'dept_hx', startH: 27, units: 3, createdH: 20, payAttempt: 'SUCCESS', room: '310', bed: '1' }),
    S({ status: 'PENDING_SERVICE', pay: 'PAID', patient: 13, pkg: 'pkg_12n', campus: 'camp_rh', dept: 'dept_lnhl', ward: 'ward_lnhl1', startH: 8, units: 10, createdH: 22, caregiver: 'cg_8', asg: 'ACTIVE', payAttempt: 'SUCCESS', room: 'A3', bed: '2' }),
    // 服务中
    S({ status: 'IN_SERVICE', pay: 'PAID', patient: 10, pkg: 'pkg_121', campus: 'camp_ds', dept: 'dept_xxg', ward: 'ward_xxg1', startH: -30, units: 4, createdH: 60, caregiver: 'cg_6', asg: 'ACTIVE', payAttempt: 'SUCCESS', room: '14', bed: '1' }),
    S({ status: 'IN_SERVICE', pay: 'PAID', patient: 11, pkg: 'pkg_12n', campus: 'camp_ds', dept: 'dept_lnyx', startH: -50, units: 5, createdH: 80, caregiver: 'cg_7', asg: 'ACTIVE', payAttempt: 'SUCCESS', room: '5', bed: '3' }),
    S({ status: 'IN_SERVICE', pay: 'PAID', patient: 0, pkg: 'pkg_day', campus: 'camp_ds', dept: 'dept_sjn', ward: 'ward_sjn1', startH: -4, units: 1, createdH: 30, caregiver: 'cg_3', asg: 'ACTIVE', payAttempt: 'SUCCESS', room: '16', bed: '4' }),
    S({ status: 'IN_SERVICE', pay: 'PARTIALLY_REFUNDED', patient: 2, pkg: 'pkg_12n', campus: 'camp_bj', dept: 'dept_zl', startH: -70, units: 7, createdH: 100, caregiver: 'cg_7', asg: 'ACTIVE', payAttempt: 'SUCCESS', refund: { status: 'SUCCEEDED', fen: 16800, reason: '演示：首日家属自陪，退 1 天', source: 'USER' }, room: '508', bed: '2' }),
    // 已完成
    S({ status: 'COMPLETED', pay: 'PAID', patient: 4, pkg: 'pkg_121', campus: 'camp_ds', dept: 'dept_gk', startH: -200, units: 5, createdH: 230, caregiver: 'cg_1', asg: 'FINISHED', payAttempt: 'SUCCESS', room: '9', bed: '1' }),
    S({ status: 'COMPLETED', pay: 'PAID', patient: 5, pkg: 'pkg_12n', campus: 'camp_bj', dept: 'dept_hx', startH: -150, units: 3, createdH: 170, caregiver: 'cg_7', asg: 'FINISHED', payAttempt: 'SUCCESS', refund: { status: 'REQUESTED', fen: 16800, reason: '用户申请：最后一天提前出院', source: 'USER' }, room: '301', bed: '2' }),
    S({ status: 'COMPLETED', pay: 'PARTIALLY_REFUNDED', patient: 6, pkg: 'pkg_121', campus: 'camp_ds', dept: 'dept_xxg', startH: -280, units: 6, createdH: 300, caregiver: 'cg_2', asg: 'FINISHED', payAttempt: 'SUCCESS', refund: { status: 'SUCCEEDED', fen: 26800, reason: '提前结束，未服务 1 天', source: 'ADMIN' }, room: '20', bed: '2' }),
    S({ status: 'COMPLETED', pay: 'PAID', patient: 7, pkg: 'pkg_day', campus: 'camp_ds', dept: 'dept_sjn', startH: -100, units: 4, createdH: 120, caregiver: 'cg_3', asg: 'FINISHED', payAttempt: 'SUCCESS', room: '15', bed: '1' }),
    S({ status: 'COMPLETED', pay: 'PAID', patient: 8, pkg: 'pkg_12n', campus: 'camp_rh', dept: 'dept_kf', startH: -240, units: 4, createdH: 260, caregiver: 'cg_8', asg: 'FINISHED', payAttempt: 'SUCCESS', room: '102', bed: '3' }),
    S({ status: 'COMPLETED', pay: 'PAID', patient: 9, pkg: 'pkg_121', campus: 'camp_bj', dept: 'dept_kfyx', startH: -320, units: 3, createdH: 330, caregiver: 'cg_6', asg: 'FINISHED', payAttempt: 'SUCCESS', room: '406', bed: '1' }),
    S({ status: 'COMPLETED', pay: 'PAID', patient: 1, pkg: 'pkg_121', campus: 'camp_ds', dept: 'dept_lnyx', startH: -180, units: 2, createdH: 200, caregiver: 'cg_4', asg: 'FINISHED', payAttempt: 'SUCCESS', room: '7', bed: '2' }),
    S({ status: 'COMPLETED', pay: 'PAID', patient: 3, pkg: 'pkg_12n', campus: 'camp_ds', dept: 'dept_xxg', startH: -120, units: 2, createdH: 140, caregiver: 'cg_7', asg: 'FINISHED', payAttempt: 'SUCCESS', room: '11', bed: '5' }),
    // 已取消 / 已拒绝
    S({ status: 'CANCELLED', pay: 'UNPAID', patient: 10, pkg: 'pkg_121', campus: 'camp_bj', dept: 'dept_hx', startH: 10, units: 2, createdH: 40, payAttempt: 'CLOSED', closeReason: '用户改期，主动取消' }),
    S({ status: 'CANCELLED', pay: 'PAID', patient: 11, pkg: 'pkg_121', campus: 'camp_ds', dept: 'dept_gk', startH: 30, units: 3, createdH: 50, payAttempt: 'SUCCESS', refund: { status: 'REQUESTED', fen: 'full', reason: '已付款取消：家属自行陪护', source: 'ADMIN' }, closeReason: '家属自行陪护' }),
    S({ status: 'CANCELLED', pay: 'PAID', patient: 12, pkg: 'pkg_12n', campus: 'camp_rh', dept: 'dept_kf', startH: 18, units: 2, createdH: 70, payAttempt: 'SUCCESS', refund: { status: 'FAILED', fen: 'full', reason: '已付款取消：转院', source: 'ADMIN', failReason: '演示：渠道返回余额不足，待人工处理' }, closeReason: '患者转院' }),
    S({ status: 'CANCELLED', pay: 'PAID', patient: 13, pkg: 'pkg_day', campus: 'camp_ds', dept: 'dept_sjn', startH: 12, units: 2, createdH: 34, payAttempt: 'SUCCESS', refund: { status: 'APPROVED', fen: 'full', reason: '已付款取消：病情变化', source: 'ADMIN' }, closeReason: '病情变化，暂停陪护' }),
    S({ status: 'CANCELLED', pay: 'REFUNDED', patient: 0, pkg: 'pkg_12n', campus: 'camp_bj', dept: 'dept_zl', startH: -60, units: 2, createdH: 180, payAttempt: 'SUCCESS', refund: { status: 'SUCCEEDED', fen: 'full', reason: '已付款取消：出院', source: 'ADMIN' }, closeReason: '提前出院' }),
    S({ status: 'REJECTED', pay: 'UNPAID', patient: 1, pkg: 'pkg_121', campus: 'camp_bj', dept: 'dept_hx', startH: 6, units: 1, createdH: 18, closeReason: '该时段一对一护工已满，建议改约' }),
    S({ status: 'REJECTED', pay: 'UNPAID', patient: 4, pkg: 'pkg_121', campus: 'camp_ds', dept: 'dept_gk', startH: -20, units: 2, createdH: 90, closeReason: '病区暂不接受外部陪护（演示）' }),
  ]

  const campusById = new Map(campuses.map((c) => [c.id, c]))
  const deptById = new Map(departments.map((d) => [d.id, d]))
  const wardById = new Map(wards.map((w) => [w.id, w]))
  const pkgById = new Map(packages.map((p) => [p.id, p]))
  const cgById = new Map(caregivers.map((c) => [c.id, c]))
  const answers: AssessmentAnswer[] = ['CAN', 'NEED_HELP', 'UNSURE']

  // 按创建时间顺序生成订单号
  const sorted = [...specs].sort((a, b) => b.createdH - a.createdH)
  for (const s of sorted) {
    const campus = campusById.get(s.campus)!
    const hospital = hospitals.find((h) => h.id === campus.hospitalId)!
    const dept = deptById.get(s.dept)!
    const ward = s.ward ? wardById.get(s.ward)! : null
    const pkg = pkgById.get(s.pkg)!
    const pv = priceVersions.find((v) => v.id === pkg.currentPriceVersionId)!
    const patient = patients[s.patient]
    const createdAt = now - Math.round(s.createdH * HOUR)
    const startAt = hourNow + s.startH * HOUR
    const q = quote({ priceVersion: pv, units: s.units, startAt })
    counters.order += 1
    const id = `ord_${counters.order}`
    const orderNo = `HG${formatDate(createdAt).replace(/-/g, '')}${String(counters.order).padStart(4, '0')}`
    const timeline: TimelineEntry[] = [
      { at: createdAt, title: '提交预约', detail: '用户确认服务说明 v2、隐私告知 v1', actorName: '用户' },
    ]
    const reached = (st: BusinessStatus[]) => st.includes(s.status)
    const confirmedAt = createdAt + 40 * MINUTE
    const paidAt = createdAt + 70 * MINUTE
    const confirmed = reached(['PENDING_PAYMENT', 'PENDING_SERVICE', 'IN_SERVICE', 'COMPLETED']) || (s.status === 'CANCELLED' && s.payAttempt !== undefined)
    if (confirmed) timeline.push({ at: confirmedAt, title: '调度确认', detail: '已核实需求，开放付款', actorName: '孙调度（演示）' })
    const paid = s.payAttempt === 'SUCCESS'
    if (paid) timeline.push({ at: paidAt, title: '支付成功', detail: `服务端核实金额 ${formatFen(q.totalFen)}`, actorName: '支付渠道（模拟）' })

    let deadline: number | null = null
    if (s.status === 'PENDING_PAYMENT') deadline = now + (30 - (s.createdH % 1) * 10) * MINUTE

    // 支付单
    if (s.payAttempt) {
      counters.trade += 1
      const attempt: PaymentAttempt = {
        id: `pay_${counters.trade}`, orderId: id, outTradeNo: `T${orderNo.slice(2)}${String(counters.trade).padStart(3, '0')}`,
        transactionId: paid ? `4200000${String(100000 + counters.trade * 37)}DEMO` : null, amountFen: q.totalFen,
        status: s.payAttempt === 'SUCCESS' ? 'SUCCESS' : s.payAttempt === 'CLOSED' ? 'CLOSED' : 'PENDING',
        channelState: s.payAttempt === 'SUCCESS' || s.payAttempt === 'PENDING_CHANNEL_PAID' ? 'SUCCESS' : 'NOTPAY',
        paidAt: paid ? paidAt : null, createdAt: confirmedAt + 5 * MINUTE, updatedAt: paid ? paidAt : confirmedAt, demo: true,
      }
      payments.push(attempt)

      if (s.refund) {
        counters.refund += 1
        const amount = s.refund.fen === 'full' ? q.totalFen : s.refund.fen
        const rCreated = Math.min(now - 30 * MINUTE, Math.max(paidAt + 2 * HOUR, now - (s.createdH / 2) * HOUR))
        const history: Refund['history'] = [{ at: rCreated, status: 'REQUESTED', actorName: s.refund.source === 'USER' ? '用户' : '孙调度（演示）', note: s.refund.reason }]
        if (['APPROVED', 'PROCESSING', 'SUCCEEDED', 'FAILED'].includes(s.refund.status)) history.push({ at: rCreated + 20 * MINUTE, status: 'APPROVED', actorName: '李财务（演示）', note: '核定金额无误' })
        if (['SUCCEEDED', 'FAILED'].includes(s.refund.status)) history.push({ at: rCreated + 25 * MINUTE, status: 'PROCESSING', actorName: '李财务（演示）' })
        if (s.refund.status === 'SUCCEEDED') history.push({ at: rCreated + 26 * MINUTE, status: 'SUCCEEDED', actorName: '支付渠道（模拟）' })
        if (s.refund.status === 'FAILED') history.push({ at: rCreated + 26 * MINUTE, status: 'FAILED', actorName: '支付渠道（模拟）', note: s.refund.failReason })
        refunds.push({
          id: `rf_${counters.refund}`, orderId: id, paymentId: attempt.id, outRefundNo: `R${orderNo.slice(2)}${String(counters.refund).padStart(2, '0')}`,
          requestedFen: amount, amountFen: amount, reason: s.refund.reason, source: s.refund.source, status: s.refund.status,
          operatorId: s.refund.status === 'REQUESTED' ? null : 'adm_fin', failReason: s.refund.failReason ?? null,
          attempts: ['SUCCEEDED', 'FAILED'].includes(s.refund.status) ? 1 : 0, history,
          createdAt: rCreated, updatedAt: history[history.length - 1].at, demo: true,
        })
        timeline.push({ at: rCreated, title: '创建退款申请', detail: `${s.refund.reason}`, actorName: history[0].actorName })
        if (s.refund.status === 'SUCCEEDED') timeline.push({ at: rCreated + 26 * MINUTE, title: '退款成功', detail: '原路退回（模拟）', actorName: '支付渠道（模拟）' })
      }
    }

    // 派单
    if (s.caregiver && s.asg) {
      const cg = cgById.get(s.caregiver)!
      const asgAt = s.asg === 'RESERVED' ? confirmedAt : paidAt + 20 * MINUTE
      assignments.push({
        id: `asg_${orders.length + 1}`, orderId: id, caregiverId: cg.id, startAt: q.startAt, endAt: q.endAt, status: s.asg,
        changedReason: null, arrivedAt: reached(['IN_SERVICE', 'COMPLETED']) ? startAt - 10 * MINUTE : null,
        operatorName: '孙调度（演示）', createdAt: asgAt, updatedAt: asgAt, demo: true,
      })
      timeline.push({ at: asgAt, title: s.asg === 'RESERVED' ? '预留护工' : '安排护工', detail: cg.name, actorName: '孙调度（演示）' })
    }
    if (reached(['IN_SERVICE', 'COMPLETED'])) timeline.push({ at: startAt, title: '开始服务', detail: '护工到岗，记录实际开始时间', actorName: '孙调度（演示）' })
    if (s.status === 'COMPLETED') timeline.push({ at: q.endAt, title: '结束服务', detail: '交接记录已归档（演示）', actorName: '孙调度（演示）' })
    if (s.status === 'REJECTED') timeline.push({ at: createdAt + 30 * MINUTE, title: '调度拒绝', detail: s.closeReason, actorName: '孙调度（演示）' })
    if (s.status === 'CANCELLED') timeline.push({ at: createdAt + 3 * HOUR, title: '取消订单', detail: s.closeReason, actorName: s.pay === 'UNPAID' ? '用户' : '孙调度（演示）' })
    timeline.sort((a, b) => a.at - b.at)

    const assessment: Record<string, AssessmentAnswer> = {}
    for (const item of ASSESSMENT_ITEMS) assessment[item.key] = pick(answers)

    const order: Order = {
      id, orderNo, userId: patient.ownerUserId, patientId: patient.id, hospitalId: hospital.id, campusId: campus.id, departmentId: dept.id,
      locationSnapshot: {
        cityName: '宜昌市', hospitalName: hospital.name, campusName: campus.name, campusAddress: campus.address,
        departmentName: dept.name, wardName: ward?.name ?? null, room: s.room ?? null, bedNo: s.bed ?? null,
      },
      patientSnapshot: { name: patient.name, gender: patient.gender, age: patient.age },
      contactSnapshot: { name: patient.contactName, phone: patient.contactPhone, relationship: patient.relationship },
      packageSnapshot: {
        packageId: pkg.id, name: pkg.name, type: pkg.type, content: pkg.content, exclusions: pkg.exclusions, unit: pkg.unit,
        priceVersionId: pv.id, priceVersion: pv.version, unitPriceFen: pv.unitPriceFen,
      },
      assessmentSnapshot: assessment,
      needsNote: pick(['夜间需起身 2–3 次', '左侧肢体活动受限', '家属白天可陪同', '需协助进餐', '']),
      agreementVersions: [{ type: 'SERVICE', version: 2 }, { type: 'PRIVACY', version: 1 }],
      units: s.units, startAt: q.startAt, endAt: q.endAt, priceLines: q.lines, totalFen: q.totalFen,
      businessStatus: s.status, paymentStatus: s.pay, paymentDeadlineAt: deadline,
      actualStartAt: reached(['IN_SERVICE', 'COMPLETED']) ? startAt : null,
      actualEndAt: s.status === 'COMPLETED' ? q.endAt : null,
      closeReason: s.closeReason ?? null, timeline, remarks: [], version: timeline.length,
      createdAt, updatedAt: timeline[timeline.length - 1].at, demo: true,
    }
    orders.push(order)

    // 系统站内消息
    if (confirmed) {
      messages.push({
        id: `msg_${messages.length + 1}`, recipientUserId: order.userId, orderId: id, type: 'SYSTEM',
        title: '预约已确认，请在截止前付款', body: `订单 ${orderNo} 已确认，可在订单详情完成付款。`,
        readAt: paid ? paidAt - 5 * MINUTE : null, senderName: '系统', channel: 'IN_APP', subscribeChannelState: 'NOT_ENABLED',
        createdAt: confirmedAt, updatedAt: confirmedAt, demo: true,
      })
    }
    if (s.status === 'REJECTED') {
      messages.push({
        id: `msg_${messages.length + 1}`, recipientUserId: order.userId, orderId: id, type: 'SYSTEM',
        title: '预约未能安排', body: `很抱歉，订单 ${orderNo} 暂无法安排：${s.closeReason}`, readAt: null, senderName: '系统',
        channel: 'IN_APP', subscribeChannelState: 'NOT_ENABLED', createdAt: createdAt + 30 * MINUTE, updatedAt: createdAt + 30 * MINUTE, demo: true,
      })
    }
  }
  messages.push({
    id: `msg_${messages.length + 1}`, recipientUserId: 'user_1', orderId: null, type: 'MANUAL', title: '服务时间调整提醒',
    body: '本周末东山院区陪护交接时间调整为 08:00，如有疑问请联系客服。', readAt: null, senderName: '吴客服（演示）',
    channel: 'IN_APP', subscribeChannelState: 'NOT_ENABLED', createdAt: now - 5 * HOUR, updatedAt: now - 5 * HOUR, demo: true,
  })

  // ---------- 协议 ----------
  const agreementBody = {
    SERVICE: '一、服务提供方\n本服务由演示陪护服务有限公司提供，护工不属于医院医护人员。\n\n二、预约规则\n提交预约后由调度人员核实需求与人员安排，确认后开放付款。\n\n三、计费规则\n演示环境按连续 24 小时为 1 天计费，正式规则以上线公示为准。\n\n四、服务边界\n陪护人员不进行注射、换药等医疗操作，不替代医护人员作出医疗决定。',
    PRIVACY: '我们仅为安排陪护服务收集就诊人姓名、联系人与病房床号等必要信息。\n\n资料仅授权调度、客服在处理相关订单时查看，默认脱敏展示，查看完整资料会留下记录。',
    REFUND: '未开始服务的订单可申请全额退款。\n\n服务开始后的取消、提前结束与扣费折算规则为业务待定项，正式上线前公示，演示环境由财务人工核定。',
  }
  const agreements: Agreement[] = [
    { id: 'agr_s1', type: 'SERVICE', version: 1, title: '预约及服务知情说明', body: agreementBody.SERVICE.replace('三、计费规则\n', '三、计费规则（旧）\n'), contentHash: '', status: 'ARCHIVED', publishedAt: base + 2 * DAY, publisherName: '钱运营（演示）', ...meta(2 * DAY) },
    { id: 'agr_s2', type: 'SERVICE', version: 2, title: '预约及服务知情说明', body: agreementBody.SERVICE, contentHash: '', status: 'PUBLISHED', publishedAt: base + 18 * DAY, publisherName: '钱运营（演示）', ...meta(18 * DAY) },
    { id: 'agr_s_d', type: 'SERVICE', version: 0, title: '预约及服务知情说明', body: agreementBody.SERVICE + '\n\n五、联系我们\n客服电话 400-000-0000（演示）。', contentHash: '', status: 'DRAFT', publishedAt: null, publisherName: null, ...meta(30 * DAY) },
    { id: 'agr_p1', type: 'PRIVACY', version: 1, title: '患者信息隐私告知', body: agreementBody.PRIVACY, contentHash: '', status: 'PUBLISHED', publishedAt: base + 2 * DAY, publisherName: '钱运营（演示）', ...meta(2 * DAY) },
    { id: 'agr_r1', type: 'REFUND', version: 1, title: '取消与退款规则', body: agreementBody.REFUND, contentHash: '', status: 'PUBLISHED', publishedAt: base + 2 * DAY, publisherName: '钱运营（演示）', ...meta(2 * DAY) },
  ]
  for (const a of agreements) a.contentHash = contentHash(a.title + '\n' + a.body)

  const auditLogs: AuditLog[] = [
    { id: 'log_1', actorId: 'adm_ops', actorName: '钱运营（演示）', action: 'package.price.create', targetType: '套餐', targetId: 'pkg_121', summary: '一对一陪护 · 24 小时 新增价格版本 v2：¥258.00 → ¥268.00', reason: '演示调价', createdAt: base + 20 * DAY },
    { id: 'log_2', actorId: 'adm_disp', actorName: '孙调度（演示）', action: 'patient.reveal', targetType: '就诊人', targetId: 'pat_5', summary: '查看 刘*珍 的完整联系方式', reason: '电话核实入院时间', createdAt: now - 26 * HOUR },
    { id: 'log_3', actorId: 'adm_fin', actorName: '李财务（演示）', action: 'refund.execute', targetType: '退款', targetId: 'rf_1', summary: '执行退款 ¥268.00', reason: '核定无误', createdAt: now - 20 * HOUR },
    { id: 'log_4', actorId: 'adm_super', actorName: '周超管（演示）', action: 'admin.roles.update', targetType: '管理员', targetId: 'adm_multi', summary: '郑兼岗（演示）角色设为 调度、客服；范围：宜昌演示康复医院（虚构）', reason: '岗位调整', createdAt: now - 3 * DAY },
  ]

  const settings: Settings = {
    providerName: '演示陪护服务有限公司', providerAddress: '宜昌市西陵区演示路 100 号（虚构）', providerLicense: '演示-0000000000',
    supportPhone: '400-000-0000', supportHours: '每日 08:00–20:00', businessHoursEnabled: false, businessStart: '07:00', businessEnd: '22:00',
    leadTimeMinutes: 120, paymentDeadlineMinutes: 30, pauseOrders: false, pauseNotice: '', updatedAt: base,
  }

  return {
    schema: SCHEMA, seededAt: now, cities, districts, grades, hospitals, campuses, departments, wards, packages, priceVersions, users,
    patients, orders, payments, refunds, caregivers, assignments, messages, agreements, admins, auditLogs, settings, counters,
    quotes: [], idempotency: {},
  }
}
