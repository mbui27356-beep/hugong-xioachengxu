<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { callApi, useResource } from '@/composables/api'
import { confirmDialog } from '@/composables/confirm'
import { can } from '@/composables/session'
import {
  deleteGrade, listGrades, listHospitals, listRegions, moveGrade, saveGrade, toggleGrade, type GradeRow, type HospitalFilter, type HospitalRow,
} from '@/services/catalog'
import { UBadge, UButton, UCard, UField, UInput, UModal, UPageHeader, USegmented, USelect, USwitch, UTable, type Column } from '@/components/ui'
import HospitalForm from './hospitals/HospitalForm.vue'
import HospitalDrawer from './hospitals/HospitalDrawer.vue'

const tab = ref('hospitals')
const canEdit = computed(() => can('catalog.edit'))

// ---------- 医院 ----------
const filter = reactive<HospitalFilter>({ keyword: '', cityId: '', gradeId: '', enabled: '' })
const hospitals = useResource(() => listHospitals({ ...filter }))
watch(() => ({ ...filter }), () => void hospitals.reload())
const regions = useResource(listRegions)
const grades = useResource(listGrades)

const formOpen = ref(false)
const editing = ref<HospitalRow | null>(null)
const detailId = ref<string | null>(null)
const drawer = ref<InstanceType<typeof HospitalDrawer> | null>(null)

function create() {
  editing.value = null
  formOpen.value = true
}
function edit(h: HospitalRow) {
  editing.value = h
  formOpen.value = true
}
async function onSaved(id: string) {
  formOpen.value = false
  await hospitals.reload()
  if (detailId.value === id) await drawer.value?.reload()
  else detailId.value = id
}

const hospitalCols: Column[] = [
  { key: 'name', label: '医院', primary: true },
  { key: 'grade', label: '等级' },
  { key: 'city', label: '城市 / 区县' },
  { key: 'campus', label: '院区 / 科室', align: 'right' },
  { key: 'orders', label: '进行中订单', align: 'right', hideOnMobile: true },
  { key: 'status', label: '营业状态', align: 'right' },
]

// ---------- 等级字典 ----------
const gradeOpen = ref(false)
const gradeForm = reactive({ id: undefined as string | undefined, name: '', shortName: '' })
const gradeSaving = ref(false)
function editGrade(g?: GradeRow) {
  Object.assign(gradeForm, g ? { id: g.id, name: g.name, shortName: g.shortName } : { id: undefined, name: '', shortName: '' })
  gradeOpen.value = true
}
async function submitGrade() {
  gradeSaving.value = true
  const r = await callApi(saveGrade({ ...gradeForm }), '等级已保存')
  gradeSaving.value = false
  if (r) {
    gradeOpen.value = false
    await grades.reload()
  }
}
async function onToggleGrade(g: GradeRow, v: boolean) {
  if (await callApi(toggleGrade(g.id, v))) await grades.reload()
}
async function onMoveGrade(g: GradeRow, dir: -1 | 1) {
  if (await callApi(moveGrade(g.id, dir))) await grades.reload()
}
async function onDeleteGrade(g: GradeRow) {
  const c = await confirmDialog({ title: `删除等级「${g.name}」`, message: '仅未被医院使用的等级可以删除。', confirmText: '删除', destructive: true })
  if (!c.ok) return
  if (await callApi(deleteGrade(g.id), '等级已删除')) await grades.reload()
}
const gradeCols: Column[] = [
  { key: 'name', label: '等级名称', primary: true },
  { key: 'short', label: '简称' },
  { key: 'count', label: '使用医院', align: 'right' },
  { key: 'enabled', label: '启用', align: 'right' },
  { key: 'ops', label: '', align: 'right' },
]
</script>

<template>
  <div class="page">
    <UPageHeader title="医院管理" subtitle="医院、院区与等级字典全部由后台维护，小程序不写死。关闭的医院或院区不能新下单。">
      <USegmented v-model="tab" :options="[{ value: 'hospitals', label: '医院与院区' }, { value: 'grades', label: '等级字典' }]" />
      <UButton v-if="canEdit && tab === 'hospitals'" variant="primary" icon="plus" @click="create">新增医院</UButton>
      <UButton v-if="canEdit && tab === 'grades'" variant="primary" icon="plus" @click="editGrade()">新增等级</UButton>
    </UPageHeader>

    <template v-if="tab === 'hospitals'">
      <div class="toolbar">
        <UInput v-model="filter.keyword" class="grow" icon="search" placeholder="搜索医院名称或地址" clearable />
        <USelect v-model="filter.cityId" class="sel" placeholder="全部城市" :options="(regions.data.value ?? []).map((c) => ({ label: c.name, value: c.id }))" />
        <USelect v-model="filter.gradeId" class="sel" placeholder="全部等级" :options="(grades.data.value ?? []).map((g) => ({ label: g.name, value: g.id }))" />
        <USelect v-model="filter.enabled" class="sel" placeholder="全部状态" :options="[{ label: '营业中', value: 'on' }, { label: '未营业', value: 'off' }]" />
      </div>
      <UCard padding="none">
        <UTable
          :columns="hospitalCols"
          :rows="hospitals.data.value ?? []"
          :loading="hospitals.loading.value"
          :error="hospitals.error.value"
          clickable
          :selected-id="detailId"
          empty-icon="hospital"
          empty-title="没有符合条件的医院"
          empty-description="新增医院后，在详情中添加院区并开放营业"
          @row-click="(r) => (detailId = r.id)"
          @retry="hospitals.reload"
        >
          <template #cell-name="{ row }">
            <div class="stack gap-4">
              <span class="strong">{{ row.name }}</span>
              <span class="t-foot c-3 ellipsis addr">{{ row.displayAddress }}</span>
            </div>
          </template>
          <template #cell-grade="{ row }"><UBadge>{{ row.gradeShort }}</UBadge></template>
          <template #cell-city="{ row }">{{ row.cityName }}<span v-if="row.districtName" class="c-3"> · {{ row.districtName }}</span></template>
          <template #cell-campus="{ row }"><span class="num">{{ row.campusCount }} / {{ row.departmentCount }}</span></template>
          <template #cell-orders="{ row }"><span class="num">{{ row.openOrderCount }}</span></template>
          <template #cell-status="{ row }">
            <UBadge :tone="row.enabled ? 'success' : 'muted'" dot>{{ row.enabled ? '营业中' : '未营业' }}</UBadge>
          </template>
          <template #empty-action>
            <UButton v-if="canEdit" size="sm" icon="plus" @click="create">新增医院</UButton>
          </template>
        </UTable>
      </UCard>
    </template>

    <template v-else>
      <UCard padding="none" title="医院等级" subtitle="独立字典，关联到医院；用于小程序按等级筛选">
        <UTable :columns="gradeCols" :rows="grades.data.value ?? []" :loading="grades.loading.value" :error="grades.error.value" @retry="grades.reload">
          <template #cell-name="{ row }"><span class="strong">{{ row.name }}</span></template>
          <template #cell-short="{ row }"><UBadge>{{ row.shortName }}</UBadge></template>
          <template #cell-count="{ row }"><span class="num">{{ row.hospitalCount }}</span></template>
          <template #cell-enabled="{ row }">
            <USwitch :model-value="row.enabled" :disabled="!canEdit" :label="`${row.name} 启用`" @change="(v) => onToggleGrade(row, v)" />
          </template>
          <template #cell-ops="{ row }">
            <div v-if="canEdit" class="row gap-4 end">
              <UButton size="sm" variant="ghost" icon-only icon="arrowUp" title="上移" :disabled="row.sort === 1" @click="onMoveGrade(row, -1)" />
              <UButton size="sm" variant="ghost" icon-only icon="arrowDown" title="下移" @click="onMoveGrade(row, 1)" />
              <UButton size="sm" variant="ghost" icon-only icon="edit" title="编辑" @click="editGrade(row)" />
              <UButton size="sm" variant="ghost" icon-only icon="trash" title="删除" :disabled="row.hospitalCount > 0" @click="onDeleteGrade(row)" />
            </div>
          </template>
        </UTable>
      </UCard>
    </template>

    <HospitalForm :open="formOpen" :hospital="editing" :cities="regions.data.value ?? []" :grades="grades.data.value ?? []" @close="formOpen = false" @saved="onSaved" />
    <HospitalDrawer ref="drawer" :hospital-id="detailId" @close="detailId = null" @changed="hospitals.reload" @edit="edit" />

    <UModal v-model:open="gradeOpen" :title="gradeForm.id ? '编辑等级' : '新增等级'" :width="420">
      <UField label="等级名称" required><UInput v-model="gradeForm.name" placeholder="例如：三级甲等" :maxlength="20" /></UField>
      <UField label="简称" required hint="用于医院卡片标签"><UInput v-model="gradeForm.shortName" placeholder="例如：三甲" :maxlength="6" /></UField>
      <template #footer>
        <UButton @click="gradeOpen = false">取消</UButton>
        <UButton variant="primary" :loading="gradeSaving" :disabled="!gradeForm.name.trim() || !gradeForm.shortName.trim()" @click="submitGrade">保存</UButton>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.sel { width: 150px; }
.strong { font-weight: 500; }
.addr { display: inline-block; max-width: 320px; }
@media (max-width: 767px) {
  .sel { width: calc(33.33% - 6px); min-width: 0; }
  .addr { max-width: 220px; }
}
</style>
