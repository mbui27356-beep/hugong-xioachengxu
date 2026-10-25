<script setup lang="ts">
import type { SegmentOption } from './types'
const model = defineModel<string>({ default: '' })
withDefaults(defineProps<{ options: SegmentOption[]; size?: 'md' | 'sm'; ariaLabel?: string }>(), { size: 'md' })
</script>

<template>
  <div class="seg-scroll">
    <div class="seg" :class="`s-${size}`" role="tablist" :aria-label="ariaLabel">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        role="tab"
        class="item"
        :class="{ active: model === o.value }"
        :aria-selected="model === o.value"
        @click="model = o.value"
      >
        {{ o.label }}<span v-if="o.count !== undefined" class="count num">{{ o.count }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.seg-scroll { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
.seg-scroll::-webkit-scrollbar { display: none; }
.seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 10px; background: var(--fill); }
.item {
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
  height: 32px; padding: 0 14px; border: 0; border-radius: 8px; background: transparent;
  font-size: 13px; font-weight: 500; color: var(--label);
  transition: background-color 200ms var(--ease), box-shadow 200ms var(--ease);
}
.s-sm .item { height: 28px; padding: 0 12px; }
.item:hover:not(.active) { background: rgba(255, 255, 255, 0.5); }
.item.active { background: var(--surface); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.06); }
.item:focus-visible { box-shadow: var(--focus-ring); border-radius: 8px; }
.count { font-size: 12px; color: var(--label-3); font-weight: 500; }
.active .count { color: var(--label-2); }
</style>
