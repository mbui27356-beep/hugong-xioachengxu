<script setup lang="ts">
import { PAYMENT_STATUS_LABEL, type PaymentStatus } from '@/contracts'
import { PAYMENT_TONE } from '@/ui/status'
import UBadge from './ui/UBadge.vue'
defineProps<{ status: PaymentStatus }>()
</script>

<template>
  <UBadge :tone="PAYMENT_TONE[status]">{{ PAYMENT_STATUS_LABEL[status] }}</UBadge>
</template>
