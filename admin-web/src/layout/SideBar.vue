<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { NAV } from '@/nav'
import { can } from '@/composables/session'
import Icon from '@/components/icons/Icon.vue'

const collapsed = defineModel<boolean>('collapsed', { default: false })
const mobileOpen = defineModel<boolean>('mobileOpen', { default: false })
defineProps<{ badges: Record<string, number> }>()
const route = useRoute()

const groups = computed(() =>
  NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) })).filter((g) => g.items.length > 0),
)
</script>

<template>
  <Transition name="fade">
    <div v-if="mobileOpen" class="scrim" @click="mobileOpen = false" />
  </Transition>
  <aside class="sidebar" :class="{ collapsed, open: mobileOpen }" aria-label="主导航">
    <div class="brand">
      <div class="mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round">
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
        </svg>
      </div>
      <div class="brand-text">
        <p class="name">陪护管理</p>
        <p class="sub">宜昌 · 演示环境</p>
      </div>
      <button class="close-m" type="button" aria-label="关闭菜单" @click="mobileOpen = false"><Icon name="close" :size="16" /></button>
    </div>

    <nav class="nav">
      <div v-for="g in groups" :key="g.label" class="group">
        <p class="group-label">{{ g.label }}</p>
        <RouterLink
          v-for="item in g.items"
          :key="item.path"
          :to="item.path"
          class="item"
          :class="{ active: route.path.startsWith(item.path) }"
          :title="collapsed ? item.title : undefined"
        >
          <Icon :name="item.icon" :size="18" class="ic" />
          <span class="text">{{ item.title }}</span>
          <span v-if="badges[item.name]" class="count num">{{ badges[item.name] }}</span>
          <span v-if="badges[item.name] && collapsed" class="pip" aria-hidden="true" />
        </RouterLink>
      </div>
    </nav>

    <div class="foot">
      <button class="collapse" type="button" :aria-label="collapsed ? '展开侧栏' : '收起侧栏'" :title="collapsed ? '展开侧栏' : '收起侧栏'" @click="collapsed = !collapsed">
        <Icon name="sidebar" :size="18" />
        <span class="text">收起侧栏</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed; inset: 0 auto 0 0; z-index: 40; width: var(--sidebar-w);
  display: flex; flex-direction: column;
  background: rgba(245, 245, 247, 0.72); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
  border-right: 1px solid var(--separator);
  transition: width 300ms var(--ease), transform 300ms var(--ease);
  overflow: hidden;
}
.brand { display: flex; align-items: center; gap: 10px; height: 64px; padding: 0 20px; flex: none; }
.mark { width: 28px; height: 28px; border-radius: 8px; background: var(--label); display: grid; place-items: center; flex: none; }
.brand-text { min-width: 0; white-space: nowrap; transition: opacity 200ms var(--ease); }
.name { font-size: 15px; line-height: 18px; font-weight: 600; letter-spacing: -0.2px; }
.sub { font-size: 12px; line-height: 16px; color: var(--label-3); }
.close-m { display: none; margin-left: auto; width: 30px; height: 30px; border: 0; border-radius: 50%; background: var(--fill); color: var(--label-2); place-items: center; }

.nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 20px; }
.group { display: flex; flex-direction: column; gap: 2px; }
.group-label {
  font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.2px; color: var(--label-3);
  padding: 0 10px 6px; white-space: nowrap; transition: opacity 200ms var(--ease);
}
.item {
  position: relative; display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px;
  border-radius: 10px; color: var(--label); font-size: 15px; text-decoration: none; white-space: nowrap;
  transition: background-color 150ms var(--ease);
}
.item:hover { background: rgba(0, 0, 0, 0.04); text-decoration: none; }
.item.active { background: rgba(0, 0, 0, 0.07); font-weight: 600; }
.item:focus-visible { border-radius: 10px; }
.ic { color: var(--label-2); }
.item.active .ic { color: var(--label); }
.text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; transition: opacity 200ms var(--ease); }
.count { font-size: 12px; font-weight: 500; color: var(--label-2); min-width: 20px; text-align: right; }
.pip { position: absolute; top: 7px; left: 30px; width: 6px; height: 6px; border-radius: 50%; background: var(--label); }

.foot { padding: 12px; border-top: 1px solid var(--separator); flex: none; }
.collapse {
  display: flex; align-items: center; gap: 10px; width: 100%; height: 36px; padding: 0 10px;
  border: 0; border-radius: 10px; background: transparent; color: var(--label-2); font-size: 13px; white-space: nowrap;
}
.collapse .text { text-align: left; }
.collapse:hover { background: rgba(0, 0, 0, 0.04); color: var(--label); }

.collapsed { width: var(--sidebar-w-collapsed); }
.collapsed .brand { padding: 0 22px; }
.collapsed .brand-text, .collapsed .text, .collapsed .count { opacity: 0; pointer-events: none; }
.collapsed .group-label { opacity: 0; height: 0; padding: 0; overflow: hidden; }
.collapsed .nav { gap: 12px; padding: 4px 16px 12px; }
.collapsed .item, .collapsed .collapse { padding: 0 9px; }
.collapsed .group + .group { border-top: 1px solid var(--separator); padding-top: 12px; }
.collapsed .foot { padding: 12px 16px; }

.scrim { display: none; }
@media (max-width: 767px) {
  .sidebar, .sidebar.collapsed {
    width: min(300px, 86vw); transform: translateX(-102%); background: rgba(245, 245, 247, 0.94); box-shadow: var(--shadow-pop);
  }
  .sidebar.open { transform: translateX(0); }
  .collapsed .brand-text, .collapsed .text, .collapsed .count { opacity: 1; pointer-events: auto; }
  .collapsed .group-label { opacity: 1; height: auto; padding: 0 10px 6px; }
  .collapsed .group + .group { border-top: 0; padding-top: 0; }
  .collapsed .pip { display: none; }
  .collapsed .brand { padding: 0 20px; }
  .close-m { display: grid; }
  .foot { display: none; }
  .item { height: 44px; }
  .scrim { display: block; position: fixed; inset: 0; z-index: 39; background: rgba(0, 0, 0, 0.2); }
}
.fade-enter-active, .fade-leave-active { transition: opacity 250ms var(--ease); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
