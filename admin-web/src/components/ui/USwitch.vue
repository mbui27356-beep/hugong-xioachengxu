<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
const props = defineProps<{ disabled?: boolean; label?: string; loading?: boolean }>()
const emit = defineEmits<{ change: [value: boolean] }>()
function toggle() {
  if (props.disabled || props.loading) return
  // 由父组件决定是否真正更新（例如需要确认或调用接口）
  emit('change', !model.value)
}
</script>

<template>
  <button
    type="button"
    role="switch"
    class="switch"
    :class="{ on: model, disabled, loading }"
    :aria-checked="model"
    :aria-label="label"
    :disabled="disabled"
    @click.stop="toggle"
  >
    <span class="knob" />
  </button>
</template>

<style scoped>
.switch {
  position: relative; width: 44px; height: 26px; flex: none; padding: 0; border: 0;
  border-radius: 999px; background: rgba(120, 120, 128, 0.24);
  transition: background-color 240ms var(--ease);
}
.switch.on { background: var(--success); }
.switch:focus-visible { box-shadow: var(--focus-ring); border-radius: 999px; }
.knob {
  position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16), 0 0 1px rgba(0, 0, 0, 0.12);
  transition: transform 240ms var(--ease);
}
.on .knob { transform: translateX(18px); }
.disabled { opacity: 0.4; cursor: not-allowed; }
.loading { opacity: 0.6; cursor: progress; }
</style>
