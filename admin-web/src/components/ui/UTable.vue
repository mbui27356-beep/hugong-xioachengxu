<script setup lang="ts" generic="T extends { id: string }">
import type { ApiError } from '@/contracts'
import UEmpty from './UEmpty.vue'
import USkeleton from './USkeleton.vue'
import UButton from './UButton.vue'
import type { IconName } from '../icons/paths'

import type { Column } from './types'

const props = withDefaults(
  defineProps<{
    columns: Column[]
    rows: T[]
    loading?: boolean
    error?: ApiError | null
    emptyTitle?: string
    emptyDescription?: string
    emptyIcon?: IconName
    clickable?: boolean
    selectedId?: string | null
    dense?: boolean
  }>(),
  { emptyTitle: '暂无数据', emptyIcon: 'inbox' },
)
const emit = defineEmits<{ rowClick: [row: T]; retry: [] }>()

function onRow(row: T) {
  if (props.clickable) emit('rowClick', row)
}
function onKey(e: KeyboardEvent, row: T) {
  if (props.clickable && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    emit('rowClick', row)
  }
}
</script>

<template>
  <div class="tbl-wrap" :class="{ busy: loading && rows.length > 0, dense }">
    <UEmpty
      v-if="error && !loading"
      tone="danger"
      icon="alert"
      title="加载失败"
      :description="`${error.message}`"
    >
      <UButton size="sm" icon="refresh" @click="emit('retry')">重试</UButton>
    </UEmpty>
    <template v-else>
      <table class="tbl">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" :style="{ width: c.width, textAlign: c.align ?? 'left' }">{{ c.label }}</th>
          </tr>
        </thead>
        <tbody v-if="loading && rows.length === 0">
          <tr v-for="i in 5" :key="i" class="sk-row">
            <td v-for="c in columns" :key="c.key" :data-label="c.label"><USkeleton :width="c.align === 'right' ? '60%' : '72%'" /></td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr
            v-for="row in rows"
            :key="row.id"
            :class="{ clickable, selected: selectedId === row.id }"
            :tabindex="clickable ? 0 : undefined"
            @click="onRow(row)"
            @keydown="onKey($event, row)"
          >
            <td
              v-for="c in columns"
              :key="c.key"
              :data-label="c.label"
              :class="{ 'm-hide': c.hideOnMobile, 'm-primary': c.primary, right: c.align === 'right', center: c.align === 'center' }"
            >
              <slot :name="`cell-${c.key}`" :row="row">{{ (row as Record<string, unknown>)[c.key] ?? '—' }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
      <UEmpty v-if="!loading && rows.length === 0" :icon="emptyIcon" :title="emptyTitle" :description="emptyDescription" compact>
        <slot name="empty-action" />
      </UEmpty>
    </template>
  </div>
</template>

<style scoped>
.tbl-wrap { width: 100%; overflow-x: auto; transition: opacity 200ms var(--ease); }
.busy { opacity: 0.6; pointer-events: none; }
.tbl { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 15px; line-height: 20px; }
th {
  position: sticky; top: 0; z-index: 1;
  padding: 10px 12px; font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.2px;
  color: var(--label-3); background: var(--surface); border-bottom: 1px solid var(--separator); white-space: nowrap;
}
th:first-child, td:first-child { padding-left: 24px; }
th:last-child, td:last-child { padding-right: 24px; }
td { padding: 14px 12px; border-bottom: 1px solid var(--separator); vertical-align: middle; color: var(--label); }
.dense td { padding-top: 10px; padding-bottom: 10px; }
tbody tr:last-child td { border-bottom: 0; }
td.right { text-align: right; }
td.center { text-align: center; }
tr.clickable { cursor: pointer; transition: background-color 150ms var(--ease); }
tr.clickable:hover td { background: rgba(0, 0, 0, 0.02); }
tr.clickable:focus-visible { outline: none; box-shadow: none; }
tr.clickable:focus-visible td { background: var(--accent-soft); }
tr.selected td { background: rgba(0, 113, 227, 0.05); }
.sk-row td { padding-top: 18px; padding-bottom: 18px; }

@media (max-width: 767px) {
  .tbl-wrap { overflow: visible; }
  .tbl, .tbl tbody, .tbl tr, .tbl td { display: block; width: 100%; }
  .tbl thead { display: none; }
  .tbl tr { padding: 14px 16px; border-bottom: 1px solid var(--separator); }
  .tbl tbody tr:last-child { border-bottom: 0; }
  .tbl td, th:first-child, td:first-child, td:last-child {
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    padding: 4px 0; border: 0; text-align: right;
  }
  .tbl td::before { content: attr(data-label); color: var(--label-3); font-size: 13px; text-align: left; flex: none; }
  .tbl td.m-primary { display: block; text-align: left; padding-bottom: 8px; font-weight: 600; }
  .tbl td.m-primary::before { display: none; }
  .tbl td.m-hide { display: none; }
  tr.clickable:hover td { background: transparent; }
  tr.clickable:active { background: rgba(0, 0, 0, 0.03); }
}
</style>
