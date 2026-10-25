<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AGREEMENT_TYPE_LABEL, type Agreement, type AgreementType } from '@/contracts'
import { contentHash } from '@/domain/hash'
import { formatDateTime } from '@/domain/time'
import { callApi, useResource } from '@/composables/api'
import { confirmDialog } from '@/composables/confirm'
import { can } from '@/composables/session'
import { discardDraft, getAgreements, publishDraft, saveDraft } from '@/services/agreements'
import { UBadge, UButton, UCard, UEmpty, UField, UInput, UModal, UPageHeader, USegmented, USkeleton } from '@/components/ui'

const type = ref<AgreementType>('SERVICE')
const { data, loading, error, reload } = useResource(() => getAgreements(type.value))
watch(type, () => void reload())
const canEdit = computed(() => can('agreement.publish'))

const title = ref('')
const body = ref('')
const editing = ref(false)
watch(data, (d) => {
  if (!d) return
  const src = d.draft
  editing.value = !!src
  title.value = src?.title ?? ''
  body.value = src?.body ?? ''
})
const dirty = computed(() => !!data.value && (title.value !== (data.value.draft?.title ?? '') || body.value !== (data.value.draft?.body ?? '')))
const draftHash = computed(() => contentHash(title.value + '\n' + body.value))
const sameAsPublished = computed(() => data.value?.published?.contentHash === draftHash.value)

function startDraft() {
  title.value = data.value?.published?.title ?? AGREEMENT_TYPE_LABEL[type.value]
  body.value = data.value?.published?.body ?? ''
  editing.value = true
}
const saving = ref(false)
async function save() {
  saving.value = true
  const r = await callApi(saveDraft(type.value, { title: title.value, body: body.value }), '草稿已保存')
  saving.value = false
  if (r) await reload()
  return !!r
}
async function discard() {
  const c = await confirmDialog({ title: '放弃草稿', message: '草稿内容将被删除，已发布版本不受影响。', confirmText: '放弃', destructive: true })
  if (!c.ok) return
  if (data.value?.draft) {
    if (await callApi(discardDraft(type.value), '草稿已放弃')) await reload()
  } else {
    editing.value = false
  }
}
async function publish() {
  if (dirty.value && !(await save())) return
  const c = await confirmDialog({
    title: `发布${AGREEMENT_TYPE_LABEL[type.value]}`,
    message: `将生成 v${(data.value?.versions[0]?.version ?? 0) + 1}，发布后内容不可修改。新订单记录新版本号与摘要；有重大变动时，小程序会要求用户重新确认。`,
    confirmText: '发布',
    reason: { label: '变更说明', required: true, placeholder: '例如：补充客服联系方式' },
  })
  if (!c.ok) return
  if (await callApi(publishDraft(type.value, c.reason), '已发布新版本')) await reload()
}

const previewOpen = ref(false)
const viewing = ref<Agreement | null>(null)
const previewDoc = computed(() => viewing.value ?? { title: title.value, body: body.value, version: 0, contentHash: draftHash.value, publishedAt: null, publisherName: null })
function openPreview(a?: Agreement) {
  viewing.value = a ?? null
  previewOpen.value = true
}

const typeOptions = computed(() =>
  (Object.keys(AGREEMENT_TYPE_LABEL) as AgreementType[]).map((t) => {
    const c = data.value?.counts.find((x) => x.type === t)
    return { value: t, label: `${AGREEMENT_TYPE_LABEL[t]}${c?.hasDraft ? ' · 草稿' : ''}` }
  }),
)
</script>

<template>
  <div class="page">
    <UPageHeader title="协议配置" subtitle="草稿可修改；发布后形成不可覆盖的新版本。订单保存确认的版本号、内容摘要与确认时间。" />

    <USegmented v-model="type" :options="typeOptions" />

    <UCard v-if="error" padding="none">
      <UEmpty tone="danger" icon="alert" title="加载失败" :description="error.message"><UButton size="sm" @click="reload">重试</UButton></UEmpty>
    </UCard>

    <div v-else class="layout">
      <UCard :title="editing ? '草稿' : '当前版本'" :subtitle="editing ? (dirty ? '有未保存的修改' : data?.draft ? `已保存 · ${formatDateTime(data.draft.updatedAt)}` : '尚未保存') : data?.published ? `v${data.published.version} · ${formatDateTime(data.published.publishedAt)} 发布` : '尚未发布'">
        <template #actions>
          <UBadge v-if="editing" tone="warning">未发布</UBadge>
          <UBadge v-else-if="data?.published" tone="success">生效中</UBadge>
        </template>
        <div v-if="loading && !data" class="stack gap-12"><USkeleton height="36px" /><USkeleton height="280px" radius="12px" /></div>
        <template v-else-if="editing">
          <div class="stack gap-16">
            <UField label="标题" required><UInput v-model="title" :maxlength="40" :disabled="!canEdit" /></UField>
            <UField label="正文" required :hint="`摘要 ${draftHash}${sameAsPublished ? ' · 与当前发布版本相同' : ''}`">
              <UInput v-model="body" multiline :rows="14" :disabled="!canEdit" />
            </UField>
          </div>
        </template>
        <template v-else-if="data?.published">
          <div class="doc">
            <h3 class="t-headline">{{ data.published.title }}</h3>
            <p v-for="(para, i) in data.published.body.split('\n\n')" :key="i" class="para">{{ para }}</p>
          </div>
        </template>
        <UEmpty v-else icon="doc" title="尚未发布任何版本" description="创建草稿并发布后，小程序才会展示该协议" compact />

        <div class="actions">
          <template v-if="editing && canEdit">
            <UButton variant="ghost" @click="discard">放弃草稿</UButton>
            <span class="grow" />
            <UButton icon="eye" @click="openPreview()">预览</UButton>
            <UButton :disabled="!dirty" :loading="saving" @click="save">保存草稿</UButton>
            <UButton variant="primary" :disabled="sameAsPublished || !title.trim() || !body.trim()" @click="publish">发布</UButton>
          </template>
          <template v-else-if="canEdit">
            <span class="grow" />
            <UButton variant="primary" icon="edit" @click="startDraft">{{ data?.published ? '基于当前版本修改' : '创建草稿' }}</UButton>
          </template>
          <span v-else class="t-foot c-3">当前身份只能查看协议</span>
        </div>
      </UCard>

      <UCard title="版本历史" :subtitle="data?.published ? `当前 v${data.published.version} 被 ${data.ordersUsing} 个演示订单引用` : ''" padding="none">
        <div class="versions">
          <p v-if="data && !data.versions.length" class="empty-line">暂无版本</p>
          <button v-for="v in data?.versions ?? []" :key="v.id" type="button" class="ver" @click="openPreview(v)">
            <span class="v-no num">v{{ v.version }}</span>
            <div class="grow stack gap-4">
              <span class="v-title">{{ v.title }}</span>
              <span class="t-caption c-3 num">{{ formatDateTime(v.publishedAt) }} · {{ v.publisherName }}</span>
              <span class="t-caption c-4 mono">{{ v.contentHash }}</span>
            </div>
            <UBadge :tone="v.status === 'PUBLISHED' ? 'success' : 'muted'">{{ v.status === 'PUBLISHED' ? '生效中' : '已归档' }}</UBadge>
          </button>
        </div>
      </UCard>
    </div>

    <UModal v-model:open="previewOpen" :title="viewing ? `v${viewing.version} · 只读` : '预览 · 未发布草稿'" :width="520">
      <div class="phone">
        <div class="phone-bar">{{ previewDoc.title }}</div>
        <div class="phone-body">
          <p v-for="(para, i) in previewDoc.body.split('\n\n')" :key="i" class="para">{{ para }}</p>
        </div>
        <div class="phone-foot">
          <span class="fake-check" />
          <span class="t-foot">我已阅读并确认（默认不勾选）</span>
        </div>
      </div>
      <p class="t-caption c-3 mono">{{ previewDoc.contentHash }}</p>
      <template #footer><UButton @click="previewOpen = false">关闭</UButton></template>
    </UModal>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
.actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--separator); }
.doc { display: flex; flex-direction: column; gap: 12px; max-width: 680px; }
.para { font-size: 15px; line-height: 24px; color: var(--label); white-space: pre-line; }
.versions { padding: 0 8px 8px; }
.ver { display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 14px 12px; border: 0; border-radius: 12px; background: transparent; text-align: left; }
.ver:hover { background: var(--fill-2); }
.v-no { font-size: 13px; font-weight: 600; color: var(--label-2); width: 28px; padding-top: 1px; }
.v-title { font-size: 15px; }
.empty-line { padding: 16px; color: var(--label-3); font-size: 13px; }
.phone { border-radius: 24px; background: var(--bg); overflow: hidden; box-shadow: inset 0 0 0 1px var(--separator); }
.phone-bar { padding: 14px 16px; text-align: center; font-size: 15px; font-weight: 600; background: var(--glass); border-bottom: 1px solid var(--separator); }
.phone-body { max-height: 46vh; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--surface); margin: 12px; border-radius: 16px; }
.phone-foot { display: flex; align-items: center; gap: 8px; padding: 0 16px 16px; }
.fake-check { width: 18px; height: 18px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--label-4); }
@media (max-width: 1023px) { .layout { grid-template-columns: minmax(0, 1fr); } }
</style>
