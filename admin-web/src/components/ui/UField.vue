<script setup lang="ts">
defineProps<{ label?: string; hint?: string; error?: string | null; required?: boolean; optional?: boolean }>()
</script>

<template>
  <div class="field">
    <div v-if="label" class="label-row">
      <span class="label">{{ label }}<span v-if="required" class="req" aria-hidden="true"> *</span></span>
      <span v-if="optional" class="opt">选填</span>
      <slot name="label-end" />
    </div>
    <slot />
    <p v-if="error" class="err" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.label-row { display: flex; align-items: baseline; gap: 8px; }
.label { font-size: 13px; line-height: 18px; font-weight: 500; color: var(--label); }
.req { color: var(--label-3); }
.opt { font-size: 12px; color: var(--label-3); }
.hint { font-size: 12px; line-height: 16px; color: var(--label-3); }
.err { font-size: 12px; line-height: 16px; color: var(--danger); }
</style>
