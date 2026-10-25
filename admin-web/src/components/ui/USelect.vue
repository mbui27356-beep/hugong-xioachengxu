<script setup lang="ts">
import Icon from '../icons/Icon.vue'

import type { SelectOption } from './types'
const model = defineModel<string>({ default: '' })
withDefaults(
  defineProps<{ options: SelectOption[]; placeholder?: string; invalid?: boolean; disabled?: boolean; size?: 'md' | 'sm'; ariaLabel?: string }>(),
  { size: 'md' },
)
</script>

<template>
  <label class="select" :class="[{ invalid, disabled, empty: !model }, `s-${size}`]">
    <select v-model="model" :disabled="disabled" :aria-label="ariaLabel ?? placeholder">
      <option v-if="placeholder !== undefined" value="">{{ placeholder }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value" :disabled="o.disabled">{{ o.label }}</option>
    </select>
    <Icon name="chevronDown" :size="14" class="chev" />
  </label>
</template>

<style scoped>
.select {
  position: relative; display: inline-flex; align-items: center; min-width: 0;
  height: 36px; border-radius: var(--radius-control); background: var(--fill-2);
  border: 1px solid transparent; transition: background-color 200ms var(--ease), box-shadow 200ms var(--ease);
}
.select.s-sm { height: 32px; }
.select:hover { background: var(--fill); }
.select:focus-within { background: var(--surface); border-color: var(--accent); box-shadow: var(--focus-ring); }
.select.invalid { border-color: var(--danger); }
.select.disabled { opacity: 0.55; }
select {
  appearance: none; -webkit-appearance: none; width: 100%; height: 100%;
  border: 0; background: transparent; padding: 0 32px 0 12px; font-size: 15px; outline: none; cursor: pointer;
  text-overflow: ellipsis;
}
select:focus-visible { box-shadow: none; }
.empty select { color: var(--label-2); }
.chev { position: absolute; right: 10px; pointer-events: none; color: var(--label-3); }
</style>
