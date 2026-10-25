<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName } from './paths'

const props = withDefaults(defineProps<{ name: IconName; size?: number; stroke?: number }>(), { size: 18, stroke: 1.5 })
const markup = computed(() => ICONS[props.name])
</script>

<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="markup"
  />
</template>

<style scoped>
.icon { flex: none; display: block; }
</style>
