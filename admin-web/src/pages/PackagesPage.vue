<script setup lang="ts">
import { computed, ref } from 'vue'
import { BILLING_UNIT_SHORT, PACKAGE_TYPE_LABEL } from '@/contracts'
import { formatFen } from '@/domain/money'
import { formatDateTime } from '@/domain/time'
import { callApi, useResource } from '@/composables/api'
import { confirmDialog } from '@/composables/confirm'
import { can } from '@/composables/session'
import { listPackages, setShelf, type PackageRow } from '@/services/packages'
import { UBadge, UButton, UCard, UPageHeader, USwitch, UTable, type Column } from '@/components/ui'
import PackageDrawer from './packages/PackageDrawer.vue'

const { data, loading, error, reload } = useResource(listPackages)
const canEdit = computed(() => can('package.edit'))
const drawerOpen = ref(false)
const selected = ref<PackageRow | null>(null)

function open(p: PackageRow | null) {
  selected.value = p
  drawerOpen.value = true
}
async function onSaved() {
  await reload()
  if (selected.value) selected.value = data.value?.find((p) => p.id === selected.value!.id) ?? null
  else drawerOpen.value = false
}
async function onShelf(p: PackageRow, on: boolean) {
  const c = await confirmDialog({
    title: on ? `上架 ${p.name}` : `下架 ${p.name}`,
    message: on
      ? `上架后用户可在 ${p.campusNames.length} 个院区看到并预约，当前单价 ${p.currentVersion ? formatFen(p.currentVersion.unitPriceFen) : '—'}。`
      : '下架后用户不能再选择该套餐，已创建的订单不受影响。',
    confirmText: on ? '上架' : '下架',
    destructive: !on,
  })
  if (!c.ok) return
  if (await callApi(setShelf(p.id, on ? 'ON_SHELF' : 'OFF_SHELF'), on ? '已上架' : '已下架')) await reload()
}

const columns: Column[] = [
  { key: 'name', label: '套餐', primary: true },
  { key: 'type', label: '类型' },
  { key: 'price', label: '当前单价', align: 'right' },
  { key: 'campus', label: '适用院区', hideOnMobile: true },
  { key: 'orders', label: '订单', align: 'right', hideOnMobile: true },
  { key: 'shelf', label: '上架', align: 'right' },
]
</script>

<template>
  <div class="page">
    <UPageHeader title="服务套餐" subtitle="价格以版本管理，改价生成新版本；报价由服务端按版本计算，历史订单保留快照。价格均为演示值。">
      <UButton v-if="canEdit" variant="primary" icon="plus" @click="open(null)">新增套餐</UButton>
    </UPageHeader>

    <UCard padding="none">
      <UTable
        :columns="columns"
        :rows="data ?? []"
        :loading="loading"
        :error="error"
        clickable
        :selected-id="drawerOpen ? selected?.id : null"
        empty-icon="package"
        empty-title="还没有套餐"
        empty-description="新增套餐并配置价格与适用院区后上架"
        @row-click="open"
        @retry="reload"
      >
        <template #cell-name="{ row }">
          <div class="stack gap-4">
            <span class="strong">{{ row.name }}</span>
            <span class="t-foot c-3 ellipsis content">{{ row.content }}</span>
          </div>
        </template>
        <template #cell-type="{ row }"><UBadge>{{ PACKAGE_TYPE_LABEL[row.type] }}</UBadge></template>
        <template #cell-price="{ row }">
          <div class="stack gap-4 price">
            <span class="num strong">{{ row.currentVersion ? formatFen(row.currentVersion.unitPriceFen) : '—' }}<span class="c-3 t-foot"> / {{ BILLING_UNIT_SHORT[row.unit] }}</span></span>
            <span class="t-caption c-3">v{{ row.currentVersion?.version ?? '—' }} · 共 {{ row.versionCount }} 个版本</span>
            <span v-if="row.scheduledVersion" class="t-caption c-warning num">{{ formatDateTime(row.scheduledVersion.effectiveFrom) }} 起 {{ formatFen(row.scheduledVersion.unitPriceFen) }}</span>
          </div>
        </template>
        <template #cell-campus="{ row }">
          <span class="t-foot c-2 ellipsis campus" :title="row.campusNames.join('、')">{{ row.campusNames.map((n) => n.split(' · ')[1]).join('、') }}</span>
        </template>
        <template #cell-orders="{ row }"><span class="num">{{ row.orderCount }}</span></template>
        <template #cell-shelf="{ row }">
          <USwitch :model-value="row.status === 'ON_SHELF'" :disabled="!canEdit" :label="`${row.name} 上架`" @change="(v) => onShelf(row, v)" />
        </template>
      </UTable>
    </UCard>

    <PackageDrawer :open="drawerOpen" :pkg="selected" @close="drawerOpen = false" @saved="onSaved" />
  </div>
</template>

<style scoped>
.strong { font-weight: 500; }
.content { display: inline-block; max-width: 340px; }
.campus { display: inline-block; max-width: 220px; vertical-align: bottom; }
.price { align-items: flex-end; }
@media (max-width: 767px) { .content { max-width: 260px; } }
</style>
