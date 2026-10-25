<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { BILLING_UNIT_LABEL, BILLING_UNIT_SHORT, PACKAGE_TYPE_LABEL, type BillingUnit, type PackageType, type PriceVersion } from '@/contracts'
import { formatFen, parseYuanToFen } from '@/domain/money'
import { formatDateTime, fromLocalInput, toLocalInput } from '@/domain/time'
import { callApi, useResource } from '@/composables/api'
import { can } from '@/composables/session'
import { listCampusOptions } from '@/services/catalog'
import { addPriceVersion, listPriceVersions, savePackage, type PackageInput, type PackageRow } from '@/services/packages'
import { UBadge, UButton, UCheckbox, UDrawer, UField, UInput, USegmented, USelect } from '@/components/ui'

const props = defineProps<{ open: boolean; pkg: PackageRow | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const openModel = computed({ get: () => props.open, set: (v: boolean) => { if (!v) emit('close') } })
const canEdit = computed(() => can('package.edit'))
const tab = ref('info')

const campusOpts = useResource(listCampusOptions)
const typeOptions = (Object.keys(PACKAGE_TYPE_LABEL) as PackageType[]).map((k) => ({ label: PACKAGE_TYPE_LABEL[k], value: k }))
const unitOptions = (Object.keys(BILLING_UNIT_LABEL) as BillingUnit[]).map((k) => ({ label: BILLING_UNIT_LABEL[k], value: k }))
const form = reactive<PackageInput>({
  name: '', type: 'ONE_TO_ONE', unit: 'DAY_24H', content: '', exclusions: '', conditions: '', limits: '', consultPhone: '', campusIds: [], initialPrice: '',
})
const saving = ref(false)
const touched = ref(false)
const versions = ref<PriceVersion[]>([])
const vLoading = ref(false)

async function loadVersions() {
  if (!props.pkg) return
  vLoading.value = true
  const r = await listPriceVersions(props.pkg.id)
  vLoading.value = false
  if (r.ok) versions.value = r.data
}

watch(() => [props.open, props.pkg?.id], () => {
  if (!props.open) return
  touched.value = false
  tab.value = 'info'
  const p = props.pkg
  Object.assign(form, p
    ? { id: p.id, name: p.name, type: p.type, unit: p.unit, content: p.content, exclusions: p.exclusions, conditions: p.conditions, limits: p.limits, consultPhone: p.consultPhone, campusIds: [...p.campusIds], initialPrice: '' }
    : { id: undefined, name: '', type: 'ONE_TO_ONE', unit: 'DAY_24H', content: '', exclusions: '', conditions: '', limits: '', consultPhone: '', campusIds: [], initialPrice: '' })
  versions.value = []
  if (p) void loadVersions()
}, { immediate: true })

function toggleCampus(id: string, on: boolean) {
  form.campusIds = on ? [...new Set([...form.campusIds, id])] : form.campusIds.filter((x) => x !== id)
}
const errors = computed(() => ({
  name: !form.name.trim() ? '请填写套餐名称' : null,
  content: !form.content.trim() ? '请填写服务内容' : null,
  exclusions: !form.exclusions.trim() ? '请写明不包含的项目' : null,
  campusIds: !form.campusIds.length ? '至少选择一个适用院区' : null,
  initialPrice: !props.pkg && (parseYuanToFen(form.initialPrice ?? '') ?? 0) <= 0 ? '请输入正确的单价' : null,
}))

async function submit() {
  touched.value = true
  if (Object.values(errors.value).some(Boolean)) return
  saving.value = true
  const r = await callApi(savePackage({ ...form }), props.pkg ? '套餐已保存' : '套餐已创建，默认下架')
  saving.value = false
  if (r) emit('saved')
}

// 新价格版本
const pv = reactive({ price: '', from: '', note: '' })
const pvSaving = ref(false)
watch(tab, (t) => {
  if (t === 'price') Object.assign(pv, { price: '', from: toLocalInput(Date.now() + 5 * 60_000), note: '' })
})
const pvPreview = computed(() => parseYuanToFen(pv.price))
async function addVersion() {
  if (!props.pkg) return
  pvSaving.value = true
  const r = await callApi(addPriceVersion(props.pkg.id, { price: pv.price, effectiveFrom: fromLocalInput(pv.from), note: pv.note }), '已新增价格版本，历史订单不受影响')
  pvSaving.value = false
  if (r) {
    Object.assign(pv, { price: '', note: '' })
    await loadVersions()
    emit('saved')
  }
}
const now = Date.now()
function vState(v: PriceVersion) {
  if (v.effectiveFrom > now) return { label: '待生效', tone: 'accent' as const }
  if (v.effectiveTo == null || v.effectiveTo > now) return { label: '生效中', tone: 'success' as const }
  return { label: '已失效', tone: 'muted' as const }
}
</script>

<template>
  <UDrawer v-model:open="openModel" :title="pkg ? pkg.name : '新增套餐'" :subtitle="pkg ? `${PACKAGE_TYPE_LABEL[pkg.type]} · ${BILLING_UNIT_LABEL[pkg.unit]}` : '新套餐默认下架，配置完成后再上架'" :width="620">
    <USegmented v-if="pkg" v-model="tab" :options="[{ value: 'info', label: '套餐内容' }, { value: 'price', label: '价格版本', count: versions.length || undefined }]" />

    <template v-if="tab === 'info'">
      <section class="sheet form">
        <UField label="套餐名称" required hint="同名不同价的套餐请用时长或适用条件区分" :error="touched ? errors.name : null">
          <UInput v-model="form.name" :maxlength="40" :disabled="!canEdit" placeholder="例如：一对一陪护 · 24 小时" />
        </UField>
        <div class="grid-2">
          <UField label="服务类型" required>
            <USelect v-model="form.type" :disabled="!canEdit" :options="typeOptions" />
          </UField>
          <UField label="计费单位" required :hint="pkg ? '已有价格版本，不能修改单位' : '演示默认 1 天 = 连续 24 小时'">
            <USelect v-model="form.unit" :disabled="!canEdit || !!pkg" :options="unitOptions" />
          </UField>
        </div>
        <UField v-if="!pkg" label="首个单价" required :hint="`每${BILLING_UNIT_SHORT[form.unit]}，以整数分保存`" :error="touched ? errors.initialPrice : null">
          <UInput v-model="form.initialPrice!" prefix="¥" inputmode="decimal" placeholder="0.00" :invalid="touched && !!errors.initialPrice" />
        </UField>
        <UField label="服务内容" required :error="touched ? errors.content : null">
          <UInput v-model="form.content" multiline :rows="3" :maxlength="500" :disabled="!canEdit" />
        </UField>
        <UField label="明确不包含" required hint="例如注射、换药等医疗操作" :error="touched ? errors.exclusions : null">
          <UInput v-model="form.exclusions" multiline :rows="2" :maxlength="300" :disabled="!canEdit" />
        </UField>
        <div class="grid-2">
          <UField label="适用条件" optional><UInput v-model="form.conditions" :disabled="!canEdit" /></UField>
          <UField label="预约限制" optional><UInput v-model="form.limits" :disabled="!canEdit" /></UField>
        </div>
        <UField label="咨询电话" optional><UInput v-model="form.consultPhone" inputmode="tel" :disabled="!canEdit" /></UField>
      </section>

      <section class="stack">
        <p class="section-label">适用院区<span v-if="touched && errors.campusIds" class="c-danger"> · {{ errors.campusIds }}</span></p>
        <div class="sheet">
          <div v-for="h in campusOpts.data.value ?? []" :key="h.hospitalId" class="h-group">
            <p class="h-name">{{ h.hospitalName }}<UBadge v-if="!h.hospitalEnabled" tone="muted">未营业</UBadge></p>
            <div class="campuses">
              <UCheckbox
                v-for="c in h.campuses"
                :key="c.id"
                :model-value="form.campusIds.includes(c.id)"
                :disabled="!canEdit"
                @update:model-value="(v: boolean) => toggleCampus(c.id, v)"
              >{{ c.name }}<span v-if="!c.enabled" class="c-3">（已停用）</span></UCheckbox>
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else>
      <section v-if="canEdit" class="stack">
        <p class="section-label">新增价格版本</p>
        <div class="sheet form">
          <div class="grid-2">
            <UField label="单价" required :hint="pvPreview ? `每${BILLING_UNIT_SHORT[pkg!.unit]} ${formatFen(pvPreview)}` : '最多两位小数'">
              <UInput v-model="pv.price" prefix="¥" inputmode="decimal" placeholder="0.00" />
            </UField>
            <UField label="生效时间" required hint="北京时间，不能早于当前">
              <UInput v-model="pv.from" type="datetime-local" />
            </UField>
          </div>
          <UField label="调价说明" required><UInput v-model="pv.note" :maxlength="100" placeholder="例如：根据运营核定调整" /></UField>
          <p class="t-foot c-3">新版本只影响之后的报价。已创建订单保留下单时的价格快照，不会被改价。</p>
          <div class="row end"><UButton variant="primary" :loading="pvSaving" :disabled="!pv.price || !pv.note.trim() || !pv.from" @click="addVersion">新增版本</UButton></div>
        </div>
      </section>
      <section class="stack">
        <p class="section-label">版本历史 · 不可修改</p>
        <div class="sheet">
          <p v-if="vLoading && !versions.length" class="empty-line">加载中</p>
          <div v-for="v in versions" :key="v.id" class="ver">
            <span class="v-no num">v{{ v.version }}</span>
            <div class="grow stack gap-4">
              <span class="num v-price">{{ formatFen(v.unitPriceFen) }}<span class="c-3 t-foot"> / {{ BILLING_UNIT_SHORT[v.unit] }}</span></span>
              <span class="t-foot c-3 num">{{ formatDateTime(v.effectiveFrom) }} 起<template v-if="v.effectiveTo"> · 至 {{ formatDateTime(v.effectiveTo) }}</template> · {{ v.operatorName }}</span>
              <span v-if="v.note" class="t-foot c-2">{{ v.note }}</span>
            </div>
            <UBadge :tone="vState(v).tone">{{ vState(v).label }}</UBadge>
          </div>
        </div>
      </section>
    </template>

    <template #footer>
      <template v-if="tab === 'info' && canEdit">
        <UButton @click="emit('close')">取消</UButton>
        <UButton variant="primary" :loading="saving" @click="submit">{{ pkg ? '保存' : '创建套餐' }}</UButton>
      </template>
      <span v-else-if="!canEdit" class="t-foot c-3">当前身份只能查看套餐</span>
    </template>
  </UDrawer>
</template>

<style scoped>
.sheet { background: var(--surface); border-radius: 16px; padding: 0 16px; }
.form { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.h-group { padding: 14px 0; border-bottom: 1px solid var(--separator); }
.h-group:last-child { border-bottom: 0; }
.h-name { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--label-2); margin-bottom: 10px; }
.campuses { display: flex; flex-wrap: wrap; gap: 12px 24px; }
.ver { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--separator); }
.ver:last-child { border-bottom: 0; }
.v-no { width: 32px; font-size: 13px; color: var(--label-3); font-weight: 600; }
.v-price { font-size: 17px; font-weight: 600; }
.empty-line { padding: 14px 0; color: var(--label-3); font-size: 13px; }
@media (max-width: 767px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
