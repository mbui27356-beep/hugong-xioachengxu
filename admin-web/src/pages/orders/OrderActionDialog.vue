<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ACTION_RULES, isPaidCancel, type OrderAction } from '@/domain/orderRules'
import { formatFen, fenToYuanInput } from '@/domain/money'
import { formatDateTime } from '@/domain/time'
import { callApiRaw } from '@/composables/api'
import { toast } from '@/composables/toast'
import { performOrderAction, type OrderDetail } from '@/services/orders'
import { listCandidates, type CandidateRow } from '@/services/dispatch'
import { UButton, UCheckbox, UField, UInput, UModal, USelect } from '@/components/ui'

const props = defineProps<{ detail: OrderDetail; action: OrderAction | null }>()
const emit = defineEmits<{ close: []; done: [conflict: boolean] }>()

const open = computed({
  get: () => props.action !== null,
  set: (v: boolean) => { if (!v) emit('close') },
})
const rule = computed(() => (props.action ? ACTION_RULES[props.action] : null))
const reason = ref('')
const preset = ref('')
const capacity = ref(false)
const caregiverId = ref('')
const refundAmount = ref('')
const submitting = ref(false)
const touched = ref(false)
const candidates = ref<CandidateRow[]>([])

const PRESETS: Partial<Record<OrderAction, string[]>> = {
  reject: ['该时段人员已满', '服务地点暂不支持', '需求超出服务范围', '无法联系到家属'],
  cancel: ['用户主动取消', '患者出院或转院', '家属自行陪护', '重复下单'],
  endEarly: ['患者提前出院', '家属要求提前结束', '病情变化转科'],
}

watch(() => props.action, async (a) => {
  reason.value = ''
  preset.value = ''
  capacity.value = false
  caregiverId.value = ''
  touched.value = false
  candidates.value = []
  if (a === 'endEarly') refundAmount.value = ''
  if (a === 'confirm') {
    const r = await listCandidates(props.detail.order.id)
    if (r.ok) candidates.value = r.data
  }
})

const fullReason = computed(() => [preset.value, reason.value.trim()].filter(Boolean).join('：'))
const reasonMissing = computed(() => !!rule.value?.reasonRequired && !fullReason.value)
const paidCancel = computed(() => props.action === 'cancel' && isPaidCancel(props.detail.order))
const caregiverOptions = computed(() =>
  candidates.value.map((c) => ({
    value: c.id,
    label: `${c.name}${c.mode === 'ONE_TO_MANY' ? `（班组 ${c.capacity} 人）` : ''}${c.blocked ? ` — ${c.message}` : c.message ? ` — ${c.message}` : ''}`,
    disabled: c.blocked,
  })),
)
const selectedCandidate = computed(() => candidates.value.find((c) => c.id === caregiverId.value))

async function submit() {
  if (!props.action) return
  touched.value = true
  if (reasonMissing.value) return
  if (props.action === 'confirm' && !capacity.value) return
  if (props.action === 'endEarly' && !refundAmount.value.trim()) return
  submitting.value = true
  const r = await callApiRaw(
    performOrderAction(props.detail.order.id, props.action, {
      version: props.detail.order.version,
      reason: fullReason.value,
      capacityConfirmed: capacity.value,
      caregiverId: caregiverId.value || undefined,
      refundAmount: refundAmount.value,
    }),
  )
  submitting.value = false
  if (r.ok) {
    if (r.data.notice) toast(r.data.notice, { tone: r.data.businessStatus === 'PENDING_SERVICE' ? 'warning' : 'success', duration: 5200 })
    else toast(`已${rule.value?.label}`, { tone: 'success' })
    emit('done', false)
  } else if (r.error.code === 'STATE_CONFLICT' || r.error.code === 'PAYMENT_PENDING') {
    emit('done', true)
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="rule?.label" :description="rule?.description" :width="480">
    <template v-if="action === 'confirm'">
      <UField label="容量预留" hint="一对一护工在重叠时段不可重复指派；一对多班组按容量限制。" optional>
        <USelect v-model="caregiverId" placeholder="暂不预留，稍后在护工与调度安排" :options="caregiverOptions" />
      </UField>
      <p v-if="selectedCandidate?.conflicts.length" class="note warn">
        该班组同时段已有：{{ selectedCandidate.conflicts.map((c) => c.orderNo).join('、') }}
      </p>
      <div class="kv-mini">
        <span class="c-2">付款截止</span>
        <span>确认后按系统设置的付款期限计算</span>
      </div>
      <UCheckbox v-model="capacity">已与家属核实需求，人员或班组容量可以满足</UCheckbox>
      <p v-if="touched && !capacity" class="err">请先确认已核实需求</p>
    </template>

    <template v-if="action === 'cancel' && paidCancel">
      <div class="refund-box">
        <div class="kv-mini"><span class="c-2">实收</span><span class="num">{{ formatFen(detail.refund.paidFen) }}</span></div>
        <div class="kv-mini"><span class="c-2">将申请退款</span><span class="num strong">{{ formatFen(detail.refund.capFen) }}</span></div>
        <p class="note">未开始服务，按全额创建退款申请。退款需财务审核与执行，订单不会显示“退款已完成”。</p>
      </div>
    </template>

    <template v-if="action === 'endEarly'">
      <UField
        label="核定退款金额"
        required
        :hint="`可退上限 ${formatFen(detail.refund.capFen)}（实收 − 已退 − 处理中）。折算规则未定，需人工核定。`"
        :error="touched && !refundAmount.trim() ? '请填写金额' : null"
      >
        <UInput v-model="refundAmount" prefix="¥" inputmode="decimal" placeholder="0.00" :invalid="touched && !refundAmount.trim()">
          <template #end>
            <button type="button" class="link-btn" @click="refundAmount = fenToYuanInput(detail.refund.capFen)">全部</button>
          </template>
        </UInput>
      </UField>
    </template>

    <template v-if="action === 'start'">
      <div class="kv-mini">
        <span class="c-2">预约到岗</span>
        <span class="num">{{ formatDateTime(detail.order.startAt) }}</span>
      </div>
    </template>

    <UField
      v-if="rule && rule.reasonLabel"
      :label="rule.reasonLabel"
      :required="rule.reasonRequired"
      :error="touched && reasonMissing ? '请填写' : null"
    >
      <div class="stack gap-8">
        <USelect v-if="action && PRESETS[action]" v-model="preset" placeholder="选择常用原因" :options="PRESETS[action]!.map((p) => ({ label: p, value: p }))" />
        <UInput v-model="reason" multiline :rows="3" :maxlength="200" placeholder="补充说明" :invalid="touched && reasonMissing" />
      </div>
    </UField>

    <p class="c-3 t-foot">操作会记录到订单时间线与操作日志，并带上订单版本号 v{{ detail.order.version }} 防止重复处理。</p>

    <template #footer>
      <UButton @click="emit('close')">取消</UButton>
      <UButton :variant="rule?.destructive ? 'danger' : 'primary'" :loading="submitting" @click="submit">{{ rule?.label }}</UButton>
    </template>
  </UModal>
</template>

<style scoped>
.kv-mini { display: flex; justify-content: space-between; gap: 16px; font-size: 15px; }
.strong { font-weight: 600; }
.note { font-size: 13px; line-height: 18px; color: var(--label-2); background: var(--fill-2); border-radius: var(--radius-control); padding: 10px 12px; }
.note.warn { color: var(--warning); background: var(--warning-bg); }
.refund-box { display: flex; flex-direction: column; gap: 10px; }
.err { font-size: 12px; color: var(--danger); margin-top: -8px; }
.link-btn { border: 0; background: transparent; color: var(--accent); font-size: 13px; padding: 0 2px; }
</style>
