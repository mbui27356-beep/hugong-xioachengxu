<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { callApi, useResource } from '@/composables/api'
import { confirmDialog } from '@/composables/confirm'
import { can } from '@/composables/session'
import { exportPatients, listPatients, revealPatient, REVEAL_REASONS, type PatientRow } from '@/services/patients'
import { UBadge, UButton, UCard, UInput, UPageHeader, UTable, Icon, type Column } from '@/components/ui'

const route = useRoute()
const keyword = ref((route.query.q as string) || '')
const { data, loading, error, reload } = useResource(() => listPatients(keyword.value))
let t = 0
watch(keyword, () => {
  window.clearTimeout(t)
  t = window.setTimeout(() => void reload(), 250)
})

// 已展开的完整资料：60 秒后自动重新脱敏
const revealed = reactive<Record<string, { name: string; contactName: string; contactPhone: string; expiresAt: number }>>({})
const now = ref(Date.now())
const tick = window.setInterval(() => {
  now.value = Date.now()
  for (const [id, v] of Object.entries(revealed)) if (v.expiresAt <= now.value) delete revealed[id]
}, 1000)
onBeforeUnmount(() => window.clearInterval(tick))

async function reveal(p: PatientRow) {
  const c = await confirmDialog({
    title: '查看完整资料',
    message: `仅为处理相关订单查看 ${p.name} 的资料。本次查看会记录操作者、时间与原因，60 秒后自动恢复脱敏。`,
    confirmText: '查看',
    reason: { label: '查看原因', required: true, options: [...REVEAL_REASONS], placeholder: '补充说明（选填）' },
  })
  if (!c.ok) return
  const [reason, ...rest] = c.reason.split('：')
  const r = await callApi(revealPatient(p.id, reason, rest.join('：')), '已记录查看日志')
  if (r) revealed[p.id] = r
}
function hide(id: string) {
  delete revealed[id]
}
async function onExport() {
  await callApi(exportPatients())
}

const columns: Column[] = [
  { key: 'name', label: '就诊人', primary: true },
  { key: 'contact', label: '联系人' },
  { key: 'phone', label: '联系电话' },
  { key: 'owner', label: '归属账号', hideOnMobile: true },
  { key: 'orders', label: '相关订单', hideOnMobile: true },
  { key: 'ops', label: '', align: 'right' },
]
</script>

<template>
  <div class="page">
    <UPageHeader title="就诊人资料" subtitle="只显示与你负责医院订单相关的就诊人。默认脱敏，查看完整资料需填写原因并写入操作日志。">
      <UButton icon="lock" :title="can('patient.export') ? '演示环境不开放导出' : '当前身份无导出权限'" :disabled="!can('patient.export')" @click="onExport">导出</UButton>
    </UPageHeader>

    <div class="toolbar">
      <UInput v-model="keyword" class="grow" icon="search" placeholder="姓名、订单号或联系电话后 4 位" clearable />
    </div>

    <UCard padding="none">
      <UTable
        :columns="columns"
        :rows="data ?? []"
        :loading="loading"
        :error="error"
        empty-icon="patient"
        :empty-title="keyword ? '没有匹配的就诊人' : '暂无就诊人'"
        empty-description="就诊人归属用户账号，由用户在小程序中维护"
        @retry="reload"
      >
        <template #cell-name="{ row }">
          <div class="row gap-8">
            <span class="strong">{{ revealed[row.id]?.name ?? row.name }}</span>
            <span class="t-foot c-3">{{ row.gender }}<template v-if="row.age"> · {{ row.age }} 岁</template></span>
          </div>
        </template>
        <template #cell-contact="{ row }">{{ revealed[row.id]?.contactName ?? row.contactName }} <span class="c-3 t-foot">· {{ row.relationship }}</span></template>
        <template #cell-phone="{ row }">
          <span class="num" :class="{ revealed: !!revealed[row.id] }">{{ revealed[row.id]?.contactPhone ?? row.contactPhone }}</span>
        </template>
        <template #cell-owner="{ row }"><span class="c-2">{{ row.ownerNickname }}</span></template>
        <template #cell-orders="{ row }">
          <span class="t-foot c-2">{{ row.orderCount }} 单 · <span class="mono">{{ row.latestOrderNo }}</span></span>
        </template>
        <template #cell-ops="{ row }">
          <template v-if="revealed[row.id]">
            <span class="countdown num">{{ Math.max(0, Math.ceil((revealed[row.id].expiresAt - now) / 1000)) }} 秒后脱敏</span>
            <UButton size="sm" variant="ghost" icon="eyeOff" @click="hide(row.id)">隐藏</UButton>
          </template>
          <UButton v-else-if="can('patient.reveal')" size="sm" variant="plain" icon="eye" @click="reveal(row)">查看完整</UButton>
          <UBadge v-else tone="muted">无查看权限</UBadge>
        </template>
      </UTable>
    </UCard>
    <p class="t-foot c-3 note"><Icon name="shield" :size="14" />首版不采集身份证照片、病历图片或完整身份证号。常用就诊人只对创建账号可见。</p>
  </div>
</template>

<style scoped>
.strong { font-weight: 500; }
.revealed { color: var(--label); font-weight: 500; }
.countdown { font-size: 12px; color: var(--warning); margin-right: 8px; }
.note { display: flex; align-items: center; gap: 6px; padding: 0 4px; margin-top: -16px; }
</style>
