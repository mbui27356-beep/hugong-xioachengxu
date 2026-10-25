<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ROLE_LABEL, type Role } from '@/contracts'
import { session, switchTo } from '@/composables/session'
import { toast } from '@/composables/toast'
import Icon from '@/components/icons/Icon.vue'
import UBadge from '@/components/ui/UBadge.vue'

const emit = defineEmits<{ menu: []; search: [] }>()
const open = ref(false)
const switching = ref<string | null>(null)
const root = ref<HTMLElement | null>(null)
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

const initials = computed(() => Array.from(session.admin?.name.replace(/（.*）/, '') ?? '?')[0])
const roleText = computed(() => session.admin?.roles.map((r) => ROLE_LABEL[r]).join('、') ?? '')

function rolesOf(roles: Role[]) {
  return roles.map((r) => ROLE_LABEL[r]).join('、')
}
function scopeText(ids: string[] | '*') {
  return ids === '*' ? '全部医院' : ids.includes('hosp_center') ? '仅中心人民医院' : '仅康复医院（虚构）'
}

async function pick(id: string) {
  if (id === session.admin?.id) {
    open.value = false
    return
  }
  switching.value = id
  await switchTo(id)
  switching.value = null
  open.value = false
  toast(`已切换为 ${session.admin?.name}`, { tone: 'success', message: `角色：${roleText.value}` })
}

function onDoc(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
watch(open, (v) => {
  if (v) {
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
  } else {
    document.removeEventListener('mousedown', onDoc)
    document.removeEventListener('keydown', onKey)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDoc)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <header class="topbar">
    <button class="menu" type="button" aria-label="打开菜单" @click="emit('menu')"><Icon name="menu" :size="20" /></button>
    <button class="search" type="button" @click="emit('search')">
      <Icon name="search" :size="16" />
      <span class="ph">搜索订单号、就诊人或页面</span>
      <kbd class="kbd">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
    </button>
    <div class="right">
      <UBadge tone="warning" class="demo" title="所有数据均为虚构演示数据，未接入真实支付与云服务">演示环境</UBadge>
      <div ref="root" class="who-wrap">
        <button class="who" type="button" :aria-expanded="open" aria-haspopup="menu" @click="open = !open">
          <span class="avatar">{{ initials }}</span>
          <span class="who-text">
            <span class="who-name">{{ session.admin?.name ?? '加载中' }}</span>
            <span class="who-role">{{ roleText }}</span>
          </span>
          <Icon name="chevronDown" :size="14" class="chev" />
        </button>
        <Transition name="pop">
          <div v-if="open" class="pop" role="menu">
            <p class="pop-title">切换演示身份</p>
            <p class="pop-desc">模拟登录，用于验证角色与医院范围。正式环境由服务端认证。</p>
            <div class="pop-list">
              <button
                v-for="a in session.identities"
                :key="a.id"
                type="button"
                role="menuitemradio"
                class="pop-item"
                :aria-checked="a.id === session.admin?.id"
                @click="pick(a.id)"
              >
                <span class="avatar sm">{{ Array.from(a.name)[0] }}</span>
                <span class="grow stack">
                  <span class="pi-name">{{ a.name }}</span>
                  <span class="pi-meta">{{ rolesOf(a.roles) }} · {{ scopeText(a.allowedHospitalIds) }}</span>
                </span>
                <span v-if="switching === a.id" class="spin" />
                <Icon v-else-if="a.id === session.admin?.id" name="check" :size="16" :stroke="2" class="tick" />
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky; top: 0; z-index: 30; height: var(--topbar-h);
  display: flex; align-items: center; gap: 12px; padding: 0 24px 0 40px;
  background: rgba(245, 245, 247, 0.72); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
  border-bottom: 1px solid var(--separator);
}
.menu { display: none; width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; place-items: center; color: var(--label); }
.menu:hover { background: var(--fill-2); }
.search {
  display: flex; align-items: center; gap: 8px; width: min(360px, 40vw); height: 34px; padding: 0 8px 0 12px;
  border: 0; border-radius: 10px; background: var(--fill); color: var(--label-3); text-align: left;
  transition: background-color 200ms var(--ease);
}
.search:hover { background: var(--fill-hover); }
.ph { flex: 1; font-size: 13px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.kbd {
  font-family: var(--font); font-size: 11px; font-weight: 500; color: var(--label-2);
  background: var(--surface); border-radius: 6px; padding: 2px 6px; box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.12);
}
.right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.who-wrap { position: relative; }
.who {
  display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 8px 0 4px; border: 0; border-radius: 999px;
  background: transparent; text-align: left;
}
.who:hover { background: var(--fill-2); }
.who:focus-visible { border-radius: 999px; }
.avatar {
  width: 32px; height: 32px; border-radius: 50%; background: var(--fill); color: var(--label);
  display: grid; place-items: center; font-size: 13px; font-weight: 600; flex: none;
}
.avatar.sm { width: 30px; height: 30px; }
.who-text { display: flex; flex-direction: column; line-height: 16px; }
.who-name { font-size: 13px; font-weight: 600; }
.who-role { font-size: 12px; color: var(--label-3); }
.chev { color: var(--label-3); }
.pop {
  position: absolute; right: 0; top: calc(100% + 8px); width: 340px; padding: 16px 8px 8px;
  background: rgba(255, 255, 255, 0.92); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
  border-radius: 16px; box-shadow: var(--shadow-pop);
}
.pop-title { font-size: 15px; font-weight: 600; padding: 0 12px; }
.pop-desc { font-size: 12px; line-height: 16px; color: var(--label-3); padding: 4px 12px 10px; }
.pop-list { display: flex; flex-direction: column; gap: 2px; }
.pop-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 0; border-radius: 10px;
  background: transparent; text-align: left; width: 100%;
}
.pop-item:hover { background: var(--fill-2); }
.pop-item[aria-checked='true'] { background: rgba(0, 0, 0, 0.04); }
.pi-name { font-size: 15px; line-height: 20px; }
.pi-meta { font-size: 12px; line-height: 16px; color: var(--label-3); }
.tick { color: var(--accent); }
.spin { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--label-3); border-right-color: transparent; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.pop-enter-active, .pop-leave-active { transition: opacity 180ms var(--ease), transform 180ms var(--ease); }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
@media (max-width: 1023px) {
  .topbar { padding: 0 16px 0 24px; }
}
@media (max-width: 767px) {
  .topbar { padding: 0 8px 0 8px; gap: 4px; }
  .menu { display: grid; }
  .search { width: 36px; padding: 0; justify-content: center; background: transparent; color: var(--label); }
  .search .ph, .search .kbd { display: none; }
  .who-text, .chev { display: none; }
  .right { gap: 8px; }
  .pop { position: fixed; left: 8px; right: 8px; top: 60px; width: auto; }
}
</style>
