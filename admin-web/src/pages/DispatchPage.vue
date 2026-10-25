<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CAREGIVER_DUTY_LABEL, PACKAGE_TYPE_LABEL, type CaregiverDuty, type PackageType } from '@/contracts'
import { formatShort } from '@/domain/time'
import { callApi, useResource } from '@/composables/api'
import { can } from '@/composables/session'
import { listCampusOptions } from '@/services/catalog'
import { listCaregivers, listDispatchQueue, saveCaregiver, setCaregiverDuty, type CaregiverInput, type CaregiverRow } from '@/services/dispatch'
import type { OrderRow } from '@/services/orders'
import { UBadge, UButton, UCard, UCheckbox, UField, UInput, UModal, UPageHeader, USegmented, USelect, UTable, type Column } from '@/components/ui'
import BizBadge from '@/components/BizBadge.vue'
import AssignDrawer from './dispatch/AssignDrawer.vue'

const route = useRoute()
const router = useRouter()
const tab = ref('queue')
const queueFilter = ref('needed')

const queue = useResource(listDispatchQueue)
const caregivers = useResource(listCaregivers)
const campusOpts = useResource(listCampusOptions)

const rows = computed(() => (queue.data.value ?? []).filter((r) => queueFilter.value !== 'needed' || r.needsDispatch))
const assigning = ref<OrderRow | null>(null)
watch(() => queue.data.value, (list) => {
  const id = route.query.order as string | undefined
  if (id && list) assigning.value = list.find((r) => r.id === id) ?? null
}, { immediate: true })
function closeAssign() {
  assigning.value = null
  if (route.query.order) void router.replace({ query: {} })
}
async function onAssigned() {
  closeAssign()
  await Promise.all([queue.reload(), caregivers.reload()])
}

const queueCols: Column[] = [
  { key: 'order', label: '订单', primary: true },
  { key: 'place', label: '地点' },
  { key: 'type', label: '类型', hideOnMobile: true },
  { key: 'range', label: '服务时段' },
  { key: 'status', label: '状态', hideOnMobile: true },
  { key: 'cg', label: '护工', align: 'right' },
]

// 护工维护
const cgCols: Column[] = [
  { key: 'name', label: '姓名 / 班组', primary: true },
  { key: 'mode', label: '类型' },
  { key: 'campus', label: '服务院区', hideOnMobile: true },
  { key: 'load', label: '当前安排', align: 'right' },
  { key: 'duty', label: '在岗状态', align: 'right' },
  { key: 'ops', label: '', align: 'right' },
]
const formOpen = ref(false)
const form = reactive<CaregiverInput>({ name: '', phone: '', gender: '女', campusIds: [], mode: 'ONE_TO_ONE', capacity: 1, shifts: ['全天'], note: '' })
const capacityText = ref('4')
const saving = ref(false)
function editCg(c?: CaregiverRow) {
  Object.assign(form, c
    ? { id: c.id, name: c.name, phone: '', gender: c.gender, campusIds: [...c.campusIds], mode: c.mode, capacity: c.capacity, shifts: [...c.shifts], note: c.note }
    : { id: undefined, name: '', phone: '', gender: '女', campusIds: [], mode: 'ONE_TO_ONE', capacity: 1, shifts: ['全天'], note: '' })
  capacityText.value = String(c?.mode === 'ONE_TO_MANY' ? c.capacity : 4)
  formOpen.value = true
}
async function submitCg() {
  saving.value = true
  const r = await callApi(saveCaregiver({ ...form, capacity: Number(capacityText.value) }), '已保存')
  saving.value = false
  if (r) {
    formOpen.value = false
    await caregivers.reload()
  }
}
async function onDuty(c: CaregiverRow, v: string) {
  if (await callApi(setCaregiverDuty(c.id, v as CaregiverDuty), '在岗状态已更新')) await caregivers.reload()
}
function toggleCampus(id: string, on: boolean) {
  form.campusIds = on ? [...new Set([...form.campusIds, id])] : form.campusIds.filter((x) => x !== id)
}
function toggleShift(s: string, on: boolean) {
  form.shifts = on ? [...new Set([...form.shifts, s])] : form.shifts.filter((x) => x !== s)
}
const typeOptions = (Object.keys(PACKAGE_TYPE_LABEL) as PackageType[]).map((k) => ({ label: PACKAGE_TYPE_LABEL[k], value: k }))
const dutyOptions = (Object.keys(CAREGIVER_DUTY_LABEL) as CaregiverDuty[]).map((k) => ({ label: CAREGIVER_DUTY_LABEL[k], value: k }))
</script>

<template>
  <div class="page">
    <UPageHeader title="护工与调度" subtitle="首期人工调度，系统给出冲突提示。改派保留历史；取消、拒绝或付款超时释放预留。">
      <USegmented v-model="tab" :options="[{ value: 'queue', label: '派单' }, { value: 'caregivers', label: '护工', count: caregivers.data.value?.length }]" />
      <UButton v-if="tab === 'caregivers' && can('caregiver.edit')" variant="primary" icon="plus" @click="editCg()">新增护工</UButton>
    </UPageHeader>

    <template v-if="tab === 'queue'">
      <div class="toolbar">
        <USegmented
          v-model="queueFilter"
          size="sm"
          :options="[
            { value: 'needed', label: '待派单', count: (queue.data.value ?? []).filter((r) => r.needsDispatch).length },
            { value: 'all', label: '进行中全部', count: queue.data.value?.length },
          ]"
        />
      </div>
      <UCard padding="none">
        <UTable
          :columns="queueCols"
          :rows="rows"
          :loading="queue.loading.value"
          :error="queue.error.value"
          clickable
          empty-icon="caregiver"
          :empty-title="queueFilter === 'needed' ? '所有已确认订单都已安排人员' : '没有进行中的订单'"
          @row-click="(r) => (assigning = r)"
          @retry="queue.reload"
        >
          <template #cell-order="{ row }">
            <div class="stack gap-4">
              <span class="mono strong">{{ row.orderNo }}</span>
              <span class="t-foot c-3">{{ row.patientName }} · {{ row.packageName }}</span>
            </div>
          </template>
          <template #cell-place="{ row }">
            <div class="stack gap-4 m-right"><span>{{ row.campusName }}</span><span class="t-foot c-3">{{ row.departmentName }}</span></div>
          </template>
          <template #cell-type="{ row }"><UBadge>{{ PACKAGE_TYPE_LABEL[row.packageType] }}</UBadge></template>
          <template #cell-range="{ row }"><span class="num nowrap">{{ formatShort(row.startAt) }} – {{ formatShort(row.endAt) }}</span></template>
          <template #cell-status="{ row }"><BizBadge :status="row.businessStatus" /></template>
          <template #cell-cg="{ row }">
            <span v-if="row.caregiverName" class="cg">{{ row.caregiverName }}<span class="act">改派</span></span>
            <UBadge v-else tone="warning" dot>待派单</UBadge>
          </template>
        </UTable>
      </UCard>
    </template>

    <template v-else>
      <UCard padding="none">
        <UTable :columns="cgCols" :rows="caregivers.data.value ?? []" :loading="caregivers.loading.value" :error="caregivers.error.value" empty-icon="caregiver" empty-title="还没有护工" @retry="caregivers.reload">
          <template #cell-name="{ row }">
            <div class="stack gap-4">
              <span class="strong">{{ row.name }}</span>
              <span class="t-foot c-3 num">{{ row.gender }} · {{ row.phoneMasked }} · {{ row.shifts.join('、') }}</span>
            </div>
          </template>
          <template #cell-mode="{ row }"><UBadge>{{ row.mode === 'ONE_TO_MANY' ? `班组 · ${row.capacity} 人` : '一对一' }}</UBadge></template>
          <template #cell-campus="{ row }"><span class="t-foot c-2">{{ row.campusNames.join('、') }}</span></template>
          <template #cell-load="{ row }">
            <div class="stack gap-4 load">
              <span class="num">{{ row.activeCount }}</span>
              <span v-if="row.upcoming[0]" class="t-caption c-3 num">下一单 {{ formatShort(row.upcoming[0].startAt) }}</span>
            </div>
          </template>
          <template #cell-duty="{ row }">
            <USelect :model-value="row.duty" size="sm" class="duty" :options="dutyOptions" :disabled="!can('caregiver.edit')" @update:model-value="(v: string) => onDuty(row, v)" />
          </template>
          <template #cell-ops="{ row }">
            <UButton v-if="can('caregiver.edit')" size="sm" variant="ghost" icon-only icon="edit" title="编辑" @click="editCg(row)" />
          </template>
        </UTable>
      </UCard>
      <p class="t-foot c-3 note">护工端首版不单独开发，由调度员在后台维护人员与到岗记录。手机号默认脱敏。</p>
    </template>

    <AssignDrawer :order="assigning" @close="closeAssign" @done="onAssigned" />

    <UModal v-model:open="formOpen" :title="form.id ? '编辑护工' : '新增护工'" :width="520">
      <div class="grid-2">
        <UField label="姓名或班组名" required><UInput v-model="form.name" :maxlength="20" /></UField>
        <UField label="手机号" :required="!form.id" :hint="form.id ? '留空表示不修改' : '仅检查格式'"><UInput v-model="form.phone" inputmode="tel" :maxlength="11" placeholder="11 位手机号" /></UField>
        <UField label="类型" required>
          <USelect v-model="form.mode" :options="typeOptions" />
        </UField>
        <UField v-if="form.mode === 'ONE_TO_MANY'" label="班组最大服务人数" required hint="2–12 人"><UInput v-model="capacityText" inputmode="numeric" /></UField>
        <UField v-else label="性别"><USelect v-model="form.gender" :options="[{ label: '女', value: '女' }, { label: '男', value: '男' }]" /></UField>
      </div>
      <UField label="可用班次">
        <div class="row gap-20 wrap">
          <UCheckbox v-for="s in ['全天', '白班', '夜班']" :key="s" :model-value="form.shifts.includes(s)" @update:model-value="(v: boolean) => toggleShift(s, v)">{{ s }}</UCheckbox>
        </div>
      </UField>
      <UField label="服务院区" required>
        <div class="stack gap-8">
          <div v-for="h in campusOpts.data.value ?? []" :key="h.hospitalId" class="stack gap-8">
            <span class="t-foot c-2">{{ h.hospitalName }}</span>
            <div class="row gap-20 wrap">
              <UCheckbox v-for="c in h.campuses" :key="c.id" :model-value="form.campusIds.includes(c.id)" @update:model-value="(v: boolean) => toggleCampus(c.id, v)">{{ c.name }}</UCheckbox>
            </div>
          </div>
        </div>
      </UField>
      <UField label="备注" optional><UInput v-model="form.note" :maxlength="60" /></UField>
      <template #footer>
        <UButton @click="formOpen = false">取消</UButton>
        <UButton variant="primary" :loading="saving" :disabled="!form.name.trim() || !form.campusIds.length" @click="submitCg">保存</UButton>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.strong { font-weight: 500; }
.cg { display: inline-flex; gap: 10px; align-items: center; }
.act { font-size: 13px; color: var(--accent); }
.load { align-items: flex-end; }
.duty { width: 96px; }
.note { padding: 0 4px; margin-top: -16px; }
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 767px) {
  .grid-2 { grid-template-columns: 1fr; }
  .m-right { align-items: flex-end; }
}
</style>
