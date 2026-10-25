<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { getOverview } from '@/services/dashboard'
import { useResource } from '@/composables/api'
import { session } from '@/composables/session'
import { formatFen } from '@/domain/money'
import { formatShort, weekdayLabel } from '@/domain/time'
import { UButton, UCard, UEmpty, UPageHeader, USkeleton, UTable, Icon, type Column } from '@/components/ui'
import BizBadge from '@/components/BizBadge.vue'
import TrendChart from '@/components/TrendChart.vue'
import type { IconName } from '@/components/icons/paths'

const router = useRouter()
const { data, loading, error, reload } = useResource(getOverview)

const now = Date.now()
const dateText = computed(() => {
  const d = new Date(now + 8 * 3600_000)
  return `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日 星期${weekdayLabel(now)}`
})

const kpis = computed(() => {
  const k = data.value?.kpis
  const list: { key: string; label: string; value: number; hint: string; icon: IconName; to: { path: string; query?: Record<string, string> } }[] = [
    { key: 'confirm', label: '待确认', value: k?.pendingConfirm ?? 0, hint: '核实需求后开放付款', icon: 'orders', to: { path: '/orders', query: { status: 'PENDING_CONFIRM' } } },
    { key: 'dispatch', label: '待派单', value: k?.needDispatch ?? 0, hint: '已确认但未安排人员', icon: 'caregiver', to: { path: '/dispatch' } },
    { key: 'today', label: '今日到岗', value: k?.arrivingToday ?? 0, hint: '今日开始服务的订单', icon: 'clock', to: { path: '/orders', query: { date: 'today' } } },
    { key: 'refund', label: '退款待处理', value: k?.refundTodo ?? 0, hint: '待审核、待执行或失败', icon: 'card', to: { path: '/payments', query: { tab: 'refunds' } } },
  ]
  return list
})

const trendLabels = computed(() =>
  (data.value?.trend ?? []).map((t) => {
    const d = new Date(t.day + 8 * 3600_000)
    return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
  }),
)

const columns: Column[] = [
  { key: 'orderNo', label: '订单号', primary: true },
  { key: 'patient', label: '就诊人' },
  { key: 'place', label: '地点', hideOnMobile: true },
  { key: 'startAt', label: '到岗时间' },
  { key: 'totalFen', label: '金额', align: 'right' },
  { key: 'status', label: '状态', align: 'right' },
]
</script>

<template>
  <div class="page">
    <UPageHeader title="工作台" :subtitle="`${dateText} · 北京时间${data && !data.scopeAll ? ' · 仅显示你负责的医院' : ''}`">
      <UButton icon="refresh" :loading="loading && !!data" @click="reload">刷新</UButton>
    </UPageHeader>

    <UCard v-if="error && !data" padding="none">
      <UEmpty tone="danger" icon="alert" title="工作台加载失败" :description="error.message">
        <UButton size="sm" icon="refresh" @click="reload">重试</UButton>
      </UEmpty>
    </UCard>

    <template v-else>
      <section class="kpis" aria-label="待办">
        <button v-for="k in kpis" :key="k.key" type="button" class="kpi" @click="router.push(k.to)">
          <div class="kpi-top">
            <span class="kpi-label">{{ k.label }}</span>
            <Icon :name="k.icon" :size="18" class="c-4" />
          </div>
          <USkeleton v-if="!data" width="56px" height="41px" radius="8px" />
          <span v-else class="kpi-value num" :class="{ zero: k.value === 0 }">{{ k.value }}</span>
          <span class="kpi-hint">{{ k.hint }}<Icon name="chevronRight" :size="14" class="go" /></span>
        </button>
      </section>

      <section class="grid-2">
        <UCard title="资金" :subtitle="`近 ${data?.money.windowDays ?? 30} 天 · 演示数据`">
          <div class="money">
            <div class="m-item">
              <span class="m-label">预约金额</span>
              <USkeleton v-if="!data" width="120px" height="28px" />
              <span v-else class="m-value num">{{ formatFen(data.money.bookedFen) }}</span>
              <span class="m-hint">下单总额，不代表已收款</span>
            </div>
            <div class="m-item">
              <span class="m-label">实收金额</span>
              <USkeleton v-if="!data" width="120px" height="28px" />
              <span v-else class="m-value num">{{ formatFen(data.money.receivedFen) }}</span>
              <span class="m-hint">服务端核实的支付成功</span>
            </div>
            <div class="m-item">
              <span class="m-label">已退金额</span>
              <USkeleton v-if="!data" width="120px" height="28px" />
              <span v-else class="m-value num">{{ formatFen(data.money.refundedFen) }}</span>
              <span class="m-hint">仅统计退款成功</span>
            </div>
          </div>
        </UCard>

        <UCard title="现场" subtitle="实时">
          <div class="live">
            <div class="live-row">
              <span class="c-2">服务中订单</span>
              <span class="num live-val">{{ data?.inService ?? '—' }}</span>
            </div>
            <div class="live-row">
              <span class="c-2">在岗护工 / 班组</span>
              <span class="num live-val">{{ data ? `${data.onDuty} / ${data.caregiverTotal}` : '—' }}</span>
            </div>
            <div class="live-row">
              <span class="c-2">当前身份</span>
              <span class="live-val sm">{{ session.admin?.name }}</span>
            </div>
          </div>
        </UCard>
      </section>

      <section class="grid-2 trend-row">
        <UCard title="新增订单" subtitle="近 14 天，按北京时间统计">
          <USkeleton v-if="!data" height="170px" radius="12px" />
          <TrendChart v-else :values="data.trend.map((t) => t.orders)" :labels="trendLabels" unit=" 单" />
        </UCard>
        <UCard title="实收" subtitle="近 14 天">
          <USkeleton v-if="!data" height="170px" radius="12px" />
          <TrendChart v-else :values="data.trend.map((t) => t.receivedFen)" :labels="trendLabels" :format="formatFen" />
        </UCard>
      </section>

      <UCard title="最近订单" padding="none">
        <template #actions>
          <UButton variant="plain" size="sm" icon-right="chevronRight" @click="router.push('/orders')">全部订单</UButton>
        </template>
        <UTable
          :columns="columns"
          :rows="data?.recent ?? []"
          :loading="loading && !data"
          clickable
          empty-title="还没有订单"
          @row-click="(r) => router.push({ path: '/orders', query: { id: r.id } })"
        >
          <template #cell-orderNo="{ row }"><span class="mono">{{ row.orderNo }}</span></template>
          <template #cell-patient="{ row }">{{ row.patientName }}</template>
          <template #cell-place="{ row }">
            <span class="ellipsis place">{{ row.campusName }} · {{ row.departmentName }}</span>
          </template>
          <template #cell-startAt="{ row }"><span class="num">{{ formatShort(row.startAt) }}</span></template>
          <template #cell-totalFen="{ row }"><span class="num">{{ formatFen(row.totalFen) }}</span></template>
          <template #cell-status="{ row }"><BizBadge :status="row.businessStatus" /></template>
        </UTable>
      </UCard>
    </template>
  </div>
</template>

<style scoped>
.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.kpi {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 20px 20px 18px;
  background: var(--surface); border: 0; border-radius: var(--radius-card); text-align: left;
  transition: transform 200ms var(--ease), box-shadow 200ms var(--ease);
}
.kpi:hover { box-shadow: var(--shadow-float); }
.kpi:active { transform: scale(0.99); }
.kpi:focus-visible { border-radius: var(--radius-card); }
.kpi-top { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.kpi-label { font-size: 13px; line-height: 18px; color: var(--label-2); font-weight: 500; }
.kpi-value { font-size: 34px; line-height: 41px; font-weight: 700; letter-spacing: -0.4px; }
.kpi-value.zero { color: var(--label-4); }
.kpi-hint { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; line-height: 16px; color: var(--label-3); }
.go { opacity: 0; transform: translateX(-2px); transition: opacity 200ms var(--ease), transform 200ms var(--ease); }
.kpi:hover .go { opacity: 1; transform: none; }

.grid-2 { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; }
.trend-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.money { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.m-item { display: flex; flex-direction: column; gap: 4px; padding: 4px 20px; }
.m-item:first-child { padding-left: 0; }
.m-item + .m-item { border-left: 1px solid var(--separator); }
.m-label { font-size: 13px; color: var(--label-2); font-weight: 500; }
.m-value { font-size: 22px; line-height: 28px; font-weight: 600; letter-spacing: -0.3px; }
.m-hint { font-size: 12px; line-height: 16px; color: var(--label-3); }
.live { display: flex; flex-direction: column; }
.live-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--separator); }
.live-row:last-child { border-bottom: 0; }
.live-val { font-size: 17px; font-weight: 600; }
.live-val.sm { font-size: 13px; font-weight: 500; color: var(--label-2); }
.place { display: inline-block; max-width: 260px; vertical-align: bottom; }

@media (max-width: 1023px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid-2, .trend-row { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 767px) {
  .kpis { gap: 12px; }
  .kpi { padding: 16px; }
  .kpi-value { font-size: 28px; line-height: 34px; }
  .money { grid-template-columns: 1fr; }
  .m-item, .m-item:first-child { padding: 12px 0; }
  .m-item + .m-item { border-left: 0; border-top: 1px solid var(--separator); }
}
</style>
