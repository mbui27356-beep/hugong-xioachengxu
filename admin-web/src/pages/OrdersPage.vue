<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BUSINESS_STATUS_LABEL, PAYMENT_STATUS_LABEL, type BusinessStatus, type PaymentStatus } from '@/contracts'
import { formatFen } from '@/domain/money'
import { formatRelative, formatShort } from '@/domain/time'
import { useResource } from '@/composables/api'
import { listOrders } from '@/services/orders'
import { listHospitalOptions } from '@/services/settings'
import { session } from '@/composables/session'
import { UButton, UCard, UInput, UPageHeader, USegmented, USelect, UTable, UBadge, Icon, type Column } from '@/components/ui'
import BizBadge from '@/components/BizBadge.vue'
import PayBadge from '@/components/PayBadge.vue'
import OrderDrawer from './orders/OrderDrawer.vue'

const route = useRoute()
const router = useRouter()

const filter = reactive({
  status: (route.query.status as BusinessStatus) || '',
  hospitalId: '',
  keyword: '',
  paymentStatus: '' as PaymentStatus | '',
  dispatch: '' as '' | 'needed',
  date: ((route.query.date as string) === 'today' ? 'today' : '') as '' | 'today',
})
const keywordInput = ref('')
let t = 0
watch(keywordInput, (v) => {
  window.clearTimeout(t)
  t = window.setTimeout(() => (filter.keyword = v), 250)
})

const { data, loading, error, reload } = useResource(() => listOrders({ ...filter }))
watch(() => ({ ...filter }), () => void reload(), { deep: true })

const hospitals = useResource(listHospitalOptions)
const hospitalOptions = computed(() =>
  (hospitals.data.value ?? [])
    .filter((h) => session.admin?.allowedHospitalIds === '*' || session.admin?.allowedHospitalIds.includes(h.id))
    .map((h) => ({ label: h.name, value: h.id })),
)

const statusOptions = computed(() => {
  const c = data.value?.counts ?? {}
  const keys: (BusinessStatus | '')[] = ['', 'PENDING_CONFIRM', 'PENDING_PAYMENT', 'PENDING_SERVICE', 'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'REJECTED']
  return keys.map((k) => ({ value: k, label: k ? BUSINESS_STATUS_LABEL[k] : '全部', count: c[k || 'ALL'] }))
})
const paymentOptions = (Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[]).map((k) => ({ label: PAYMENT_STATUS_LABEL[k], value: k }))
const hasExtraFilter = computed(() => !!(filter.hospitalId || filter.paymentStatus || filter.dispatch || filter.date || keywordInput.value))
function clearFilters() {
  Object.assign(filter, { hospitalId: '', paymentStatus: '', dispatch: '', date: '' })
  keywordInput.value = ''
}

// 抽屉与地址栏同步，方便分享与返回
const selectedId = computed(() => (route.query.id as string) || null)
function openOrder(id: string) {
  void router.replace({ query: { ...route.query, id } })
}
function closeOrder() {
  const q = { ...route.query }
  delete q.id
  void router.replace({ query: q })
}

const columns: Column[] = [
  { key: 'orderNo', label: '订单', primary: true, width: '170px' },
  { key: 'patient', label: '就诊人' },
  { key: 'place', label: '地点', hideOnMobile: true },
  { key: 'pkg', label: '套餐', hideOnMobile: true },
  { key: 'time', label: '到岗时间' },
  { key: 'amount', label: '金额', align: 'right' },
  { key: 'status', label: '状态' },
  { key: 'caregiver', label: '护工', hideOnMobile: true },
]
</script>

<template>
  <div class="page">
    <UPageHeader title="预约订单" subtitle="确认、拒绝、开始与结束服务均由服务端校验状态与版本号，页面不直接改状态。">
      <UButton icon="refresh" :loading="loading && !!data" @click="reload">刷新</UButton>
    </UPageHeader>

    <div class="stack gap-12">
      <USegmented v-model="filter.status" :options="statusOptions" aria-label="业务状态" />
      <div class="toolbar">
        <UInput v-model="keywordInput" class="grow kw" icon="search" placeholder="订单号、就诊人、联系人或手机尾号" clearable />
        <USelect v-model="filter.hospitalId" placeholder="全部医院" :options="hospitalOptions" class="sel" />
        <USelect v-model="filter.paymentStatus" placeholder="全部支付状态" :options="paymentOptions" class="sel" />
        <USelect v-model="filter.dispatch" placeholder="全部派单状态" :options="[{ label: '仅看待派单', value: 'needed' }]" class="sel" />
        <button v-if="filter.date === 'today'" type="button" class="chip" @click="filter.date = ''">
          今日到岗 <Icon name="close" :size="12" :stroke="2" />
        </button>
        <UButton v-if="hasExtraFilter" variant="plain" size="sm" @click="clearFilters">清除筛选</UButton>
      </div>
    </div>

    <UCard padding="none">
      <UTable
        :columns="columns"
        :rows="data?.items ?? []"
        :loading="loading"
        :error="error"
        clickable
        :selected-id="selectedId"
        empty-icon="orders"
        :empty-title="hasExtraFilter || filter.status ? '没有符合条件的订单' : '还没有订单'"
        :empty-description="hasExtraFilter || filter.status ? '调整筛选条件后再试' : '用户在小程序提交预约后会出现在这里'"
        @row-click="(r) => openOrder(r.id)"
        @retry="reload"
      >
        <template #cell-orderNo="{ row }">
          <div class="stack gap-4">
            <span class="mono strong">{{ row.orderNo }}</span>
            <span class="t-caption c-3">{{ formatRelative(row.createdAt) }}</span>
          </div>
        </template>
        <template #cell-patient="{ row }">
          <div class="stack gap-4 cell-right-m">
            <span>{{ row.patientName }}</span>
            <span class="t-foot c-3 m-hide-inline nowrap">{{ row.patientMeta }}</span>
          </div>
        </template>
        <template #cell-place="{ row }">
          <div class="stack gap-4 place">
            <span class="ellipsis">{{ row.campusName }}</span>
            <span class="t-foot c-3 ellipsis">{{ row.departmentName }}</span>
          </div>
        </template>
        <template #cell-pkg="{ row }">
          <div class="stack gap-4 pkg">
            <span class="ellipsis">{{ row.packageName }}</span>
            <span class="t-foot c-3">{{ row.units }} {{ row.unitLabel }}</span>
          </div>
        </template>
        <template #cell-time="{ row }"><span class="num nowrap">{{ formatShort(row.startAt) }}</span></template>
        <template #cell-amount="{ row }"><span class="num nowrap">{{ formatFen(row.totalFen) }}</span></template>
        <template #cell-status="{ row }">
          <div class="row gap-4 wrap badges">
            <BizBadge :status="row.businessStatus" />
            <PayBadge v-if="row.paymentStatus !== 'UNPAID'" :status="row.paymentStatus" />
            <UBadge v-if="row.refundInFlight" tone="warning">退款中</UBadge>
          </div>
        </template>
        <template #cell-caregiver="{ row }">
          <span v-if="row.caregiverName">{{ row.caregiverName }}</span>
          <UBadge v-else-if="row.needsDispatch" tone="warning" dot>待派单</UBadge>
          <span v-else class="c-4">—</span>
        </template>
      </UTable>
    </UCard>
    <p v-if="data" class="t-foot c-3 foot-note">共 {{ data.items.length }} 条 · 就诊人与电话默认脱敏 · 时间为北京时间</p>

    <OrderDrawer :order-id="selectedId" @close="closeOrder" @changed="reload" />
  </div>
</template>

<style scoped>
.kw { min-width: 240px; }
.sel { width: 160px; }
.strong { font-weight: 500; color: var(--label); }
.place, .pkg { max-width: 200px; }
.badges { justify-content: flex-start; }
.chip {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 0; border-radius: 999px;
  background: var(--label); color: #fff; font-size: 13px;
}
.foot-note { padding: 0 4px; margin-top: -16px; }
@media (max-width: 767px) {
  .toolbar { gap: 8px; }
  .kw { min-width: 100%; }
  .sel { width: calc(50% - 4px); }
  .badges { justify-content: flex-end; }
  .m-hide-inline { display: none; }
  .cell-right-m { align-items: flex-end; }
}
</style>
