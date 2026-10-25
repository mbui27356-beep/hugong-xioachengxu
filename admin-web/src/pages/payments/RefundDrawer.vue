<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BUSINESS_STATUS_LABEL, REFUND_STATUS_LABEL, type BusinessStatus } from '@/contracts'
import { formatFen, fenToYuanInput, parseYuanToFen } from '@/domain/money'
import { validateRefundAmount } from '@/domain/refundRules'
import { formatDateTime } from '@/domain/time'
import { callApi, callApiRaw } from '@/composables/api'
import { can } from '@/composables/session'
import { confirmDialog } from '@/composables/confirm'
import { toast } from '@/composables/toast'
import { approveRefund, executeRefund, rejectRefund, retryRefund, type RefundRow } from '@/services/payments'
import { UBadge, UButton, UCheckbox, UDrawer, UField, UInput, UModal } from '@/components/ui'
import RefundBadge from '@/components/RefundBadge.vue'

const props = defineProps<{ refund: RefundRow | null }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const router = useRouter()

const open = computed({
  get: () => !!props.refund,
  set: (v: boolean) => { if (!v) emit('close') },
})
const amount = ref('')
const note = ref('')
const busy = ref(false)
const execOpen = ref(false)
const simulateFail = ref(false)
const touched = ref(false)

watch(() => props.refund?.id, () => {
  if (props.refund) amount.value = fenToYuanInput(Math.min(props.refund.requestedFen, props.refund.approvableCapFen))
  note.value = ''
  touched.value = false
}, { immediate: true })

const amountError = computed(() => {
  if (!props.refund) return null
  return validateRefundAmount(parseYuanToFen(amount.value), {
    paidFen: props.refund.summary.paidFen,
    refundedFen: props.refund.summary.refundedFen,
    inFlightFen: props.refund.summary.inFlightFen,
    capFen: props.refund.approvableCapFen,
  })
})

const otherInFlight = computed(() =>
  props.refund ? Math.max(0, props.refund.summary.paidFen - props.refund.summary.refundedFen - props.refund.approvableCapFen) : 0,
)

async function approve() {
  if (!props.refund) return
  touched.value = true
  if (amountError.value || !note.value.trim()) return
  busy.value = true
  const r = await callApiRaw(approveRefund(props.refund.id, { amount: amount.value, note: note.value, updatedAt: props.refund.updatedAt }))
  busy.value = false
  if (r.ok || r.error.code === 'STATE_CONFLICT') emit('changed')
}

async function reject() {
  if (!props.refund) return
  const c = await confirmDialog({
    title: '驳回退款申请',
    message: '驳回后会通知用户，可在售后中重新发起。',
    confirmText: '驳回',
    destructive: true,
    reason: { label: '驳回理由（将告知用户）', required: true, options: ['已提供服务，不符合退款条件', '与用户沟通后撤回', '金额核对有误，请重新申请'] },
  })
  if (!c.ok) return
  busy.value = true
  const r = await callApiRaw(rejectRefund(props.refund.id, { reason: c.reason, updatedAt: props.refund.updatedAt }))
  busy.value = false
  if (r.ok || r.error.code === 'STATE_CONFLICT') emit('changed')
}

async function execute() {
  if (!props.refund) return
  busy.value = true
  const fn = props.refund.status === 'FAILED' ? retryRefund : executeRefund
  const r = await callApi(fn(props.refund.id, simulateFail.value))
  busy.value = false
  execOpen.value = false
  simulateFail.value = false
  if (r) {
    if (r.status === 'SUCCEEDED') toast('退款成功', { tone: 'success', message: '已原路退回（模拟），订单资金状态已更新' })
    else toast('退款失败', { tone: 'danger', message: '已进入待人工处理，可复用原退款单号重试' })
    emit('changed')
  }
}
</script>

<template>
  <UDrawer v-model:open="open" :title="refund ? `退款 ${formatFen(refund.amountFen)}` : '退款'" :width="560">
    <template #meta>
      <div v-if="refund" class="row gap-8 wrap">
        <RefundBadge :status="refund.status" />
        <UBadge tone="muted">{{ refund.source === 'USER' ? '用户申请' : '后台发起' }}</UBadge>
        <span class="t-foot c-3 mono">{{ refund.outRefundNo }}</span>
      </div>
    </template>

    <template v-if="refund">
      <section class="stack">
        <p class="section-label">关联订单</p>
        <dl class="kv sheet">
          <dt>订单号</dt>
          <dd><button type="button" class="link mono" @click="router.push({ path: '/orders', query: { id: refund.orderId } })">{{ refund.orderNo }}</button></dd>
          <dt>业务状态</dt>
          <dd>{{ BUSINESS_STATUS_LABEL[refund.orderStatus as BusinessStatus] }}</dd>
          <dt>医院</dt>
          <dd>{{ refund.hospitalName }}</dd>
          <dt>就诊人</dt>
          <dd>{{ refund.patientName }}</dd>
          <dt>退款原因</dt>
          <dd>{{ refund.reason }}</dd>
        </dl>
      </section>

      <section class="stack">
        <p class="section-label">额度核对</p>
        <div class="sheet strip">
          <div><span class="t-caption c-3">实收</span><span class="num">{{ formatFen(refund.summary.paidFen) }}</span></div>
          <div><span class="t-caption c-3">已退</span><span class="num">{{ formatFen(refund.summary.refundedFen) }}</span></div>
          <div><span class="t-caption c-3">其他处理中</span><span class="num">{{ formatFen(otherInFlight) }}</span></div>
          <div><span class="t-caption c-3">本单最多可退</span><span class="num strong">{{ formatFen(refund.approvableCapFen) }}</span></div>
        </div>
        <p class="t-foot c-3 pad-x">规则：成功退款 + 处理中占额 ≤ 实收。失败单仍占额，重试复用同一退款单号，避免重复退款。</p>
      </section>

      <section v-if="refund.status === 'REQUESTED' && can('refund.approve')" class="stack">
        <p class="section-label">审核</p>
        <div class="sheet form">
          <UField label="核定金额" required :hint="`申请 ${formatFen(refund.requestedFen)}，最多可核定 ${formatFen(refund.approvableCapFen)}`" :error="touched ? amountError : null">
            <UInput v-model="amount" prefix="¥" inputmode="decimal" :invalid="touched && !!amountError" />
          </UField>
          <UField label="审核意见" required :error="touched && !note.trim() ? '请填写审核意见' : null">
            <UInput v-model="note" multiline :rows="2" :maxlength="200" placeholder="例如：已与家属确认，未服务 1 天" />
          </UField>
        </div>
      </section>

      <section class="stack">
        <p class="section-label">处理记录</p>
        <ol class="sheet timeline">
          <li v-for="(h, i) in [...refund.history].reverse()" :key="i" :class="{ first: i === 0 }">
            <span class="tl-dot" />
            <div class="stack gap-4">
              <span class="tl-title">{{ REFUND_STATUS_LABEL[h.status] }}</span>
              <span v-if="h.note" class="t-foot c-2">{{ h.note }}</span>
              <span class="t-caption c-3 num">{{ formatDateTime(h.at) }} · {{ h.actorName }}</span>
            </div>
          </li>
        </ol>
        <p class="t-foot c-3 pad-x">已执行 {{ refund.attempts }} 次。大额双人审核为可配置扩展，演示环境未启用。</p>
      </section>
    </template>

    <template #footer>
      <template v-if="refund">
        <template v-if="refund.status === 'REQUESTED' && can('refund.approve')">
          <UButton variant="danger" :disabled="busy" @click="reject">驳回</UButton>
          <UButton variant="primary" :loading="busy" @click="approve">批准退款</UButton>
        </template>
        <template v-else-if="(refund.status === 'APPROVED' || refund.status === 'FAILED') && can('refund.execute')">
          <UButton variant="primary" @click="execOpen = true">{{ refund.status === 'FAILED' ? '重试退款' : '执行退款' }}</UButton>
        </template>
        <span v-else class="t-foot c-3">{{ ['SUCCEEDED', 'REJECTED'].includes(refund.status) ? '该退款已结束' : refund.status === 'PROCESSING' ? '等待渠道返回结果' : '当前身份没有处理权限' }}</span>
      </template>
    </template>
  </UDrawer>

  <UModal v-model:open="execOpen" :title="refund?.status === 'FAILED' ? '重试退款' : '确认执行退款'" :width="420">
    <div v-if="refund" class="stack gap-12">
      <div class="confirm-amount">
        <span class="t-foot c-2">原路退回</span>
        <span class="big num">{{ formatFen(refund.amountFen) }}</span>
        <span class="t-foot c-3 mono">{{ refund.outRefundNo }}</span>
      </div>
      <p class="t-foot c-2">提交后由支付渠道处理，收到可信结果后才会更新为成功。此操作会写入操作日志。</p>
      <UCheckbox v-model="simulateFail">演示：模拟渠道返回失败</UCheckbox>
    </div>
    <template #footer>
      <UButton @click="execOpen = false">取消</UButton>
      <UButton variant="primary" :loading="busy" @click="execute">确认退款</UButton>
    </template>
  </UModal>
</template>

<style scoped>
.sheet { background: var(--surface); border-radius: 16px; padding: 0 16px; margin: 0; }
.strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 14px 16px; gap: 8px; }
.strip > div { display: flex; flex-direction: column; gap: 2px; font-size: 15px; font-weight: 500; }
.strong { font-weight: 700; }
.pad-x { padding: 8px 4px 0; }
.form { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.link { border: 0; background: transparent; color: var(--accent); padding: 0; font-size: 13px; }
.timeline { list-style: none; padding: 16px; display: flex; flex-direction: column; }
.timeline li { position: relative; display: flex; gap: 14px; padding-bottom: 18px; }
.timeline li:last-child { padding-bottom: 0; }
.timeline li::before { content: ''; position: absolute; left: 4px; top: 14px; bottom: -2px; width: 1px; background: var(--separator); }
.timeline li:last-child::before { display: none; }
.tl-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--label-4); margin-top: 5px; flex: none; }
.first .tl-dot { background: var(--label); }
.tl-title { font-size: 15px; font-weight: 500; }
.confirm-amount { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px; background: var(--fill-2); border-radius: 16px; }
.big { font-size: 34px; line-height: 41px; font-weight: 700; letter-spacing: -0.4px; }
@media (max-width: 767px) {
  .strip { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 12px; }
}
</style>
