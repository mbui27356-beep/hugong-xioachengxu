<script setup lang="ts">
import Icon from '../icons/Icon.vue'
const model = defineModel<boolean>({ default: false })
defineProps<{ disabled?: boolean }>()
</script>

<template>
  <label class="check" :class="{ disabled }">
    <input v-model="model" type="checkbox" :disabled="disabled" />
    <span class="box" :class="{ on: model }"><Icon v-if="model" name="check" :size="12" :stroke="2.4" /></span>
    <span v-if="$slots.default" class="text"><slot /></span>
  </label>
</template>

<style scoped>
.check { display: inline-flex; align-items: flex-start; gap: 10px; cursor: pointer; font-size: 15px; line-height: 20px; }
.check input { position: absolute; opacity: 0; width: 0; height: 0; }
.box {
  width: 20px; height: 20px; border-radius: 6px; flex: none; margin-top: 0;
  display: grid; place-items: center; color: #fff;
  box-shadow: inset 0 0 0 1.5px var(--label-4); transition: background-color 200ms var(--ease), box-shadow 200ms var(--ease);
}
.box.on { background: var(--accent); box-shadow: none; }
.check input:focus-visible + .box { box-shadow: var(--focus-ring), inset 0 0 0 1.5px var(--accent); }
.disabled { opacity: 0.5; cursor: not-allowed; }
.text { color: var(--label); }
</style>
