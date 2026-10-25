<script setup lang="ts">
import { BUSINESS_STATUS_LABEL, type BusinessStatus } from '@/contracts'
import { BUSINESS_TONE } from '@/ui/status'
import UBadge from './ui/UBadge.vue'
defineProps<{ status: BusinessStatus }>()
</script>

<template>
  <UBadge :tone="BUSINESS_TONE[status]">{{ BUSINESS_STATUS_LABEL[status] }}</UBadge>
</template>
