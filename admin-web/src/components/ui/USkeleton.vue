<script setup lang="ts">
withDefaults(defineProps<{ width?: string; height?: string; radius?: string }>(), { width: '100%', height: '14px', radius: '6px' })
</script>

<template>
  <span class="sk" :style="{ width, height, borderRadius: radius }" aria-hidden="true" />
</template>

<style scoped>
.sk { display: block; background: rgba(0, 0, 0, 0.06); animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
</style>
