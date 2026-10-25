<script setup lang="ts">
import { ref } from 'vue'
import Icon from '../icons/Icon.vue'
import type { IconName } from '../icons/paths'

const model = defineModel<string>({ default: '' })
withDefaults(
  defineProps<{
    placeholder?: string
    type?: string
    icon?: IconName
    multiline?: boolean
    rows?: number
    maxlength?: number
    invalid?: boolean
    clearable?: boolean
    disabled?: boolean
    readonly?: boolean
    suffix?: string
    prefix?: string
    autofocus?: boolean
    inputmode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'search'
    size?: 'md' | 'sm'
  }>(),
  { type: 'text', rows: 4, size: 'md' },
)
const el = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
defineExpose({ focus: () => el.value?.focus() })
</script>

<template>
  <div v-if="multiline" class="field-box area" :class="{ invalid, disabled }">
    <textarea
      ref="el"
      v-model="model"
      :rows="rows"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :disabled="disabled"
      :readonly="readonly"
      :autofocus="autofocus"
    />
    <span v-if="maxlength" class="count num">{{ model.length }}/{{ maxlength }}</span>
  </div>
  <label v-else class="field-box" :class="[{ invalid, disabled }, `s-${size}`]">
    <Icon v-if="icon" :name="icon" :size="16" class="lead" />
    <span v-if="prefix" class="affix">{{ prefix }}</span>
    <input
      ref="el"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :disabled="disabled"
      :readonly="readonly"
      :autofocus="autofocus"
      :inputmode="inputmode"
    />
    <span v-if="suffix" class="affix">{{ suffix }}</span>
    <slot name="end" />
    <button v-if="clearable && model" type="button" class="clear" aria-label="清空" @click="model = ''">
      <Icon name="close" :size="12" :stroke="2" />
    </button>
  </label>
</template>

<style scoped>
.field-box {
  display: flex; align-items: center; gap: 8px; min-width: 0;
  height: 36px; padding: 0 12px; border-radius: var(--radius-control);
  background: var(--fill-2); border: 1px solid transparent;
  transition: background-color 200ms var(--ease), box-shadow 200ms var(--ease), border-color 200ms var(--ease);
}
.field-box.s-sm { height: 32px; }
.field-box:hover { background: var(--fill); }
.field-box:focus-within { background: var(--surface); border-color: var(--accent); box-shadow: var(--focus-ring); }
.field-box.invalid { border-color: var(--danger); background: var(--surface); }
.field-box.invalid:focus-within { box-shadow: 0 0 0 4px rgba(215, 0, 21, 0.14); }
.field-box.disabled { opacity: 0.55; }
input, textarea {
  flex: 1; min-width: 0; border: 0; background: transparent; outline: none; padding: 0;
  font-size: 15px; line-height: 20px; color: var(--label);
}
input::placeholder, textarea::placeholder { color: var(--label-3); }
input:focus-visible, textarea:focus-visible { box-shadow: none; }
.lead { color: var(--label-3); }
.affix { color: var(--label-3); font-size: 15px; }
.area { height: auto; padding: 10px 12px; flex-direction: column; align-items: stretch; position: relative; }
.area textarea { resize: vertical; min-height: 60px; }
.count { align-self: flex-end; font-size: 12px; color: var(--label-3); }
.clear {
  width: 18px; height: 18px; border-radius: 50%; border: 0; padding: 0;
  display: grid; place-items: center; background: var(--label-4); color: #fff; flex: none;
}
</style>
