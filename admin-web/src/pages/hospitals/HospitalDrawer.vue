<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { callApi } from '@/composables/api'
import { confirmDialog } from '@/composables/confirm'
import { can } from '@/composables/session'
import { getHospital, moveCampus, saveCampus, toggleCampus, toggleHospital, type CampusRow, type HospitalRow } from '@/services/catalog'
import { formatDateTime } from '@/domain/time'
import { UBadge, UButton, UDrawer, UEmpty, UField, UInput, UModal, USkeleton, USwitch, Icon } from '@/components/ui'

const props = defineProps<{ hospitalId: string | null }>()
const emit = defineEmits<{ close: []; changed: []; edit: [h: HospitalRow] }>()
const router = useRouter()

const open = computed({ get: () => !!props.hospitalId, set: (v: boolean) => { if (!v) emit('close') } })
const hospital = ref<HospitalRow | null>(null)
const campuses = ref<CampusRow[]>([])
const loading = ref(false)
const err = ref<string | null>(null)
const canEdit = computed(() => can('catalog.edit'))

async function load() {
  if (!props.hospitalId) return
  loading.value = true
  err.value = null
  const r = await getHospital(props.hospitalId)
  loading.value = false
  if (r.ok) {
    hospital.value = r.data.hospital
    campuses.value = r.data.campuses
  } else err.value = r.error.message
}
watch(() => props.hospitalId, (id) => {
  hospital.value = null
  if (id) void load()
}, { immediate: true })
defineExpose({ reload: load })

async function onToggleHospital(v: boolean) {
  if (!hospital.value) return
  let reason = ''
  if (!v) {
    const c = await confirmDialog({
      title: `暂停营业：${hospital.value.name}`,
      message: `暂停后用户不能新下单，已有 ${hospital.value.openOrderCount} 个进行中订单不受影响，历史订单仍显示原信息。`,
      confirmText: '暂停营业',
      destructive: true,
      reason: { label: '停业原因', required: true, options: ['院方暂停外部陪护', '人员不足', '信息待核实'] },
    })
    if (!c.ok) return
    reason = c.reason
  }
  const r = await callApi(toggleHospital(hospital.value.id, v, reason), v ? '已恢复营业' : '已暂停营业')
  if (r) {
    await load()
    emit('changed')
  }
}

async function onToggleCampus(c: CampusRow, v: boolean) {
  if (!v) {
    const ok = await confirmDialog({ title: `停用 ${c.name}`, message: '停用后该院区不能新预约，已有订单不受影响。', confirmText: '停用', destructive: true })
    if (!ok.ok) return
  }
  if (await callApi(toggleCampus(c.id, v), v ? '院区已启用' : '院区已停用')) {
    await load()
    emit('changed')
  }
}

async function onMove(c: CampusRow, dir: -1 | 1) {
  if (await callApi(moveCampus(c.id, dir))) await load()
}

// 院区表单
const campusOpen = ref(false)
const campusForm = reactive({ id: '' as string | undefined, name: '', address: '', phone: '' })
const campusSaving = ref(false)
function editCampus(c?: CampusRow) {
  Object.assign(campusForm, c ? { id: c.id, name: c.name, address: c.address, phone: c.phone } : { id: undefined, name: '', address: '', phone: '' })
  campusOpen.value = true
}
async function submitCampus() {
  if (!hospital.value) return
  campusSaving.value = true
  const r = await callApi(saveCampus({ ...campusForm, hospitalId: hospital.value.id }), campusForm.id ? '院区已保存' : '院区已添加')
  campusSaving.value = false
  if (r) {
    campusOpen.value = false
    await load()
    emit('changed')
  }
}
</script>

<template>
  <UDrawer v-model:open="open" :title="hospital?.name ?? '医院'" :width="600">
    <template #meta>
      <div v-if="hospital" class="row gap-8 wrap">
        <UBadge :tone="hospital.enabled ? 'success' : 'muted'" dot>{{ hospital.enabled ? '营业中' : '未营业' }}</UBadge>
        <UBadge>{{ hospital.gradeName }}</UBadge>
        <UBadge tone="muted">演示</UBadge>
      </div>
    </template>

    <div v-if="loading && !hospital" class="stack gap-16"><USkeleton height="180px" radius="16px" /><USkeleton height="160px" radius="16px" /></div>
    <UEmpty v-else-if="err" tone="danger" icon="alert" title="加载失败" :description="err"><UButton size="sm" @click="load">重试</UButton></UEmpty>

    <template v-else-if="hospital">
      <section class="stack">
        <p class="section-label">基本信息</p>
        <dl class="kv sheet">
          <dt>城市 / 区县</dt>
          <dd>{{ hospital.cityName }}<template v-if="hospital.districtName"> · {{ hospital.districtName }}</template></dd>
          <dt>展示地址</dt>
          <dd>{{ hospital.displayAddress }}</dd>
          <dt>联系电话</dt>
          <dd class="num">{{ hospital.phone || '—' }}</dd>
          <dt>营业状态</dt>
          <dd class="row between">
            <span>{{ hospital.enabled ? '营业中，可新预约' : '暂停营业，不可新预约' }}</span>
            <USwitch :model-value="hospital.enabled" :disabled="!canEdit" label="营业状态" @change="onToggleHospital" />
          </dd>
          <dt>进行中订单</dt>
          <dd class="num">{{ hospital.openOrderCount }}</dd>
          <dt>更新时间</dt>
          <dd class="num">{{ formatDateTime(hospital.updatedAt) }}</dd>
        </dl>
      </section>

      <section class="stack">
        <div class="row between">
          <p class="section-label">院区 · {{ campuses.length }}</p>
          <button v-if="canEdit" type="button" class="link" @click="editCampus()">添加院区</button>
        </div>
        <div class="sheet">
          <UEmpty v-if="!campuses.length" icon="hospital" title="还没有院区" description="至少添加并启用一个院区后才能开放营业" compact>
            <UButton v-if="canEdit" size="sm" icon="plus" @click="editCampus()">添加院区</UButton>
          </UEmpty>
          <div v-for="(c, i) in campuses" :key="c.id" class="campus">
            <div class="stack gap-4 grow">
              <div class="row gap-8">
                <span class="c-name">{{ c.name }}</span>
                <UBadge v-if="!c.enabled" tone="muted">已停用</UBadge>
              </div>
              <span class="t-foot c-2">{{ c.address }}</span>
              <span class="t-caption c-3">{{ c.departmentCount }} 个科室 · {{ c.wardCount }} 个病区<template v-if="c.phone"> · {{ c.phone }}</template></span>
            </div>
            <div class="row gap-4 tools">
              <UButton size="sm" variant="ghost" icon-only icon="layers" title="管理科室" @click="router.push({ path: '/departments', query: { campus: c.id } })" />
              <template v-if="canEdit">
                <UButton size="sm" variant="ghost" icon-only icon="arrowUp" title="上移" :disabled="i === 0" @click="onMove(c, -1)" />
                <UButton size="sm" variant="ghost" icon-only icon="arrowDown" title="下移" :disabled="i === campuses.length - 1" @click="onMove(c, 1)" />
                <UButton size="sm" variant="ghost" icon-only icon="edit" title="编辑" @click="editCampus(c)" />
              </template>
              <USwitch :model-value="c.enabled" :disabled="!canEdit" :label="`${c.name} 启用`" @change="(v) => onToggleCampus(c, v)" />
            </div>
          </div>
        </div>
        <p class="t-foot c-3 hint"><Icon name="info" :size="14" />院区有订单引用时只能停用，不能删除；院区不能跨医院移动。</p>
      </section>
    </template>

    <template #footer>
      <UButton v-if="hospital && canEdit" icon="edit" @click="emit('edit', hospital)">编辑医院</UButton>
    </template>
  </UDrawer>

  <UModal v-model:open="campusOpen" :title="campusForm.id ? '编辑院区' : '添加院区'" :width="460">
    <UField label="院区名称" required><UInput v-model="campusForm.name" placeholder="例如：东山院区" :maxlength="30" /></UField>
    <UField label="到岗地址" required hint="护工到岗以此地址为准"><UInput v-model="campusForm.address" :maxlength="80" /></UField>
    <UField label="院区电话" optional><UInput v-model="campusForm.phone" inputmode="tel" /></UField>
    <template #footer>
      <UButton @click="campusOpen = false">取消</UButton>
      <UButton variant="primary" :loading="campusSaving" :disabled="!campusForm.name.trim() || !campusForm.address.trim()" @click="submitCampus">保存</UButton>
    </template>
  </UModal>
</template>

<style scoped>
.sheet { background: var(--surface); border-radius: 16px; padding: 0 16px; margin: 0; }
.link { border: 0; background: transparent; color: var(--accent); font-size: 13px; padding: 0 4px 8px; }
.campus { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--separator); }
.campus:last-child { border-bottom: 0; }
.c-name { font-size: 15px; font-weight: 600; }
.tools { flex: none; }
.hint { display: flex; align-items: center; gap: 6px; padding: 8px 4px 0; }
@media (max-width: 767px) {
  .campus { flex-direction: column; align-items: stretch; }
  .tools { justify-content: flex-end; }
}
</style>
