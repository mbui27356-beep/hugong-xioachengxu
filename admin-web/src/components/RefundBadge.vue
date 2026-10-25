<script setup lang="ts">
import { REFUND_STATUS_LABEL, type RefundStatus } from '@/contracts'
import { REFUND_TONE } from '@/ui/status'
import UBadge from './ui/UBadge.vue'
defineProps<{ status: RefundStatus }>()
</script>

<template>
  <UBadge :tone="REFUND_TONE[status]">{{ REFUND_STATUS_LABEL[status] }}</UBadge>
</template>
