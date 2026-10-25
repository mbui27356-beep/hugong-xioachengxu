<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { callApi } from '@/composables/api'
import { saveHospital, type CityRow, type GradeRow, type HospitalInput, type HospitalRow } from '@/services/catalog'
import { UButton, UField, UInput, UModal, USelect } from '@/components/ui'

const props = defineProps<{ open: boolean; hospital: HospitalRow | null; cities: CityRow[]; grades: GradeRow[] }>()
const emit = defineEmits<{ close: []; saved: [id: string] }>()

const form = reactive<HospitalInput>({ name: '', cityId: '', districtId: null, gradeId: '', displayAddress: '', phone: '' })
const saving = ref(false)
const touched = ref(false)

watch(() => props.open, (v) => {
  if (!v) return
  touched.value = false
  const h = props.hospital
  Object.assign(form, h
    ? { id: h.id, name: h.name, cityId: h.cityId, districtId: h.districtId, gradeId: h.gradeId, displayAddress: h.displayAddress, phone: h.phone }
    : { id: undefined, name: '', cityId: props.cities.find((c) => c.enabled)?.id ?? '', districtId: null, gradeId: '', displayAddress: '', phone: '' })
})

const districtId = computed({
  get: () => form.districtId ?? '',
  set: (v: string) => (form.districtId = v || null),
})
const districts = computed(() => props.cities.find((c) => c.id === form.cityId)?.districts ?? [])
// 城市变化后清空不兼容的区县
watch(() => form.cityId, () => {
  if (form.districtId && !districts.value.some((d) => d.id === form.districtId)) form.districtId = null
})

const errors = computed(() => ({
  name: !form.name.trim() ? '请填写医院名称' : null,
  cityId: !form.cityId ? '请选择城市' : null,
  gradeId: !form.gradeId ? '请选择等级' : null,
  displayAddress: !form.displayAddress.trim() ? '请填写展示地址' : null,
}))
const valid = computed(() => Object.values(errors.value).every((e) => !e))

const openModel = computed({ get: () => props.open, set: (v: boolean) => { if (!v) emit('close') } })

async function submit() {
  touched.value = true
  if (!valid.value) return
  saving.value = true
  const r = await callApi(saveHospital({ ...form }), props.hospital ? '医院信息已保存' : '医院已创建，默认未营业')
  saving.value = false
  if (r) emit('saved', r.id)
}
</script>

<template>
  <UModal v-model:open="openModel" :title="hospital ? '编辑医院' : '新增医院'" description="名称、院区与地址需由运营核实后录入。具体到岗地址以院区为准。" :width="560">
    <div class="grid">
      <UField label="医院名称" required class="span-2" :error="touched ? errors.name : null">
        <UInput v-model="form.name" placeholder="例如：宜昌市中心人民医院" :maxlength="40" :invalid="touched && !!errors.name" />
      </UField>
      <UField label="城市" required :error="touched ? errors.cityId : null">
        <USelect v-model="form.cityId" placeholder="选择城市" :options="cities.map((c) => ({ label: c.enabled ? c.name : `${c.name}（未开通）`, value: c.id }))" :invalid="touched && !!errors.cityId" />
      </UField>
      <UField label="区县" optional>
        <USelect v-model="districtId" placeholder="不指定" :options="districts.map((d) => ({ label: d.name, value: d.id }))" :disabled="!form.cityId" />
      </UField>
      <UField label="医院等级" required :error="touched ? errors.gradeId : null">
        <USelect v-model="form.gradeId" placeholder="选择等级" :options="grades.filter((g) => g.enabled || g.id === form.gradeId).map((g) => ({ label: g.name, value: g.id }))" :invalid="touched && !!errors.gradeId" />
      </UField>
      <UField label="联系电话" optional>
        <UInput v-model="form.phone" placeholder="0717-0000-0000" inputmode="tel" />
      </UField>
      <UField label="展示地址" required class="span-2" hint="显示在医院卡片上；到岗地址以院区地址为准" :error="touched ? errors.displayAddress : null">
        <UInput v-model="form.displayAddress" :maxlength="80" :invalid="touched && !!errors.displayAddress" />
      </UField>
    </div>
    <template #footer>
      <UButton @click="emit('close')">取消</UButton>
      <UButton variant="primary" :loading="saving" @click="submit">{{ hospital ? '保存' : '创建' }}</UButton>
    </template>
  </UModal>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.span-2 { grid-column: span 2; }
@media (max-width: 767px) {
  .grid { grid-template-columns: 1fr; }
  .span-2 { grid-column: auto; }
}
</style>
