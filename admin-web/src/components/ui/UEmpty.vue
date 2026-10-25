<script setup lang="ts">
import Icon from '../icons/Icon.vue'
import type { IconName } from '../icons/paths'
withDefaults(defineProps<{ icon?: IconName; title: string; description?: string; compact?: boolean; tone?: 'neutral' | 'danger' }>(), {
  icon: 'inbox',
  tone: 'neutral',
})
</script>

<template>
  <div class="empty" :class="{ compact, danger: tone === 'danger' }">
    <div class="ic"><Icon :name="icon" :size="compact ? 22 : 28" :stroke="1.4" /></div>
    <p class="t-headline title">{{ title }}</p>
    <p v-if="description" class="t-foot c-2 desc">{{ description }}</p>
    <div v-if="$slots.default" class="act"><slot /></div>
  </div>
</template>

<style scoped>
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 56px 24px; gap: 6px; }
.compact { padding: 32px 16px; }
.ic { color: var(--label-4); margin-bottom: 8px; }
.danger .ic { color: var(--danger); }
.title { font-size: 15px; }
.desc { max-width: 360px; }
.act { margin-top: 12px; display: flex; gap: 8px; }
</style>
