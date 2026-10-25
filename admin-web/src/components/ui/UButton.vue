<script setup lang="ts">
import Icon from '../icons/Icon.vue'
import type { IconName } from '../icons/paths'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'plain' | 'danger' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    icon?: IconName
    iconRight?: IconName
    loading?: boolean
    disabled?: boolean
    block?: boolean
    type?: 'button' | 'submit'
    iconOnly?: boolean
    title?: string
  }>(),
  { variant: 'secondary', size: 'md', type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    class="btn"
    :class="[`v-${variant}`, `s-${size}`, { block, loading, 'icon-only': iconOnly }]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :title="title"
    :aria-label="iconOnly ? title : undefined"
  >
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <Icon v-else-if="icon" :name="icon" :size="size === 'sm' ? 15 : 17" />
    <span v-if="$slots.default" class="label"><slot /></span>
    <Icon v-if="iconRight && !loading" :name="iconRight" :size="size === 'sm' ? 14 : 16" />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 0; border-radius: 999px; white-space: nowrap; font-weight: 500;
  transition: transform 200ms var(--ease), opacity 200ms var(--ease), background-color 200ms var(--ease);
  -webkit-tap-highlight-color: transparent; user-select: none;
}
.btn:active:not(:disabled) { transform: scale(0.98); opacity: 0.85; }
.btn:focus-visible { box-shadow: var(--focus-ring); border-radius: 999px; }
.btn:disabled { cursor: not-allowed; opacity: 0.4; }
.btn.loading:disabled { opacity: 0.7; }
.s-sm { height: 30px; padding: 0 12px; font-size: 13px; }
.s-md { height: 36px; padding: 0 16px; font-size: 15px; }
.s-lg { height: 50px; padding: 0 28px; font-size: 17px; font-weight: 600; }
.icon-only.s-sm { width: 30px; padding: 0; }
.icon-only.s-md { width: 36px; padding: 0; }
.block { width: 100%; }
.v-primary { background: var(--label); color: #fff; }
.v-primary:hover:not(:disabled) { background: #000; }
.v-secondary { background: var(--fill); color: var(--label); }
.v-secondary:hover:not(:disabled) { background: var(--fill-hover); }
.v-plain { background: transparent; color: var(--accent); padding-left: 8px; padding-right: 8px; }
.v-plain:hover:not(:disabled) { background: var(--accent-soft); }
.v-ghost { background: transparent; color: var(--label-2); }
.v-ghost:hover:not(:disabled) { background: var(--fill-2); color: var(--label); }
.v-danger { background: var(--danger-bg); color: var(--danger); }
.v-danger:hover:not(:disabled) { background: #fbdde1; }
.label { display: inline-flex; align-items: center; }
.spinner {
  width: 14px; height: 14px; border-radius: 50%;
  border: 1.5px solid currentColor; border-right-color: transparent;
  animation: spin 0.8s linear infinite; opacity: 0.8;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
