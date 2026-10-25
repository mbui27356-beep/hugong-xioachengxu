<script setup lang="ts">
withDefaults(defineProps<{ title?: string; subtitle?: string; padding?: 'none' | 'md' | 'lg' }>(), { padding: 'md' })
</script>

<template>
  <section class="card" :class="`p-${padding}`">
    <header v-if="title || $slots.actions || $slots.header" class="head">
      <div class="titles">
        <h2 v-if="title" class="t-headline">{{ title }}</h2>
        <p v-if="subtitle" class="t-foot c-2">{{ subtitle }}</p>
        <slot name="header" />
      </div>
      <div v-if="$slots.actions" class="actions"><slot name="actions" /></div>
    </header>
    <div class="body"><slot /></div>
  </section>
</template>

<style scoped>
.card { background: var(--surface); border-radius: var(--radius-card); min-width: 0; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 24px 0; }
.titles { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.actions { display: flex; align-items: center; gap: 8px; flex: none; }
.p-md > .body { padding: 16px 24px 24px; }
.p-lg > .body { padding: 24px 28px 28px; }
.p-none > .body { padding: 8px 0 0; }
.p-none > .head { padding-bottom: 8px; }
.card:not(:has(> .head)) > .body { padding-top: 20px; }
.card.p-none:not(:has(> .head)) > .body { padding-top: 0; }
@media (max-width: 767px) {
  .head { padding: 16px 16px 0; }
  .p-md > .body, .p-lg > .body { padding: 12px 16px 16px; }
}
</style>
