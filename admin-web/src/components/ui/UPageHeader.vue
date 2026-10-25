<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="ph">
    <div class="titles">
      <h1 class="t-large">{{ title }}</h1>
      <p v-if="subtitle" class="t-sub c-2">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.default" class="actions"><slot /></div>
  </header>
</template>

<style scoped>
.ph { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-top: 8px; }
.titles { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
