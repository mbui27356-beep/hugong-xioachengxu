<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { confirmState } from '@/composables/confirm'
import UModal from './UModal.vue'
import UButton from './UButton.vue'
import UInput from './UInput.vue'
import UField from './UField.vue'
import USelect from './USelect.vue'

const reason = ref('')
const preset = ref('')
const touched = ref(false)
watch(() => confirmState.open, (v) => {
  if (v) {
    reason.value = ''
    preset.value = ''
    touched.value = false
  }
})
const combined = computed(() => [preset.value, reason.value.trim()].filter(Boolean).join('：'))
const missing = computed(() => !!confirmState.reason?.required && !combined.value)

function finish(ok: boolean) {
  if (ok && missing.value) {
    touched.value = true
    return
  }
  const r = confirmState.resolve
  confirmState.open = false
  confirmState.resolve = null
  r?.({ ok, reason: combined.value })
}
const open = computed({
  get: () => confirmState.open,
  set: (v: boolean) => { if (!v) finish(false) },
})
</script>

<template>
  <UModal v-model:open="open" :title="confirmState.title" :description="confirmState.message" :width="420">
    <template v-if="confirmState.reason">
      <UField :label="confirmState.reason.label" :required="confirmState.reason.required" :error="touched && missing ? '请填写原因' : null">
        <div class="stack gap-8">
          <USelect
            v-if="confirmState.reason.options?.length"
            v-model="preset"
            placeholder="选择常用原因"
            :options="confirmState.reason.options.map((o) => ({ label: o, value: o }))"
          />
          <UInput v-model="reason" multiline :rows="3" :maxlength="200" :placeholder="confirmState.reason.placeholder ?? '补充说明'" :invalid="touched && missing" />
        </div>
      </UField>
    </template>
    <template #footer>
      <UButton @click="finish(false)">{{ confirmState.cancelText ?? '取消' }}</UButton>
      <UButton :variant="confirmState.destructive ? 'danger' : 'primary'" @click="finish(true)">{{ confirmState.confirmText ?? '确定' }}</UButton>
    </template>
  </UModal>
</template>
