<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { callApi, useResource } from '@/composables/api'
import { can } from '@/composables/session'
import {
  getDepartmentTree, listCampusOptions, reorderDepartments, saveDepartment, saveWard, toggleDepartment, toggleWard, type DepartmentNode,
} from '@/services/catalog'
import { UBadge, UButton, UCard, UEmpty, UField, UInput, UModal, UPageHeader, USelect, USkeleton, USwitch } from '@/components/ui'

const route = useRoute()
const canEdit = computed(() => can('catalog.edit'))
const options = useResource(listCampusOptions)
const hospitalId = ref('')
const campusId = ref((route.query.campus as string) || '')

watch(() => options.data.value, (opts) => {
  if (!opts?.length) return
  const fromCampus = opts.find((h) => h.campuses.some((c) => c.id === campusId.value))
  hospitalId.value = fromCampus?.hospitalId ?? opts[0].hospitalId
  if (!fromCampus) campusId.value = opts[0].campuses[0]?.id ?? ''
})
const campuses = computed(() => options.data.value?.find((h) => h.hospitalId === hospitalId.value)?.campuses ?? [])
// 上级变化时清空不兼容的下级选择
watch(hospitalId, () => {
  if (!campuses.value.some((c) => c.id === campusId.value)) campusId.value = campuses.value[0]?.id ?? ''
})

const tree = ref<DepartmentNode[]>([])
const sorting = ref(false)
const loading = ref(false)
const err = ref<string | null>(null)
async function load() {
  if (!campusId.value) {
    tree.value = []
    return
  }
  loading.value = true
  err.value = null
  const r = await getDepartmentTree(campusId.value)
  loading.value = false
  if (r.ok) tree.value = r.data
  else err.value = r.error.message
}
watch(campusId, () => {
  sorting.value = false
  void load()
}, { immediate: true })

// 批量排序
const draftOrder = ref<DepartmentNode[]>([])
function startSort() {
  draftOrder.value = [...tree.value]
  sorting.value = true
}
function shift(i: number, dir: -1 | 1) {
  const list = [...draftOrder.value]
  const j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  draftOrder.value = list
}
const savingSort = ref(false)
async function saveSort() {
  savingSort.value = true
  const r = await callApi(reorderDepartments(campusId.value, draftOrder.value.map((d) => d.id)), '排序已保存')
  savingSort.value = false
  if (r) {
    sorting.value = false
    await load()
  }
}
const shown = computed(() => (sorting.value ? draftOrder.value : tree.value))

// 表单
const formOpen = ref(false)
const form = reactive({ kind: 'dept' as 'dept' | 'ward', id: undefined as string | undefined, departmentId: '', name: '' })
const saving = ref(false)
function openDept(d?: DepartmentNode) {
  Object.assign(form, { kind: 'dept', id: d?.id, departmentId: '', name: d?.name ?? '' })
  formOpen.value = true
}
function openWard(deptId: string, w?: { id: string; name: string }) {
  Object.assign(form, { kind: 'ward', id: w?.id, departmentId: deptId, name: w?.name ?? '' })
  formOpen.value = true
}
async function submit() {
  saving.value = true
  const r = form.kind === 'dept'
    ? await callApi(saveDepartment({ id: form.id, campusId: campusId.value, name: form.name }), '科室已保存')
    : await callApi(saveWard({ id: form.id, campusId: campusId.value, departmentId: form.departmentId, name: form.name }), '病区已保存')
  saving.value = false
  if (r) {
    formOpen.value = false
    await load()
  }
}
async function run(p: Promise<unknown>) {
  await p
  await load()
}
const campusName = computed(() => campuses.value.find((c) => c.id === campusId.value)?.name ?? '')
</script>

<template>
  <div class="page">
    <UPageHeader title="科室管理" subtitle="科室与病区归属于院区，后台校验父级链，防止跨院区错误关联。没有病区的科室不强制用户选择。">
      <template v-if="canEdit && campusId">
        <template v-if="sorting">
          <UButton @click="sorting = false">取消</UButton>
          <UButton variant="primary" :loading="savingSort" @click="saveSort">保存排序</UButton>
        </template>
        <template v-else>
          <UButton icon="swap" :disabled="tree.length < 2" @click="startSort">批量排序</UButton>
          <UButton variant="primary" icon="plus" @click="openDept()">新增科室</UButton>
        </template>
      </template>
    </UPageHeader>

    <div class="toolbar">
      <USelect v-model="hospitalId" class="sel-h" :options="(options.data.value ?? []).map((h) => ({ label: h.hospitalName, value: h.hospitalId }))" aria-label="医院" />
      <USelect v-model="campusId" class="sel-c" :options="campuses.map((c) => ({ label: c.enabled ? c.name : `${c.name}（已停用）`, value: c.id }))" placeholder="选择院区" aria-label="院区" />
      <span class="t-foot c-3">{{ tree.length }} 个科室 · {{ tree.reduce((s, d) => s + d.wards.length, 0) }} 个病区</span>
    </div>

    <div v-if="loading && !tree.length" class="stack gap-12"><USkeleton height="64px" radius="16px" /><USkeleton height="64px" radius="16px" /><USkeleton height="64px" radius="16px" /></div>
    <UCard v-else-if="err" padding="none"><UEmpty tone="danger" icon="alert" title="加载失败" :description="err"><UButton size="sm" @click="load">重试</UButton></UEmpty></UCard>
    <UCard v-else-if="!campusId" padding="none"><UEmpty icon="hospital" title="该医院还没有院区" description="请先在医院管理中添加院区" /></UCard>
    <UCard v-else-if="!tree.length" padding="none">
      <UEmpty icon="layers" :title="`${campusName}还没有科室`" description="添加科室后，可按需在科室下添加病区或护理单元">
        <UButton v-if="canEdit" size="sm" icon="plus" @click="openDept()">新增科室</UButton>
      </UEmpty>
    </UCard>

    <UCard v-else padding="none">
      <div class="depts" :class="{ sorting }">
        <div v-for="(d, i) in shown" :key="d.id" class="dept">
          <div class="dept-row">
            <span class="idx num">{{ i + 1 }}</span>
            <div class="grow stack gap-4">
              <div class="row gap-8">
                <span class="d-name">{{ d.name }}</span>
                <UBadge v-if="!d.enabled" tone="muted">已停用</UBadge>
              </div>
              <span class="t-caption c-3">{{ d.wards.length ? `${d.wards.length} 个病区` : '无病区，用户直接选择科室' }}</span>
            </div>
            <div v-if="sorting" class="row gap-4">
              <UButton size="sm" variant="secondary" icon-only icon="arrowUp" title="上移" :disabled="i === 0" @click="shift(i, -1)" />
              <UButton size="sm" variant="secondary" icon-only icon="arrowDown" title="下移" :disabled="i === shown.length - 1" @click="shift(i, 1)" />
            </div>
            <div v-else class="row gap-4">
              <template v-if="canEdit">
                <UButton size="sm" variant="plain" @click="openWard(d.id)">添加病区</UButton>
                <UButton size="sm" variant="ghost" icon-only icon="edit" title="编辑" @click="openDept(d)" />
              </template>
              <USwitch :model-value="d.enabled" :disabled="!canEdit" :label="`${d.name} 启用`" @change="(v) => run(callApi(toggleDepartment(d.id, v)))" />
            </div>
          </div>
          <div v-if="d.wards.length && !sorting" class="wards">
            <div v-for="w in d.wards" :key="w.id" class="ward">
              <span class="grow">{{ w.name }} <UBadge v-if="!w.enabled" tone="muted">已停用</UBadge></span>
              <UButton v-if="canEdit" size="sm" variant="ghost" icon-only icon="edit" title="编辑病区" @click="openWard(d.id, w)" />
              <USwitch :model-value="w.enabled" :disabled="!canEdit" :label="`${w.name} 启用`" @change="(v) => run(callApi(toggleWard(w.id, v)))" />
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <UModal v-model:open="formOpen" :title="`${form.id ? '编辑' : '新增'}${form.kind === 'dept' ? '科室' : '病区'}`" :description="`所属院区：${campusName}`" :width="420">
      <UField :label="form.kind === 'dept' ? '科室名称' : '病区或护理单元名称'" required>
        <UInput v-model="form.name" :maxlength="30" :placeholder="form.kind === 'dept' ? '例如：心血管内科' : '例如：一病区'" />
      </UField>
      <template #footer>
        <UButton @click="formOpen = false">取消</UButton>
        <UButton variant="primary" :loading="saving" :disabled="!form.name.trim()" @click="submit">保存</UButton>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.sel-h { width: 260px; }
.sel-c { width: 200px; }
.depts { padding: 4px 24px; }
.dept { border-bottom: 1px solid var(--separator); }
.dept:last-child { border-bottom: 0; }
.dept-row { display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 10px 0; }
.idx { width: 24px; color: var(--label-4); font-size: 13px; text-align: center; flex: none; }
.d-name { font-size: 15px; font-weight: 600; }
.wards { margin: 0 0 12px 36px; background: var(--fill-2); border-radius: 12px; padding: 0 12px; }
.ward { display: flex; align-items: center; gap: 8px; min-height: 48px; border-bottom: 1px solid var(--separator); font-size: 15px; }
.ward:last-child { border-bottom: 0; }
.sorting .dept-row { transition: background-color 200ms var(--ease); }
@media (max-width: 767px) {
  .sel-h, .sel-c { width: 100%; }
  .depts { padding: 4px 16px; }
  .wards { margin-left: 0; }
  .dept-row { flex-wrap: wrap; }
}
</style>
