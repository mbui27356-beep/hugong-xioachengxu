<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { callApi, useResource } from '@/composables/api'
import { can } from '@/composables/session'
import { listMessages, listRecipients, sendMessage, type MessageRow } from '@/services/messages'
import { formatDateTime, formatRelative } from '@/domain/time'
import { UBadge, UButton, UCard, UField, UInput, UPageHeader, USegmented, USelect, UTable, Icon, type Column } from '@/components/ui'

const canSend = computed(() => can('message.send'))
const typeFilter = ref<'' | 'SYSTEM' | 'MANUAL'>('')
const keyword = ref('')
const history = useResource(() => listMessages({ type: typeFilter.value, keyword: keyword.value }))
let t = 0
watch([typeFilter, keyword], () => {
  window.clearTimeout(t)
  t = window.setTimeout(() => void history.reload(), 200)
})
const recipients = useResource(listRecipients, { immediate: canSend.value })

const form = reactive({ target: 'order' as 'order' | 'user', userId: '', orderId: '', title: '', body: '' })
const sending = ref(false)
const touched = ref(false)
const TEMPLATES = [
  { label: '到岗提醒', title: '陪护人员即将到岗', body: '您预约的陪护人员将按约定时间到岗，如需调整请联系客服。' },
  { label: '补充床号', title: '请补充病房床号', body: '为便于护工准时到岗，请在订单详情补充病房与床号。' },
  { label: '交接调整', title: '交接时间调整', body: '本周陪护交接时间调整，具体以护工现场告知为准。' },
]
const errors = computed(() => ({
  target: form.target === 'order' ? (!form.orderId ? '请选择订单' : null) : !form.userId ? '请选择用户' : null,
  title: !form.title.trim() ? '请填写标题' : null,
  body: !form.body.trim() ? '请填写正文' : null,
}))
async function send() {
  touched.value = true
  if (Object.values(errors.value).some(Boolean)) return
  sending.value = true
  const r = await callApi(sendMessage({ ...form }), '站内通知已发送')
  sending.value = false
  if (r) {
    Object.assign(form, { title: '', body: '' })
    touched.value = false
    await history.reload()
  }
}

const columns: Column[] = [
  { key: 'title', label: '通知', primary: true },
  { key: 'to', label: '接收人' },
  { key: 'order', label: '关联订单', hideOnMobile: true },
  { key: 'channel', label: '渠道' },
  { key: 'time', label: '发送时间', align: 'right' },
]
function readState(m: MessageRow) {
  return m.readAt ? { label: '已读', tone: 'muted' as const } : { label: '未读', tone: 'accent' as const }
}
</script>

<template>
  <div class="page">
    <UPageHeader title="消息管理" subtitle="向指定用户或订单发送站内通知。微信订阅消息需模板与用户授权，另设渠道，当前未开通。" />

    <div class="layout" :class="{ 'no-send': !canSend }">
      <UCard v-if="canSend" title="发送站内通知" subtitle="内容避免包含健康详情与完整身份信息" class="compose">
        <div class="stack gap-16">
          <USegmented v-model="form.target" :options="[{ value: 'order', label: '按订单' }, { value: 'user', label: '按用户' }]" size="sm" />
          <UField v-if="form.target === 'order'" label="订单" required :error="touched ? errors.target : null">
            <USelect v-model="form.orderId" placeholder="选择订单" :options="(recipients.data.value?.orders ?? []).map((o) => ({ label: o.label, value: o.id }))" :invalid="touched && !!errors.target" />
          </UField>
          <UField v-else label="用户" required :error="touched ? errors.target : null">
            <USelect v-model="form.userId" placeholder="选择用户" :options="(recipients.data.value?.users ?? []).map((u) => ({ label: u.label, value: u.id }))" :invalid="touched && !!errors.target" />
          </UField>
          <div class="templates">
            <span class="t-caption c-3">常用模板</span>
            <button v-for="tp in TEMPLATES" :key="tp.label" type="button" class="tpl" @click="Object.assign(form, { title: tp.title, body: tp.body })">{{ tp.label }}</button>
          </div>
          <UField label="标题" required :error="touched ? errors.title : null">
            <UInput v-model="form.title" :maxlength="30" :invalid="touched && !!errors.title" />
          </UField>
          <UField label="正文" required :error="touched ? errors.body : null">
            <UInput v-model="form.body" multiline :rows="4" :maxlength="300" :invalid="touched && !!errors.body" />
          </UField>
          <div class="channels">
            <div class="ch"><Icon name="check" :size="14" :stroke="2" class="c-success" /><span>站内通知</span><span class="c-3">用户在小程序消息中心查看</span></div>
            <div class="ch"><Icon name="lock" :size="14" class="c-4" /><span class="c-3">微信订阅消息</span><span class="c-3">未开通</span></div>
          </div>
          <UButton variant="primary" icon="send" :loading="sending" block @click="send">发送</UButton>
        </div>
      </UCard>

      <div class="stack gap-12 history">
        <div class="toolbar">
          <USegmented v-model="typeFilter" size="sm" :options="[{ value: '', label: '全部' }, { value: 'MANUAL', label: '人工发送' }, { value: 'SYSTEM', label: '系统通知' }]" />
          <UInput v-model="keyword" class="grow" icon="search" size="sm" placeholder="标题、接收人或订单号" clearable />
        </div>
        <UCard padding="none">
          <UTable :columns="columns" :rows="history.data.value ?? []" :loading="history.loading.value" :error="history.error.value" empty-icon="bell" empty-title="暂无发送记录" @retry="history.reload">
            <template #cell-title="{ row }">
              <div class="stack gap-4 msg">
                <div class="row gap-8"><span class="strong ellipsis">{{ row.title }}</span><UBadge v-if="row.type === 'MANUAL'" tone="neutral">人工</UBadge></div>
                <span class="t-foot c-3 ellipsis">{{ row.body }}</span>
              </div>
            </template>
            <template #cell-to="{ row }"><span class="nowrap">{{ row.recipientName }}</span></template>
            <template #cell-order="{ row }"><span class="mono c-2">{{ row.orderNo ?? '—' }}</span></template>
            <template #cell-channel="{ row }"><UBadge :tone="readState(row).tone">站内 · {{ readState(row).label }}</UBadge></template>
            <template #cell-time="{ row }"><span class="t-foot c-2 nowrap" :title="formatDateTime(row.createdAt)">{{ formatRelative(row.createdAt) }}</span></template>
          </UTable>
        </UCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 20px; align-items: start; }
.layout.no-send { grid-template-columns: minmax(0, 1fr); }
.compose { position: sticky; top: calc(var(--topbar-h) + 16px); }
.templates { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.tpl { height: 28px; padding: 0 12px; border: 0; border-radius: 999px; background: var(--fill); font-size: 13px; color: var(--label); }
.tpl:hover { background: var(--fill-hover); }
.channels { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--fill-2); border-radius: var(--radius-control); }
.ch { display: grid; grid-template-columns: 16px auto 1fr; gap: 8px; align-items: center; font-size: 13px; }
.ch > :last-child { text-align: right; }
.strong { font-weight: 500; }
.msg { max-width: 320px; }
@media (max-width: 1023px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .compose { position: static; }
}
@media (max-width: 767px) { .msg { max-width: 240px; } }
</style>
