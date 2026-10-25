<script setup lang="ts">
import type { Tone } from './types'
withDefaults(defineProps<{ tone?: Tone; dot?: boolean }>(), { tone: 'neutral' })
</script>

<template>
  <span class="badge" :class="`t-${tone}`"><span v-if="dot" class="dot" /><slot /></span>
</template>

<style scoped>
.badge {
  display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 9px;
  border-radius: 999px; font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.2px; white-space: nowrap;
}
.dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.t-neutral { background: var(--fill); color: var(--label-2); }
.t-muted { background: var(--fill-2); color: var(--label-3); }
.t-accent { background: var(--accent-soft); color: var(--accent); }
.t-success { background: var(--success-bg); color: var(--success); }
.t-warning { background: var(--warning-bg); color: var(--warning); }
.t-danger { background: var(--danger-bg); color: var(--danger); }
.t-indigo { background: var(--indigo-bg); color: var(--indigo); }
</style>
