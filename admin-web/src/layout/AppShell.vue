<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ROLE_LABEL } from '@/contracts'
import type { Permission } from '@/domain/permissions'
import { can, loadSession, session } from '@/composables/session'
import { dataVersion } from '@/composables/signal'
import { getOverview } from '@/services/dashboard'
import { UEmpty, USkeleton } from '@/components/ui'
import UToastHost from '@/components/ui/UToastHost.vue'
import UConfirmHost from '@/components/ui/UConfirmHost.vue'
import SideBar from './SideBar.vue'
import TopBar from './TopBar.vue'
import CommandPalette from './CommandPalette.vue'

const route = useRoute()
const collapsed = ref(localStorage.getItem('hugong-sidebar') === 'collapsed')
const mobileOpen = ref(false)
const paletteOpen = ref(false)
const badges = ref<Record<string, number>>({})

watch(collapsed, (v) => localStorage.setItem('hugong-sidebar', v ? 'collapsed' : 'expanded'))
watch(() => route.fullPath, () => {
  mobileOpen.value = false
  void refreshBadges()
})

const roleText = computed(() => (session.admin?.roles ?? []).map((r) => ROLE_LABEL[r]).join('、'))
const allowed = computed(() => {
  const perm = route.meta.perm as Permission | undefined
  return !perm || can(perm)
})

async function refreshBadges() {
  if (!session.admin) return
  const r = await getOverview()
  if (r.ok) {
    badges.value = {
      orders: r.data.kpis.pendingConfirm,
      dispatch: r.data.kpis.needDispatch,
      payments: can('payment.view') ? r.data.kpis.refundTodo : 0,
    }
  }
}

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  await loadSession()
  void refreshBadges()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
watch(() => session.epoch, () => void refreshBadges())
watch(dataVersion, () => void refreshBadges())
</script>

<template>
  <div class="shell" :class="{ collapsed }">
    <SideBar v-model:collapsed="collapsed" v-model:mobile-open="mobileOpen" :badges="badges" />
    <div class="main">
      <TopBar @menu="mobileOpen = true" @search="paletteOpen = true" />
      <main class="content">
        <template v-if="!session.ready">
          <div class="stack gap-16 boot">
            <USkeleton width="220px" height="34px" radius="10px" />
            <USkeleton height="120px" radius="20px" />
            <USkeleton height="320px" radius="20px" />
          </div>
        </template>
        <template v-else-if="!allowed">
          <div class="forbidden">
            <UEmpty
              icon="lock"
              title="没有访问权限"
              :description="`当前身份为「${roleText}」，无法查看此页面。可在右上角切换演示身份。`"
            />
          </div>
        </template>
        <RouterView v-else v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="`${route.name as string}-${session.epoch}`" />
          </Transition>
        </RouterView>
      </main>
    </div>
    <CommandPalette v-model:open="paletteOpen" />
    <UToastHost />
    <UConfirmHost />
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; }
.main { margin-left: var(--sidebar-w); min-width: 0; transition: margin-left 300ms var(--ease); }
.collapsed .main { margin-left: var(--sidebar-w-collapsed); }
.content { max-width: 1320px; margin: 0 auto; padding: 24px 40px 40px; }
.boot { padding-top: 16px; }
.forbidden { background: var(--surface); border-radius: var(--radius-card); margin-top: 24px; }
.page-enter-active, .page-leave-active { transition: opacity 200ms var(--ease), transform 200ms var(--ease); }
.page-enter-from { opacity: 0; transform: translateY(4px); }
.page-leave-to { opacity: 0; }
@media (max-width: 1023px) {
  .content { padding: 20px 24px 32px; }
}
@media (max-width: 767px) {
  .main, .collapsed .main { margin-left: 0; }
  .content { padding: 16px 16px 32px; }
}
</style>
