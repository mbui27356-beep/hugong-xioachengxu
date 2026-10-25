<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CAREGIVER_DUTY_LABEL, PACKAGE_TYPE_LABEL } from '@/contracts'
import { formatShort } from '@/domain/time'
import { callApiRaw } from '@/composables/api'
import { can } from '@/composables/session'
import { assignCaregiver, listCandidates, type CandidateRow } from '@/services/dispatch'
import type { OrderRow } from '@/services/orders'
import { UBadge, UButton, UDrawer, UEmpty, UField, UInput, USkeleton, Icon } from '@/components/ui'

const props = defineProps<{ order: OrderRow | null }>()
const emit = defineEmits<{ close: []; done: [] }>()
const open = computed({ get: () => !!props.order, set: (v: boolean) => { if (!v) emit('close') } })

const candidates = ref<CandidateRow[]>([])
const loading = ref(false)
const err = ref<string | null>(null)
const picked = ref<string | null>(null)
const reason = ref('')
const saving = ref(false)
const touched = ref(false)

async function load() {
  if (!props.order) return
  loading.value = true
  err.value = null
  const r = await listCandidates(props.order.id)
  loading.value = false
  if (r.ok) candidates.value = r.data
  else err.value = r.error.message
}
watch(() => props.order?.id, () => {
  picked.value = null
  reason.value = ''
  touched.value = false
  candidates.value = []
  void load()
}, { immediate: true })

const isReassign = computed(() => !!props.order?.caregiverName)
const pickedRow = computed(() => candidates.value.find((c) => c.id === picked.value))

async function submit() {
  if (!props.order || !picked.value) return
  touched.value = true
  if (isReassign.value && !reason.value.trim()) return
  saving.value = true
  const r = await callApiRaw(assignCaregiver(props.order.id, picked.value, { version: props.order.version, reason: reason.value }))
  saving.value = false
  if (r.ok) emit('done')
  else if (r.error.code === 'STATE_CONFLICT') {
    await load()
    emit('done')
  }
}
</script>

<template>
  <UDrawer v-model:open="open" :title="isReassign ? '改派护工' : '安排护工'" :subtitle="order ? `${order.orderNo} · ${order.campusName} · ${order.departmentName}` : ''" :width="560">
    <template v-if="order">
      <div class="summary">
        <div><span class="t-caption c-3">服务时段</span><span class="num">{{ formatShort(order.startAt) }} – {{ formatShort(order.endAt) }}</span></div>
        <div><span class="t-caption c-3">套餐类型</span><span>{{ PACKAGE_TYPE_LABEL[order.packageType] }}</span></div>
        <div><span class="t-caption c-3">当前安排</span><span>{{ order.caregiverName ?? '未安排' }}</span></div>
      </div>
      <p class="t-foot c-3 rule"><Icon name="info" :size="14" />一对一护工在重叠时段不能重复指派；一对多班组按最大服务人数限制。区间开始包含、结束不包含。</p>

      <section class="stack">
        <p class="section-label">可服务该院区的人员</p>
        <div v-if="loading && !candidates.length" class="stack gap-8"><USkeleton height="60px" radius="16px" /><USkeleton height="60px" radius="16px" /></div>
        <UEmpty v-else-if="err" tone="danger" icon="alert" title="加载失败" :description="err" compact><UButton size="sm" @click="load">重试</UButton></UEmpty>
        <UEmpty v-else-if="!candidates.length" icon="caregiver" title="没有可服务该院区的护工" description="请先在护工列表中维护服务院区" compact />
        <div v-else class="sheet">
          <button
            v-for="c in candidates"
            :key="c.id"
            type="button"
            class="cand"
            :class="{ picked: picked === c.id, blocked: c.blocked }"
            :disabled="c.blocked || c.name === order.caregiverName"
            @click="picked = c.id"
          >
            <span class="radio" :class="{ on: picked === c.id }" />
            <div class="grow stack gap-4">
              <div class="row gap-8 wrap">
                <span class="c-name">{{ c.name }}</span>
                <UBadge :tone="c.duty === 'ON_DUTY' ? 'success' : c.duty === 'LEAVE' ? 'danger' : 'neutral'">{{ CAREGIVER_DUTY_LABEL[c.duty] }}</UBadge>
                <UBadge tone="muted">{{ c.mode === 'ONE_TO_MANY' ? `班组 · ${c.capacity} 人` : '一对一' }}</UBadge>
                <UBadge v-if="c.name === order.caregiverName" tone="accent">当前</UBadge>
              </div>
              <span v-if="c.message" class="t-foot" :class="c.blocked ? 'c-danger' : 'c-warning'">{{ c.message }}</span>
              <span v-for="x in c.conflicts" :key="x.orderNo" class="t-caption c-3 num">{{ x.orderNo }} · {{ x.range }}</span>
            </div>
          </button>
        </div>
      </section>

      <UField v-if="isReassign" label="改派原因" required hint="原派单记录会保留，标记为已改派" :error="touched && !reason.trim() ? '请填写改派原因' : null">
        <UInput v-model="reason" multiline :rows="2" :maxlength="200" placeholder="例如：原护工临时请假" />
      </UField>
    </template>

    <template #footer>
      <span v-if="!can('dispatch.assign')" class="t-foot c-3">当前身份不能派单</span>
      <template v-else>
        <UButton @click="emit('close')">取消</UButton>
        <UButton variant="primary" :disabled="!picked" :loading="saving" @click="submit">{{ isReassign ? '确认改派' : '确认安排' }}{{ pickedRow ? ` ${pickedRow.name}` : '' }}</UButton>
      </template>
    </template>
  </UDrawer>
</template>

<style scoped>
.summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; background: var(--surface); border-radius: 16px; padding: 14px 16px; }
.summary > div { display: flex; flex-direction: column; gap: 2px; font-size: 15px; }
.rule { display: flex; gap: 6px; align-items: flex-start; margin-top: -8px; padding: 0 4px; }
.rule :deep(svg) { margin-top: 2px; }
.sheet { background: var(--surface); border-radius: 16px; padding: 0 8px; }
.cand {
  display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 14px 8px; border: 0; background: transparent;
  border-bottom: 1px solid var(--separator); text-align: left; border-radius: 0;
}
.cand:last-child { border-bottom: 0; }
.cand:hover:not(:disabled) { background: rgba(0, 0, 0, 0.02); }
.cand:disabled { cursor: not-allowed; }
.cand.blocked .c-name { color: var(--label-3); }
.cand:focus-visible { border-radius: 12px; }
.radio { width: 20px; height: 20px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--label-4); margin-top: 1px; flex: none; transition: box-shadow 200ms var(--ease); }
.radio.on { box-shadow: inset 0 0 0 6px var(--accent); }
.blocked .radio { opacity: 0.4; }
.c-name { font-size: 15px; font-weight: 600; }
@media (max-width: 767px) { .summary { grid-template-columns: 1fr; } }
</style>
