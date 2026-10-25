<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { callApi, useResource } from '@/composables/api'
import { confirmDialog } from '@/composables/confirm'
import { can } from '@/composables/session'
import {
  deleteCity, deleteDistrict, listRegions, moveCity, moveDistrict, saveCity, saveDistrict, toggleCity, toggleDistrict, type CityRow,
} from '@/services/catalog'
import { UBadge, UButton, UCard, UEmpty, UField, UInput, UModal, UPageHeader, USkeleton, USwitch } from '@/components/ui'

const { data, loading, error, reload } = useResource(listRegions)
const canEdit = computed(() => can('catalog.edit'))

const formOpen = ref(false)
const form = reactive({ kind: 'city' as 'city' | 'district', id: undefined as string | undefined, cityId: '', name: '', code: '' })
const saving = ref(false)

function openCity(c?: CityRow) {
  Object.assign(form, { kind: 'city', id: c?.id, cityId: '', name: c?.name ?? '', code: c?.code ?? '' })
  formOpen.value = true
}
function openDistrict(cityId: string, d?: { id: string; name: string; code: string }) {
  Object.assign(form, { kind: 'district', id: d?.id, cityId, name: d?.name ?? '', code: d?.code ?? '' })
  formOpen.value = true
}
async function submit() {
  saving.value = true
  const r = form.kind === 'city'
    ? await callApi(saveCity({ id: form.id, name: form.name, code: form.code }), '城市已保存')
    : await callApi(saveDistrict({ id: form.id, cityId: form.cityId, name: form.name, code: form.code }), '区县已保存')
  saving.value = false
  if (r) {
    formOpen.value = false
    await reload()
  }
}

async function run(p: Promise<unknown>) {
  await p
  await reload()
}
async function onToggleCity(c: CityRow, v: boolean) {
  if (!v) {
    const ok = await confirmDialog({ title: `停用 ${c.name}`, message: `停用后该城市下 ${c.hospitalCount} 家医院不再出现在小程序筛选中，历史订单不受影响。`, confirmText: '停用', destructive: true })
    if (!ok.ok) return
  }
  await run(callApi(toggleCity(c.id, v), v ? '已启用' : '已停用'))
}
async function onDeleteCity(c: CityRow) {
  const ok = await confirmDialog({ title: `删除 ${c.name}`, message: '有区县或医院引用时不能删除，请改为停用。', confirmText: '删除', destructive: true })
  if (ok.ok) await run(callApi(deleteCity(c.id), '已删除'))
}
async function onDeleteDistrict(id: string, name: string) {
  const ok = await confirmDialog({ title: `删除 ${name}`, message: '有医院引用时不能删除，请改为停用。', confirmText: '删除', destructive: true })
  if (ok.ok) await run(callApi(deleteDistrict(id), '已删除'))
}
</script>

<template>
  <div class="page">
    <UPageHeader title="服务地区" subtitle="城市 → 区县两级。区县属于城市，不与城市并列；有下级引用时只能停用，不能硬删除。">
      <UButton v-if="canEdit" variant="primary" icon="plus" @click="openCity()">新增城市</UButton>
    </UPageHeader>

    <div v-if="loading && !data" class="stack gap-16">
      <USkeleton height="220px" radius="20px" />
      <USkeleton height="120px" radius="20px" />
    </div>
    <UCard v-else-if="error" padding="none">
      <UEmpty tone="danger" icon="alert" title="加载失败" :description="error.message"><UButton size="sm" icon="refresh" @click="reload">重试</UButton></UEmpty>
    </UCard>
    <UCard v-else-if="data && !data.length" padding="none">
      <UEmpty icon="region" title="还没有服务地区" description="先添加城市，再在城市下添加区县">
        <UButton v-if="canEdit" size="sm" icon="plus" @click="openCity()">新增城市</UButton>
      </UEmpty>
    </UCard>

    <div v-else class="stack gap-20">
      <UCard v-for="(c, ci) in data" :key="c.id" padding="none">
        <template #header>
          <div class="row gap-8 wrap">
            <h2 class="t-headline">{{ c.name }}</h2>
            <span class="t-foot c-3 num">{{ c.code }}</span>
            <UBadge v-if="!c.enabled" tone="muted">已停用</UBadge>
          </div>
          <p class="t-foot c-2">{{ c.districts.length }} 个区县 · {{ c.hospitalCount }} 家医院</p>
        </template>
        <template #actions>
          <template v-if="canEdit">
            <UButton size="sm" variant="ghost" icon-only icon="arrowUp" title="上移" :disabled="ci === 0" @click="run(callApi(moveCity(c.id, -1)))" />
            <UButton size="sm" variant="ghost" icon-only icon="arrowDown" title="下移" :disabled="ci === data!.length - 1" @click="run(callApi(moveCity(c.id, 1)))" />
            <UButton size="sm" variant="ghost" icon-only icon="edit" title="编辑" @click="openCity(c)" />
            <UButton size="sm" variant="ghost" icon-only icon="trash" title="删除" @click="onDeleteCity(c)" />
          </template>
          <USwitch :model-value="c.enabled" :disabled="!canEdit" :label="`${c.name} 启用`" @change="(v) => onToggleCity(c, v)" />
        </template>
        <div class="list">
          <div v-for="(d, di) in c.districts" :key="d.id" class="item">
            <div class="grow stack gap-4">
              <span>{{ d.name }} <UBadge v-if="!d.enabled" tone="muted">已停用</UBadge></span>
              <span class="t-caption c-3 num">{{ d.code }} · {{ d.hospitalCount }} 家医院</span>
            </div>
            <div class="row gap-4">
              <template v-if="canEdit">
                <UButton size="sm" variant="ghost" icon-only icon="arrowUp" title="上移" :disabled="di === 0" @click="run(callApi(moveDistrict(d.id, -1)))" />
                <UButton size="sm" variant="ghost" icon-only icon="arrowDown" title="下移" :disabled="di === c.districts.length - 1" @click="run(callApi(moveDistrict(d.id, 1)))" />
                <UButton size="sm" variant="ghost" icon-only icon="edit" title="编辑" @click="openDistrict(c.id, d)" />
                <UButton size="sm" variant="ghost" icon-only icon="trash" title="删除" @click="onDeleteDistrict(d.id, d.name)" />
              </template>
              <USwitch :model-value="d.enabled" :disabled="!canEdit" :label="`${d.name} 启用`" @change="(v) => run(callApi(toggleDistrict(d.id, v)))" />
            </div>
          </div>
          <button v-if="canEdit" type="button" class="add" @click="openDistrict(c.id)">添加区县</button>
          <p v-if="!c.districts.length && !canEdit" class="empty-line">暂无区县</p>
        </div>
      </UCard>
    </div>

    <UModal v-model:open="formOpen" :title="`${form.id ? '编辑' : '新增'}${form.kind === 'city' ? '城市' : '区县'}`" :width="420">
      <UField :label="form.kind === 'city' ? '城市名称' : '区县名称'" required :hint="form.kind === 'city' ? '例如：宜昌市。区县请在城市下添加' : '例如：西陵区'">
        <UInput v-model="form.name" :maxlength="20" />
      </UField>
      <UField label="行政区划代码" required hint="6 位数字"><UInput v-model="form.code" inputmode="numeric" :maxlength="6" /></UField>
      <template #footer>
        <UButton @click="formOpen = false">取消</UButton>
        <UButton variant="primary" :loading="saving" :disabled="!form.name.trim() || !form.code.trim()" @click="submit">保存</UButton>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.list { padding: 0 24px 8px; }
.item { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 0; border-bottom: 1px solid var(--separator); }
.add { border: 0; background: transparent; color: var(--accent); font-size: 15px; padding: 14px 0; width: 100%; text-align: left; }
.add:hover { text-decoration: underline; }
.empty-line { padding: 14px 0; color: var(--label-3); font-size: 13px; }
@media (max-width: 767px) { .list { padding: 0 16px 4px; } }
</style>
