<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ALL_ROLES, ROLE_LABEL, type Role } from '@/contracts'
import { PERMISSION_GROUPS, ROLE_PERMISSIONS, type Permission } from '@/domain/permissions'
import { formatDateTime } from '@/domain/time'
import { callApi, useResource } from '@/composables/api'
import { confirmDialog } from '@/composables/confirm'
import { can, loadSession, session } from '@/composables/session'
import { toast } from '@/composables/toast'
import { failNextRequest, resetDemoData } from '@/services/session'
import { getSettings, listAdmins, listAuditLogs, listHospitalOptions, saveAdmin, saveSettings, type AdminRow, type SettingsInput } from '@/services/settings'
import { UBadge, UButton, UCard, UCheckbox, UField, UInput, UModal, UPageHeader, USegmented, USelect, USkeleton, USwitch, UTable, UEmpty, Icon, type Column } from '@/components/ui'

const tab = ref('basic')
const canEdit = computed(() => can('settings.edit'))
const tabs = computed(() => [
  { value: 'basic', label: '基本信息' },
  { value: 'rules', label: '预约规则' },
  { value: 'roles', label: '角色与账号' },
  ...(can('audit.view') ? [{ value: 'logs', label: '操作日志' }] : []),
  ...(can('demo.tools') ? [{ value: 'demo', label: '演示工具' }] : []),
])

// ---------- 设置 ----------
const settings = useResource(getSettings)
const form = reactive<SettingsInput>({
  providerName: '', providerAddress: '', providerLicense: '', supportPhone: '', supportHours: '', businessHoursEnabled: false,
  businessStart: '07:00', businessEnd: '22:00', leadTimeMinutes: 120, paymentDeadlineMinutes: 30, pauseOrders: false, pauseNotice: '',
})
const leadText = ref('')
const deadlineText = ref('')
watch(() => settings.data.value, (s) => {
  if (!s) return
  const { updatedAt: _u, ...rest } = s
  Object.assign(form, rest)
  leadText.value = String(s.leadTimeMinutes)
  deadlineText.value = String(s.paymentDeadlineMinutes)
})
const saving = ref(false)
async function save() {
  saving.value = true
  const r = await callApi(saveSettings({ ...form, leadTimeMinutes: Number(leadText.value), paymentDeadlineMinutes: Number(deadlineText.value) }), '设置已保存')
  saving.value = false
  if (r) await settings.reload()
}

// ---------- 账号 ----------
const admins = useResource(listAdmins)
const hospitals = useResource(listHospitalOptions)
const adminCols: Column[] = [
  { key: 'name', label: '账号', primary: true },
  { key: 'roles', label: '角色' },
  { key: 'scope', label: '医院范围' },
  { key: 'enabled', label: '状态', align: 'right' },
  { key: 'ops', label: '', align: 'right' },
]
const editOpen = ref(false)
const editing = ref<AdminRow | null>(null)
const editForm = reactive({ roles: [] as Role[], all: true, hospitalIds: [] as string[], enabled: true, reason: '' })
const editSaving = ref(false)
function editAdmin(a: AdminRow) {
  editing.value = a
  Object.assign(editForm, {
    roles: [...a.roles], all: a.allowedHospitalIds === '*', hospitalIds: a.allowedHospitalIds === '*' ? [] : [...a.allowedHospitalIds], enabled: a.enabled, reason: '',
  })
  editOpen.value = true
}
function toggleRole(r: Role, on: boolean) {
  editForm.roles = on ? [...new Set([...editForm.roles, r])] : editForm.roles.filter((x) => x !== r)
}
function toggleHosp(id: string, on: boolean) {
  editForm.hospitalIds = on ? [...new Set([...editForm.hospitalIds, id])] : editForm.hospitalIds.filter((x) => x !== id)
}
async function submitAdmin() {
  if (!editing.value) return
  editSaving.value = true
  const r = await callApi(
    saveAdmin(editing.value.id, { roles: editForm.roles, allowedHospitalIds: editForm.all ? '*' : editForm.hospitalIds, enabled: editForm.enabled, reason: editForm.reason }),
    '权限已更新并记录日志',
  )
  editSaving.value = false
  if (r) {
    editOpen.value = false
    await admins.reload()
    await loadSession()
  }
}
const matrix = computed(() => ALL_ROLES.map((r) => ({ role: r, has: (p: Permission) => ROLE_PERMISSIONS[r].includes(p) })))
const PERM_LABEL: Partial<Record<Permission, string>> = {
  'catalog.edit': '目录维护', 'package.edit': '套餐与价格', 'order.operate': '订单处理', 'dispatch.assign': '派单', 'caregiver.edit': '护工维护',
  'payment.view': '支付流水', 'refund.approve': '退款审核', 'refund.execute': '退款执行', 'patient.view': '就诊人', 'patient.reveal': '查看完整',
  'patient.export': '导出', 'message.send': '发通知', 'agreement.publish': '发布协议', 'settings.edit': '系统设置', 'admin.manage': '账号权限', 'audit.view': '操作日志',
}

// ---------- 日志 ----------
const logKeyword = ref('')
const logAction = ref('')
const logs = useResource(() => listAuditLogs({ keyword: logKeyword.value, action: logAction.value }), { immediate: false })
let lt = 0
watch([logKeyword, logAction], () => {
  window.clearTimeout(lt)
  lt = window.setTimeout(() => void logs.reload(), 200)
})
watch(tab, (v) => { if (v === 'logs') void logs.reload() })
const logCols: Column[] = [
  { key: 'time', label: '时间', width: '150px' },
  { key: 'actor', label: '操作者' },
  { key: 'summary', label: '内容', primary: true },
  { key: 'reason', label: '原因', hideOnMobile: true },
]
const actionOptions = [
  { label: '订单', value: 'order' }, { label: '退款', value: 'refund' }, { label: '就诊人查看', value: 'patient' }, { label: '派单', value: 'dispatch' },
  { label: '目录', value: 'catalog' }, { label: '套餐', value: 'package' }, { label: '协议', value: 'agreement' }, { label: '消息', value: 'message' },
  { label: '权限', value: 'admin' }, { label: '设置', value: 'settings' },
]

// ---------- 演示工具 ----------
async function reset() {
  const c = await confirmDialog({ title: '重置演示数据', message: '清空本浏览器中的所有演示改动，并以当前时间重新生成虚构数据。', confirmText: '重置', destructive: true })
  if (!c.ok) return
  const r = await resetDemoData()
  if (r.ok) {
    toast('演示数据已重置', { tone: 'success' })
    await loadSession()
    session.epoch += 1
  }
}
function simulateFail() {
  failNextRequest()
  toast('下一次请求将模拟网络异常', { message: '切换到任一页面查看错误状态与重试。' })
}
</script>

<template>
  <div class="page">
    <UPageHeader title="系统设置" subtitle="营业规则由公司决定，页面与后端执行同一规则。权限变更、敏感操作均记录操作者、时间、对象与原因。">
      <UButton v-if="(tab === 'basic' || tab === 'rules') && canEdit" variant="primary" :loading="saving" @click="save">保存</UButton>
    </UPageHeader>
    <USegmented v-model="tab" :options="tabs" />

    <template v-if="tab === 'basic' || tab === 'rules'">
      <div v-if="settings.loading.value && !settings.data.value" class="stack gap-16"><USkeleton height="240px" radius="20px" /></div>
      <UCard v-else-if="settings.error.value" padding="none">
        <UEmpty tone="danger" icon="alert" title="加载失败" :description="settings.error.value.message"><UButton size="sm" @click="settings.reload">重试</UButton></UEmpty>
      </UCard>
      <template v-else-if="tab === 'basic'">
        <UCard title="服务提供方" subtitle="展示在小程序知情说明与订单详情中">
          <div class="grid-2">
            <UField label="名称" required class="span-2"><UInput v-model="form.providerName" :disabled="!canEdit" /></UField>
            <UField label="地址"><UInput v-model="form.providerAddress" :disabled="!canEdit" /></UField>
            <UField label="营业执照号"><UInput v-model="form.providerLicense" :disabled="!canEdit" /></UField>
          </div>
        </UCard>
        <UCard title="客服">
          <div class="grid-2">
            <UField label="客服电话" required><UInput v-model="form.supportPhone" inputmode="tel" :disabled="!canEdit" /></UField>
            <UField label="服务时间"><UInput v-model="form.supportHours" :disabled="!canEdit" /></UField>
          </div>
        </UCard>
      </template>
      <template v-else>
        <UCard title="营业时间" subtitle="不默认照搬夜间禁止下单，是否启用由公司决定">
          <div class="setting-row">
            <div class="stack gap-4 grow"><span>限制下单时段</span><span class="t-foot c-3">关闭时全天可提交预约，仍需人工确认</span></div>
            <USwitch v-model="form.businessHoursEnabled" :disabled="!canEdit" label="限制下单时段" @change="(v) => (form.businessHoursEnabled = v)" />
          </div>
          <div v-if="form.businessHoursEnabled" class="grid-2 pad-top">
            <UField label="开始"><UInput v-model="form.businessStart" type="time" :disabled="!canEdit" /></UField>
            <UField label="结束"><UInput v-model="form.businessEnd" type="time" :disabled="!canEdit" /></UField>
          </div>
        </UCard>
        <UCard title="预约与付款">
          <div class="grid-2">
            <UField label="最短预约提前量" hint="到岗时间至少晚于提交时间"><UInput v-model="leadText" suffix="分钟" inputmode="numeric" :disabled="!canEdit" /></UField>
            <UField label="付款期限" hint="确认后开放付款的时长；到期前须与渠道核对"><UInput v-model="deadlineText" suffix="分钟" inputmode="numeric" :disabled="!canEdit" /></UField>
          </div>
        </UCard>
        <UCard title="临时停单">
          <div class="setting-row">
            <div class="stack gap-4 grow"><span>暂停接收新预约</span><span class="t-foot c-3">已有订单不受影响</span></div>
            <USwitch v-model="form.pauseOrders" :disabled="!canEdit" label="临时停单" @change="(v) => (form.pauseOrders = v)" />
          </div>
          <UField v-if="form.pauseOrders" label="对用户的提示" required class="pad-top">
            <UInput v-model="form.pauseNotice" :maxlength="60" placeholder="例如：系统维护中，预计 18:00 恢复" :disabled="!canEdit" />
          </UField>
        </UCard>
        <p class="t-foot c-3 note">计费单位、取消扣费与夜间加价等规则尚未确认，演示环境不启用自动加价或自动扣款。</p>
      </template>
    </template>

    <template v-else-if="tab === 'roles'">
      <UCard padding="none" title="管理员账号" subtitle="同一员工可拥有多个角色；医院范围由服务端校验">
        <UTable :columns="adminCols" :rows="admins.data.value ?? []" :loading="admins.loading.value" :error="admins.error.value" @retry="admins.reload">
          <template #cell-name="{ row }">
            <div class="stack gap-4">
              <span class="strong">{{ row.name }}<UBadge v-if="row.id === session.admin?.id" tone="accent" class="me">当前</UBadge></span>
              <span class="t-foot c-3">{{ row.account }}</span>
            </div>
          </template>
          <template #cell-roles="{ row }">
            <div class="row gap-4 wrap roles"><UBadge v-for="r in row.roles" :key="r">{{ ROLE_LABEL[r] }}</UBadge></div>
          </template>
          <template #cell-scope="{ row }"><span class="t-foot c-2">{{ row.hospitalNames.join('、') }}</span></template>
          <template #cell-enabled="{ row }"><UBadge :tone="row.enabled ? 'success' : 'muted'" dot>{{ row.enabled ? '启用' : '停用' }}</UBadge></template>
          <template #cell-ops="{ row }">
            <UButton v-if="can('admin.manage')" size="sm" variant="ghost" icon-only icon="edit" title="编辑权限" @click="editAdmin(row)" />
          </template>
        </UTable>
      </UCard>
      <UCard title="角色权限" subtitle="只读概览；服务端以此为准，前端仅用于显示入口">
        <div class="matrix-wrap">
          <table class="matrix">
            <thead>
              <tr>
                <th />
                <template v-for="g in PERMISSION_GROUPS" :key="g.label">
                  <th v-for="p in g.perms" :key="p">{{ PERM_LABEL[p] }}</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in matrix" :key="m.role">
                <th>{{ ROLE_LABEL[m.role] }}</th>
                <template v-for="g in PERMISSION_GROUPS" :key="g.label">
                  <td v-for="p in g.perms" :key="p"><Icon v-if="m.has(p)" name="check" :size="14" :stroke="2" /><span v-else class="c-4">·</span></td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>

    <template v-else-if="tab === 'logs'">
      <div class="toolbar">
        <UInput v-model="logKeyword" class="grow" icon="search" placeholder="搜索操作者、对象、内容或原因" clearable />
        <USelect v-model="logAction" class="sel" placeholder="全部类型" :options="actionOptions" />
      </div>
      <UCard padding="none">
        <UTable :columns="logCols" :rows="logs.data.value ?? []" :loading="logs.loading.value" :error="logs.error.value" empty-icon="history" empty-title="没有匹配的日志" dense @retry="logs.reload">
          <template #cell-time="{ row }"><span class="num t-foot c-2 nowrap">{{ formatDateTime(row.createdAt) }}</span></template>
          <template #cell-actor="{ row }"><span class="nowrap">{{ row.actorName }}</span></template>
          <template #cell-summary="{ row }">
            <div class="stack gap-4">
              <span>{{ row.summary }}</span>
              <span class="t-caption c-3"><span class="mono">{{ row.action }}</span> · {{ row.targetType }} {{ row.targetId }}</span>
            </div>
          </template>
          <template #cell-reason="{ row }"><span class="t-foot" :class="row.reason ? 'c-2' : 'c-4'">{{ row.reason ?? '—' }}</span></template>
        </UTable>
      </UCard>
      <p class="t-foot c-3 note">日志不记录完整身份证、电话和健康评估内容。演示环境最多显示最近 200 条。</p>
    </template>

    <template v-else-if="tab === 'demo'">
      <UCard title="演示工具" subtitle="仅存在于无云原型；生产构建不得包含模拟支付、模拟管理员与这些工具">
        <div class="setting-row">
          <div class="stack gap-4 grow"><span>重置演示数据</span><span class="t-foot c-3">数据保存在本浏览器 localStorage，与小程序演示数据不同步</span></div>
          <UButton variant="danger" icon="refresh" @click="reset">重置</UButton>
        </div>
        <div class="setting-row">
          <div class="stack gap-4 grow"><span>模拟一次网络异常</span><span class="t-foot c-3">下一次请求返回 NETWORK_ERROR，用于查看错误与重试状态</span></div>
          <UButton @click="simulateFail">模拟</UButton>
        </div>
      </UCard>
    </template>

    <UModal v-model:open="editOpen" :title="`编辑权限：${editing?.name ?? ''}`" description="权限变更会记录操作者、时间、对象与原因。" :width="500">
      <UField label="角色" required>
        <div class="row gap-20 wrap">
          <UCheckbox v-for="r in ALL_ROLES" :key="r" :model-value="editForm.roles.includes(r)" @update:model-value="(v: boolean) => toggleRole(r, v)">{{ ROLE_LABEL[r] }}</UCheckbox>
        </div>
      </UField>
      <UField label="医院范围" required>
        <div class="stack gap-8">
          <UCheckbox v-model="editForm.all">全部医院</UCheckbox>
          <div v-if="!editForm.all" class="stack gap-8 indent">
            <UCheckbox v-for="h in hospitals.data.value ?? []" :key="h.id" :model-value="editForm.hospitalIds.includes(h.id)" @update:model-value="(v: boolean) => toggleHosp(h.id, v)">{{ h.name }}</UCheckbox>
          </div>
        </div>
      </UField>
      <div class="setting-row tight">
        <span class="grow">启用账号</span>
        <USwitch v-model="editForm.enabled" label="启用账号" @change="(v) => (editForm.enabled = v)" />
      </div>
      <UField label="变更原因" required><UInput v-model="editForm.reason" :maxlength="200" placeholder="例如：岗位调整" /></UField>
      <template #footer>
        <UButton @click="editOpen = false">取消</UButton>
        <UButton variant="primary" :loading="editSaving" :disabled="!editForm.reason.trim() || !editForm.roles.length" @click="submitAdmin">保存</UButton>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.span-2 { grid-column: span 2; }
.pad-top { padding-top: 16px; }
.setting-row { display: flex; align-items: center; gap: 16px; min-height: 56px; padding: 8px 0; border-bottom: 1px solid var(--separator); font-size: 15px; }
.setting-row:last-child { border-bottom: 0; }
.setting-row.tight { border: 0; min-height: 40px; }
.note { padding: 0 4px; margin-top: -16px; }
.sel { width: 160px; }
.strong { font-weight: 500; }
.me { margin-left: 8px; }
.roles { justify-content: flex-start; }
.indent { padding-left: 30px; }
.matrix-wrap { overflow-x: auto; }
.matrix { border-collapse: collapse; font-size: 13px; width: 100%; }
.matrix th, .matrix td { padding: 10px 8px; border-bottom: 1px solid var(--separator); text-align: center; white-space: nowrap; }
.matrix thead th { font-size: 12px; font-weight: 500; color: var(--label-3); }
.matrix tbody th { text-align: left; font-weight: 500; padding-left: 0; }
.matrix tbody tr:last-child th, .matrix tbody tr:last-child td { border-bottom: 0; }
.matrix td :deep(svg) { margin: 0 auto; }
@media (max-width: 767px) {
  .grid-2 { grid-template-columns: 1fr; }
  .span-2 { grid-column: auto; }
  .roles { justify-content: flex-end; }
}
</style>
