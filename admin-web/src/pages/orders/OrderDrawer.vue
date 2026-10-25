<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ASSESSMENT_ANSWER_LABEL, ASSESSMENT_ITEMS, ASSIGNMENT_STATUS_LABEL, AGREEMENT_TYPE_LABEL, BILLING_UNIT_SHORT,
  PACKAGE_TYPE_LABEL, PAYMENT_ATTEMPT_LABEL,
} from '@/contracts'
import type { OrderAction } from '@/domain/orderRules'
import { formatFen, fenToYuanInput } from '@/domain/money'
import { formatDateTime, formatShort } from '@/domain/time'
import { callApi } from '@/composables/api'
import { toast } from '@/composables/toast'
import { can } from '@/composables/session'
import { addRemark, getOrderDetail, requestRefund, simulateConcurrentEdit, type OrderDetail } from '@/services/orders'
import { ASSIGNMENT_TONE, ATTEMPT_TONE } from '@/ui/status'
import { UBadge, UButton, UDrawer, UEmpty, UField, UInput, UModal, USkeleton, Icon } from '@/components/ui'
import BizBadge from '@/components/BizBadge.vue'
import PayBadge from '@/components/PayBadge.vue'
import RefundBadge from '@/components/RefundBadge.vue'
import OrderActionDialog from './OrderActionDialog.vue'

const props = defineProps<{ orderId: string | null }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const router = useRouter()

const open = computed({
  get: () => !!props.orderId,
  set: (v: boolean) => { if (!v) emit('close') },
})
const detail = ref<OrderDetail | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const action = ref<OrderAction | null>(null)
const remark = ref('')
const savingRemark = ref(false)
const refundOpen = ref(false)
const refundAmount = ref('')
const refundReason = ref('')
const refundSaving = ref(false)

async function load(silent = false) {
  if (!props.orderId) return
  if (!silent) loading.value = true
  loadError.value = null
  const r = await getOrderDetail(props.orderId)
  loading.value = false
  if (r.ok) detail.value = r.data
  else loadError.value = r.error.message
}
watch(() => props.orderId, (id) => {
  detail.value = null
  if (id) void load()
}, { immediate: true })

const o = computed(() => detail.value?.order ?? null)
const PRIMARY: OrderAction[] = ['confirm', 'start', 'complete']

const banner = computed(() => {
  const d = detail.value
  if (!d) return null
  if (d.order.businessStatus === 'PENDING_PAYMENT' && d.order.paymentDeadlineAt)
    return { tone: 'accent', text: `等待用户付款，截止 ${formatDateTime(d.order.paymentDeadlineAt)}。截止后需先与支付渠道核对，不能仅凭倒计时判定未付款。` }
  if (d.row.refundInFlight)
    return { tone: 'warning', text: '有退款尚未完成。业务状态与资金状态独立，退款结果以支付渠道回执为准。' }
  if (d.row.needsDispatch)
    return { tone: 'warning', text: '尚未安排护工。开始服务前需要有效派单。' }
  return null
})

async function onActionDone(conflict: boolean) {
  action.value = null
  await load(true)
  emit('changed')
  void conflict
}

async function saveRemark() {
  if (!o.value || !remark.value.trim()) return
  savingRemark.value = true
  const r = await callApi(addRemark(o.value.id, remark.value), '备注已添加')
  savingRemark.value = false
  if (r) {
    remark.value = ''
    await load(true)
  }
}

async function simulateConflict() {
  if (!o.value) return
  const r = await callApi(simulateConcurrentEdit(o.value.id))
  if (r) toast('已模拟他人更新', { message: '当前抽屉仍是旧版本，再执行任一操作会触发版本冲突。' })
}

function openRefund() {
  if (!detail.value) return
  refundAmount.value = fenToYuanInput(detail.value.refund.capFen)
  refundReason.value = ''
  refundOpen.value = true
}
async function submitRefund() {
  if (!o.value) return
  refundSaving.value = true
  const r = await callApi(requestRefund(o.value.id, refundAmount.value, refundReason.value), '退款申请已创建，待财务审核')
  refundSaving.value = false
  if (r) {
    refundOpen.value = false
    await load(true)
    emit('changed')
  }
}

const agreementText = computed(() => (o.value?.agreementVersions ?? []).map((a) => `${AGREEMENT_TYPE_LABEL[a.type]} v${a.version}`).join('、'))
const answerTone = (a: string) => (a === 'NEED_HELP' ? 'warning' : a === 'UNSURE' ? 'neutral' : 'muted')
</script>

<template>
  <UDrawer v-model:open="open" :width="640">
    <template #title>
      <div class="title-row">
        <h2 class="t-title2 mono-title">{{ o?.orderNo ?? '订单详情' }}</h2>
      </div>
    </template>
    <template #meta>
      <div v-if="o" class="row gap-8 wrap">
        <BizBadge :status="o.businessStatus" />
        <PayBadge :status="o.paymentStatus" />
        <UBadge tone="muted">演示</UBadge>
        <span class="t-foot c-3 num">版本 v{{ o.version }} · 创建于 {{ formatDateTime(o.createdAt) }}</span>
      </div>
    </template>

    <div v-if="loading && !detail" class="stack gap-16">
      <USkeleton height="120px" radius="20px" />
      <USkeleton height="200px" radius="20px" />
      <USkeleton height="160px" radius="20px" />
    </div>
    <UEmpty v-else-if="loadError" tone="danger" icon="alert" title="订单加载失败" :description="loadError">
      <UButton size="sm" icon="refresh" @click="load()">重试</UButton>
    </UEmpty>

    <template v-else-if="detail && o">
      <div v-if="banner" class="banner" :class="`b-${banner.tone}`">
        <Icon name="info" :size="16" />
        <span>{{ banner.text }}</span>
      </div>

      <section class="group">
        <p class="section-label">服务</p>
        <dl class="kv sheet">
          <dt>医院</dt>
          <dd>{{ o.locationSnapshot.hospitalName }}</dd>
          <dt>院区</dt>
          <dd>{{ o.locationSnapshot.campusName }}<span class="c-3 t-foot block">{{ o.locationSnapshot.campusAddress }}</span></dd>
          <dt>科室 / 病区</dt>
          <dd>{{ o.locationSnapshot.departmentName }}<template v-if="o.locationSnapshot.wardName"> · {{ o.locationSnapshot.wardName }}</template></dd>
          <dt>病房床号</dt>
          <dd>{{ o.locationSnapshot.room ?? '暂不确定' }} 房 · {{ o.locationSnapshot.bedNo ?? '暂不确定' }} 床</dd>
          <dt>服务时间</dt>
          <dd class="num">
            {{ formatDateTime(o.startAt) }} – {{ formatDateTime(o.endAt) }}
            <span class="c-3 t-foot block">共 {{ o.units }} {{ BILLING_UNIT_SHORT[o.packageSnapshot.unit] }}，开始包含、结束不包含</span>
          </dd>
          <template v-if="o.actualStartAt">
            <dt>实际</dt>
            <dd class="num">{{ formatDateTime(o.actualStartAt) }} – {{ o.actualEndAt ? formatDateTime(o.actualEndAt) : '进行中' }}</dd>
          </template>
          <template v-if="o.closeReason">
            <dt>关闭原因</dt>
            <dd>{{ o.closeReason }}</dd>
          </template>
        </dl>
      </section>

      <section class="group">
        <div class="row between">
          <p class="section-label">就诊人与联系人</p>
          <button v-if="can('patient.view')" type="button" class="link" @click="router.push({ path: '/patients', query: { q: o.orderNo } })">查看完整资料</button>
        </div>
        <dl class="kv sheet">
          <dt>就诊人</dt>
          <dd>{{ o.patientSnapshot.name }} <span class="c-3">· {{ o.patientSnapshot.gender }}<template v-if="o.patientSnapshot.age"> · {{ o.patientSnapshot.age }} 岁</template></span></dd>
          <dt>联系人</dt>
          <dd>{{ o.contactSnapshot.name }} <span class="c-3">· {{ o.contactSnapshot.relationship }}</span></dd>
          <dt>联系电话</dt>
          <dd class="num">{{ o.contactSnapshot.phone }} <UBadge tone="muted">已脱敏</UBadge></dd>
          <dt>协议确认</dt>
          <dd>{{ agreementText }}</dd>
        </dl>
      </section>

      <section class="group">
        <p class="section-label">套餐与费用 · 下单时快照</p>
        <div class="sheet pad">
          <div class="row between gap-12">
            <div class="stack gap-4">
              <span class="t-headline">{{ o.packageSnapshot.name }}</span>
              <span class="t-foot c-2">{{ PACKAGE_TYPE_LABEL[o.packageSnapshot.type] }} · 价格版本 v{{ o.packageSnapshot.priceVersion }} · 单价 {{ formatFen(o.packageSnapshot.unitPriceFen) }}/{{ BILLING_UNIT_SHORT[o.packageSnapshot.unit] }}</span>
            </div>
          </div>
          <div class="lines">
            <div v-for="l in o.priceLines" :key="l.label" class="line">
              <span class="c-2">{{ l.label }}</span>
              <span class="num">{{ formatFen(l.unitPriceFen) }} × {{ l.quantity }}</span>
              <span class="num">{{ formatFen(l.amountFen) }}</span>
            </div>
            <div class="line total">
              <span>合计</span>
              <span />
              <span class="num">{{ formatFen(o.totalFen) }}</span>
            </div>
          </div>
          <p class="t-foot c-3">服务内容：{{ o.packageSnapshot.content }}</p>
          <p class="t-foot c-3">不包含：{{ o.packageSnapshot.exclusions }}</p>
        </div>
      </section>

      <section class="group">
        <p class="section-label">照护需求评估 · 仅用于安排与人工确认</p>
        <div class="sheet pad">
          <div class="assess">
            <div v-for="item in ASSESSMENT_ITEMS" :key="item.key" class="assess-item">
              <span class="c-2">{{ item.label }}</span>
              <UBadge :tone="answerTone(o.assessmentSnapshot[item.key])">{{ ASSESSMENT_ANSWER_LABEL[o.assessmentSnapshot[item.key]] }}</UBadge>
            </div>
          </div>
          <p v-if="o.needsNote" class="t-foot c-2">补充：{{ o.needsNote }}</p>
        </div>
      </section>

      <section class="group">
        <div class="row between">
          <p class="section-label">服务安排</p>
          <button
            v-if="can('dispatch.assign') && ['PENDING_PAYMENT', 'PENDING_SERVICE', 'IN_SERVICE'].includes(o.businessStatus)"
            type="button"
            class="link"
            @click="router.push({ path: '/dispatch', query: { order: o.id } })"
          >{{ detail.row.caregiverName ? '改派' : '安排护工' }}</button>
        </div>
        <div class="sheet">
          <p v-if="!detail.assignments.length" class="empty-line">尚无派单记录</p>
          <div v-for="a in detail.assignments" :key="a.id" class="list-row">
            <div class="stack gap-4 grow">
              <span>{{ a.caregiverName }} <span class="c-3 t-foot">· {{ a.caregiverMode }}</span></span>
              <span class="t-foot c-3 num">{{ formatShort(a.startAt) }} – {{ formatShort(a.endAt) }}<template v-if="a.arrivedAt"> · 到岗 {{ formatShort(a.arrivedAt) }}</template><template v-if="a.changedReason"> · {{ a.changedReason }}</template></span>
            </div>
            <UBadge :tone="ASSIGNMENT_TONE[a.status]">{{ ASSIGNMENT_STATUS_LABEL[a.status] }}</UBadge>
          </div>
        </div>
      </section>

      <section class="group">
        <div class="row between">
          <p class="section-label">支付与退款</p>
          <button v-if="detail.canRequestRefund" type="button" class="link" @click="openRefund">发起退款</button>
        </div>
        <div class="sheet">
          <div class="money-strip">
            <div><span class="c-3 t-caption">实收</span><span class="num">{{ formatFen(detail.refund.paidFen) }}</span></div>
            <div><span class="c-3 t-caption">已退</span><span class="num">{{ formatFen(detail.refund.refundedFen) }}</span></div>
            <div><span class="c-3 t-caption">处理中</span><span class="num">{{ formatFen(detail.refund.inFlightFen) }}</span></div>
            <div><span class="c-3 t-caption">可退</span><span class="num">{{ formatFen(detail.refund.capFen) }}</span></div>
          </div>
          <p v-if="!detail.payments.length" class="empty-line">尚未生成支付单（待确认订单不可付款）</p>
          <div v-for="p in detail.payments" :key="p.id" class="list-row">
            <div class="stack gap-4 grow">
              <span>支付 <span class="mono c-2">{{ p.outTradeNo }}</span></span>
              <span class="t-foot c-3 num">{{ p.paidAt ? `支付于 ${formatDateTime(p.paidAt)}` : `创建于 ${formatDateTime(p.createdAt)}` }}</span>
            </div>
            <span class="num">{{ formatFen(p.amountFen) }}</span>
            <UBadge :tone="ATTEMPT_TONE[p.status]">{{ PAYMENT_ATTEMPT_LABEL[p.status] }}</UBadge>
          </div>
          <div v-for="r in detail.refunds" :key="r.id" class="list-row">
            <div class="stack gap-4 grow">
              <span>退款 <span class="mono c-2">{{ r.outRefundNo }}</span></span>
              <span class="t-foot c-3">{{ r.reason }}<template v-if="r.failReason"> · {{ r.failReason }}</template></span>
            </div>
            <span class="num">{{ formatFen(r.amountFen) }}</span>
            <RefundBadge :status="r.status" />
          </div>
        </div>
      </section>

      <section class="group">
        <p class="section-label">时间线</p>
        <ol class="sheet timeline">
          <li v-for="(t, i) in [...o.timeline].reverse()" :key="i" :class="{ first: i === 0 }">
            <span class="tl-dot" />
            <div class="stack gap-4">
              <span class="tl-title">{{ t.title }}</span>
              <span v-if="t.detail" class="t-foot c-2">{{ t.detail }}</span>
              <span class="t-caption c-3 num">{{ formatDateTime(t.at) }} · {{ t.actorName }}</span>
            </div>
          </li>
        </ol>
      </section>

      <section class="group">
        <p class="section-label">内部备注 · 用户不可见</p>
        <div class="sheet">
          <div v-if="detail.canRemark" class="remark-input">
            <UInput v-model="remark" placeholder="添加备注，例如与家属沟通结果" :maxlength="300" @keydown.enter="saveRemark" />
            <UButton :disabled="!remark.trim()" :loading="savingRemark" @click="saveRemark">添加</UButton>
          </div>
          <p v-if="!o.remarks.length" class="empty-line">暂无备注</p>
          <div v-for="r in o.remarks" :key="r.id" class="list-row">
            <div class="stack gap-4 grow">
              <span>{{ r.text }}</span>
              <span class="t-caption c-3 num">{{ r.actorName }} · {{ formatDateTime(r.at) }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template #footer>
      <template v-if="detail && o">
        <button type="button" class="demo-link" title="演示版本冲突处理" @click="simulateConflict">模拟他人修改</button>
        <span class="grow" />
        <span v-if="!detail.canOperate && detail.actions.length" class="t-foot c-3">当前身份不能处理订单状态</span>
        <template v-else>
          <UButton
            v-for="a in detail.actions"
            :key="a.action"
            :variant="PRIMARY.includes(a.action) ? 'primary' : a.rule.destructive ? 'danger' : 'secondary'"
            :disabled="!a.check.ok"
            :title="a.check.ok ? a.rule.description : a.check.message"
            @click="action = a.action"
          >{{ a.rule.label }}</UButton>
        </template>
        <span v-if="!detail.actions.length" class="t-foot c-3">该订单已结束，无可执行的状态动作</span>
      </template>
    </template>
  </UDrawer>

  <OrderActionDialog v-if="detail" :detail="detail" :action="action" @close="action = null" @done="onActionDone" />

  <UModal v-model:open="refundOpen" title="发起退款" description="创建退款申请，需财务审核后执行。金额不能超过可退额度。" :width="440">
    <UField label="退款金额" required :hint="detail ? `可退上限 ${formatFen(detail.refund.capFen)}` : ''">
      <UInput v-model="refundAmount" prefix="¥" inputmode="decimal" />
    </UField>
    <UField label="退款原因" required>
      <UInput v-model="refundReason" multiline :rows="3" :maxlength="200" placeholder="例如：用户申请售后，核实后同意退还 1 天费用" />
    </UField>
    <template #footer>
      <UButton @click="refundOpen = false">取消</UButton>
      <UButton variant="primary" :loading="refundSaving" :disabled="!refundReason.trim() || !refundAmount.trim()" @click="submitRefund">提交申请</UButton>
    </template>
  </UModal>
</template>

<style scoped>
.mono-title { font-variant-numeric: tabular-nums; letter-spacing: -0.2px; }
.group { display: flex; flex-direction: column; }
.sheet { background: var(--surface); border-radius: 16px; padding: 0 16px; margin: 0; }
.sheet.pad { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.block { display: block; margin-top: 2px; }
.link { border: 0; background: transparent; color: var(--accent); font-size: 13px; padding: 0 4px 8px; }
.link:hover { text-decoration: underline; }
.banner { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 14px; font-size: 13px; line-height: 18px; }
.banner :deep(svg) { margin-top: 1px; }
.b-accent { background: var(--accent-soft); color: #00509e; }
.b-warning { background: var(--warning-bg); color: var(--warning); }
.lines { display: flex; flex-direction: column; border-top: 1px solid var(--separator); }
.line { display: grid; grid-template-columns: 1fr auto 96px; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--separator); font-size: 15px; }
.line > :last-child { text-align: right; }
.line.total { font-weight: 600; border-bottom: 0; }
.assess { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; }
.assess-item { display: flex; justify-content: space-between; align-items: center; font-size: 15px; }
.list-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--separator); font-size: 15px; }
.list-row:last-child { border-bottom: 0; }
.empty-line { padding: 14px 0; color: var(--label-3); font-size: 13px; border-bottom: 1px solid var(--separator); }
.empty-line:last-child { border-bottom: 0; }
.money-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 14px 0; border-bottom: 1px solid var(--separator); }
.money-strip > div { display: flex; flex-direction: column; gap: 2px; font-size: 15px; font-weight: 600; }
.timeline { list-style: none; padding: 16px; display: flex; flex-direction: column; }
.timeline li { position: relative; display: flex; gap: 14px; padding-bottom: 18px; }
.timeline li:last-child { padding-bottom: 0; }
.timeline li::before { content: ''; position: absolute; left: 4px; top: 14px; bottom: -2px; width: 1px; background: var(--separator); }
.timeline li:last-child::before { display: none; }
.tl-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--label-4); margin-top: 5px; flex: none; }
.first .tl-dot { background: var(--label); }
.tl-title { font-size: 15px; font-weight: 500; }
.remark-input { display: flex; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--separator); }
.remark-input > :first-child { flex: 1; }
.demo-link { border: 0; background: transparent; color: var(--label-3); font-size: 12px; padding: 0; text-decoration: underline; text-underline-offset: 3px; }
.demo-link:hover { color: var(--label-2); }
@media (max-width: 767px) {
  .assess { grid-template-columns: 1fr; }
  .money-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 12px; }
  .line { grid-template-columns: 1fr 88px; }
  .line > :nth-child(2) { display: none; }
}
</style>
