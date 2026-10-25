<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PAYMENT_ATTEMPT_LABEL, type PaymentAttemptStatus, type RefundStatus } from '@/contracts'
import { formatFen } from '@/domain/money'
import { formatDateTime, formatRelative } from '@/domain/time'
import { useResource } from '@/composables/api'
import { getReconciliation, listPayments, listRefunds, type RefundRow } from '@/services/payments'
import { ATTEMPT_TONE } from '@/ui/status'
import { UBadge, UButton, UCard, UEmpty, UInput, UPageHeader, USegmented, USelect, USkeleton, UTable, Icon, type Column } from '@/components/ui'
import RefundBadge from '@/components/RefundBadge.vue'
import RefundDrawer from './payments/RefundDrawer.vue'

const route = useRoute()
const router = useRouter()
const tab = ref<string>((route.query.tab as string) || 'refunds')
watch(tab, (v) => void router.replace({ query: { tab: v } }))

// ---------- 退款 ----------
const refundFilter = ref<RefundStatus | '' | 'TODO'>('TODO')
const refunds = useResource(() => listRefunds({ status: refundFilter.value }))
watch(refundFilter, () => void refunds.reload())
const selectedRefundId = ref<string | null>(null)
const selectedRefund = computed<RefundRow | null>(() => refunds.data.value?.items.find((r) => r.id === selectedRefundId.value) ?? null)
const refundSegs = computed(() => [
  { value: 'TODO', label: '待处理', count: refunds.data.value?.counts.TODO },
  { value: 'PROCESSING', label: '处理中', count: refunds.data.value?.counts.PROCESSING },
  { value: '', label: '全部', count: refunds.data.value?.counts.ALL },
])
async function onRefundChanged() {
  // 处理后的退款可能离开“待处理”筛选，切换到全部以便继续查看
  if (refundFilter.value === 'TODO') {
    refundFilter.value = ''
  } else {
    await refunds.reload()
  }
  void recon.reload()
}

const refundCols: Column[] = [
  { key: 'no', label: '退款单', primary: true },
  { key: 'order', label: '订单' },
  { key: 'amount', label: '金额', align: 'right' },
  { key: 'reason', label: '原因', hideOnMobile: true },
  { key: 'status', label: '状态' },
  { key: 'updated', label: '更新', hideOnMobile: true },
  { key: 'next', label: '下一步', align: 'right' },
]
const NEXT: Partial<Record<RefundStatus, string>> = { REQUESTED: '审核', APPROVED: '执行', FAILED: '重试' }

// ---------- 支付流水 ----------
const payKeyword = ref('')
const payStatus = ref<PaymentAttemptStatus | ''>('')
const payStatusOptions = (Object.keys(PAYMENT_ATTEMPT_LABEL) as PaymentAttemptStatus[]).map((k) => ({ label: PAYMENT_ATTEMPT_LABEL[k], value: k }))
const payments = useResource(() => listPayments({ keyword: payKeyword.value, status: payStatus.value }), { immediate: false })
let pt = 0
watch([payKeyword, payStatus], () => {
  window.clearTimeout(pt)
  pt = window.setTimeout(() => void payments.reload(), 200)
})
const payCols: Column[] = [
  { key: 'trade', label: '商户单号', primary: true },
  { key: 'order', label: '订单' },
  { key: 'patient', label: '就诊人', hideOnMobile: true },
  { key: 'amount', label: '金额', align: 'right' },
  { key: 'status', label: '状态' },
  { key: 'txn', label: '渠道交易号', hideOnMobile: true },
  { key: 'time', label: '时间' },
]

// ---------- 对账 ----------
const recon = useResource(getReconciliation, { immediate: false })

watch(tab, (v) => {
  if (v === 'payments' && !payments.data.value) void payments.reload()
  if (v === 'recon' && !recon.data.value) void recon.reload()
}, { immediate: true })
</script>

<template>
  <div class="page">
    <UPageHeader title="支付退款" subtitle="支付状态以服务端核实为准；退款需审核、确认后原路退回，失败单复用原单号重试。">
      <USegmented
        v-model="tab"
        :options="[{ value: 'refunds', label: '退款处理' }, { value: 'payments', label: '支付流水' }, { value: 'recon', label: '账单核对' }]"
        aria-label="视图"
      />
    </UPageHeader>

    <template v-if="tab === 'refunds'">
      <div class="toolbar">
        <USegmented v-model="refundFilter" :options="refundSegs" size="sm" />
        <span class="grow" />
        <UButton icon="refresh" size="sm" :loading="refunds.loading.value && !!refunds.data.value" @click="refunds.reload">刷新</UButton>
      </div>
      <UCard padding="none">
        <UTable
          :columns="refundCols"
          :rows="refunds.data.value?.items ?? []"
          :loading="refunds.loading.value"
          :error="refunds.error.value"
          clickable
          :selected-id="selectedRefundId"
          empty-icon="card"
          :empty-title="refundFilter === 'TODO' ? '没有待处理的退款' : '暂无退款记录'"
          empty-description="已付款订单取消、提前结束或售后申请会生成退款单"
          @row-click="(r) => (selectedRefundId = r.id)"
          @retry="refunds.reload"
        >
          <template #cell-no="{ row }">
            <div class="stack gap-4">
              <span class="mono strong">{{ row.outRefundNo }}</span>
              <span class="t-caption c-3">{{ row.source === 'USER' ? '用户申请' : '后台发起' }}</span>
            </div>
          </template>
          <template #cell-order="{ row }">
            <div class="stack gap-4 cell-m">
              <span class="mono">{{ row.orderNo }}</span>
              <span class="t-foot c-3">{{ row.patientName }}</span>
            </div>
          </template>
          <template #cell-amount="{ row }">
            <div class="stack gap-4 amount">
              <span class="num strong">{{ formatFen(row.amountFen) }}</span>
              <span v-if="row.amountFen !== row.requestedFen" class="t-caption c-3 num">申请 {{ formatFen(row.requestedFen) }}</span>
            </div>
          </template>
          <template #cell-reason="{ row }"><span class="ellipsis reason">{{ row.reason }}</span></template>
          <template #cell-status="{ row }"><RefundBadge :status="row.status" /></template>
          <template #cell-updated="{ row }"><span class="c-2 t-foot">{{ formatRelative(row.updatedAt) }}</span></template>
          <template #cell-next="{ row }">
            <span v-if="NEXT[row.status]" class="next">{{ NEXT[row.status] }}<Icon name="chevronRight" :size="14" /></span>
            <span v-else class="c-4">—</span>
          </template>
        </UTable>
      </UCard>
    </template>

    <template v-else-if="tab === 'payments'">
      <div class="toolbar">
        <UInput v-model="payKeyword" class="grow" icon="search" placeholder="订单号、商户单号或渠道交易号" clearable />
        <USelect
          v-model="payStatus"
          class="sel"
          placeholder="全部状态"
          :options="payStatusOptions"
        />
      </div>
      <UCard padding="none">
        <UTable
          :columns="payCols"
          :rows="payments.data.value ?? []"
          :loading="payments.loading.value"
          :error="payments.error.value"
          clickable
          empty-icon="card"
          empty-title="没有支付流水"
          @row-click="(r) => router.push({ path: '/orders', query: { id: r.orderId } })"
          @retry="payments.reload"
        >
          <template #cell-trade="{ row }"><span class="mono strong">{{ row.outTradeNo }}</span></template>
          <template #cell-order="{ row }"><span class="mono">{{ row.orderNo }}</span></template>
          <template #cell-patient="{ row }">{{ row.patientName }}</template>
          <template #cell-amount="{ row }"><span class="num">{{ formatFen(row.amountFen) }}</span></template>
          <template #cell-status="{ row }"><UBadge :tone="ATTEMPT_TONE[row.status]">{{ PAYMENT_ATTEMPT_LABEL[row.status] }}</UBadge></template>
          <template #cell-txn="{ row }"><span class="mono c-2">{{ row.transactionId ?? '—' }}</span></template>
          <template #cell-time="{ row }"><span class="num t-foot c-2 nowrap">{{ formatDateTime(row.paidAt ?? row.createdAt) }}</span></template>
        </UTable>
      </UCard>
      <p class="t-foot c-3 note">演示环境的交易号为模拟值。正式环境商户单号与渠道交易号均唯一，重复回调只记一次。</p>
    </template>

    <template v-else>
      <UCard v-if="recon.error.value" padding="none">
        <UEmpty tone="danger" icon="alert" title="对账数据加载失败" :description="recon.error.value.message">
          <UButton size="sm" icon="refresh" @click="recon.reload">重试</UButton>
        </UEmpty>
      </UCard>
      <template v-else>
        <section class="recon">
          <div v-for="m in [
            { label: '实收', value: recon.data.value?.paidFen, hint: `${recon.data.value?.successCount ?? 0} 笔支付成功` },
            { label: '已退', value: recon.data.value?.refundedFen, hint: `${recon.data.value?.refundCount ?? 0} 笔退款成功` },
            { label: '退款处理中', value: recon.data.value?.inFlightFen, hint: '已批准或处理中' },
            { label: '净收入', value: recon.data.value?.netFen, hint: '实收 − 已退' },
          ]" :key="m.label" class="tile">
            <span class="t-foot c-2">{{ m.label }}</span>
            <USkeleton v-if="m.value === undefined" width="120px" height="28px" />
            <span v-else class="tile-v num">{{ formatFen(m.value) }}</span>
            <span class="t-caption c-3">{{ m.hint }}</span>
          </div>
        </section>
        <UCard title="异常与待核对" subtitle="每日检查收款与退款差异；异常需人工处理">
          <template #actions><UButton size="sm" icon="refresh" :loading="recon.loading.value" @click="recon.reload">重新核对</UButton></template>
          <div v-if="!recon.data.value" class="stack gap-12"><USkeleton height="44px" /><USkeleton height="44px" /></div>
          <UEmpty v-else-if="!recon.data.value.anomalies.length" icon="check" title="没有发现差异" description="支付、退款与订单资金状态一致" compact />
          <div v-else class="anoms">
            <div v-for="(a, i) in recon.data.value.anomalies" :key="i" class="anom">
              <UBadge :tone="a.level">{{ a.title }}</UBadge>
              <span class="grow t-foot c-2">{{ a.detail }}</span>
              <span class="mono c-2">{{ a.orderNo }}</span>
            </div>
          </div>
        </UCard>
      </template>
    </template>

    <RefundDrawer :refund="selectedRefund" @close="selectedRefundId = null" @changed="onRefundChanged" />
  </div>
</template>

<style scoped>
.sel { width: 160px; }
.strong { font-weight: 500; color: var(--label); }
.reason { display: inline-block; max-width: 220px; vertical-align: bottom; }
.amount { align-items: flex-end; }
.next { display: inline-flex; align-items: center; gap: 2px; color: var(--accent); font-size: 13px; font-weight: 500; }
.note { padding: 0 4px; margin-top: -16px; }
.recon { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.tile { background: var(--surface); border-radius: var(--radius-card); padding: 20px; display: flex; flex-direction: column; gap: 6px; }
.tile-v { font-size: 22px; line-height: 28px; font-weight: 600; letter-spacing: -0.3px; }
.anoms { display: flex; flex-direction: column; }
.anom { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--separator); }
.anom:last-child { border-bottom: 0; }
@media (max-width: 1023px) { .recon { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 767px) {
  .anom { flex-wrap: wrap; }
  .cell-m { align-items: flex-end; }
  .recon { gap: 12px; }
  .tile { padding: 16px; }
}
</style>
