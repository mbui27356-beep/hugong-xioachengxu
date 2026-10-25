<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BUSINESS_STATUS_LABEL } from '@/contracts'
import { NAV_ITEMS } from '@/nav'
import { can } from '@/composables/session'
import { searchOrders, type OrderRow } from '@/services/orders'
import { formatShort } from '@/domain/time'
import Icon from '@/components/icons/Icon.vue'
import type { IconName } from '@/components/icons/paths'

const open = defineModel<boolean>('open', { default: false })
const router = useRouter()
const q = ref('')
const orders = ref<OrderRow[]>([])
const active = ref(0)
const input = ref<HTMLInputElement | null>(null)
let timer = 0

interface Result {
  key: string
  icon: IconName
  title: string
  meta: string
  go: () => void
}

const results = computed<Result[]>(() => {
  const kw = q.value.trim().toLowerCase()
  const pages = NAV_ITEMS.filter((n) => can(n.perm))
    .filter((n) => !kw || n.title.includes(kw) || (n.keywords ?? '').includes(kw) || n.path.includes(kw))
    .map((n) => ({ key: n.path, icon: n.icon, title: n.title, meta: '页面', go: () => router.push(n.path) }))
  const os = orders.value.map((o) => ({
    key: o.id,
    icon: 'orders' as IconName,
    title: `${o.orderNo} · ${o.patientName}`,
    meta: `${BUSINESS_STATUS_LABEL[o.businessStatus]} · ${o.campusName} · ${formatShort(o.startAt)}`,
    go: () => router.push({ path: '/orders', query: { id: o.id } }),
  }))
  return [...os, ...pages]
})

watch(q, (v) => {
  active.value = 0
  window.clearTimeout(timer)
  if (!can('order.view') || v.trim().length < 2) {
    orders.value = []
    return
  }
  timer = window.setTimeout(async () => {
    const r = await searchOrders(v)
    orders.value = r.ok ? r.data : []
  }, 180)
})

watch(open, async (v) => {
  if (v) {
    q.value = ''
    orders.value = []
    active.value = 0
    await nextTick()
    input.value?.focus()
  }
})

function run(r: Result | undefined) {
  if (!r) return
  r.go()
  open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = Math.min(active.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    run(results.value[active.value])
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cmd">
      <div v-if="open" class="layer" @mousedown.self="open = false">
        <div class="palette" role="dialog" aria-label="搜索">
          <div class="bar">
            <Icon name="search" :size="18" class="c-3" />
            <input ref="input" v-model="q" placeholder="输入订单号、就诊人姓名或页面名称" @keydown="onKey" />
            <kbd class="esc">esc</kbd>
          </div>
          <div class="list">
            <p v-if="results.length === 0" class="none">没有匹配结果</p>
            <button
              v-for="(r, i) in results"
              :key="r.key"
              type="button"
              class="res"
              :class="{ active: i === active }"
              @mouseenter="active = i"
              @click="run(r)"
            >
              <Icon :name="r.icon" :size="17" class="c-2" />
              <span class="grow ellipsis">{{ r.title }}</span>
              <span class="meta">{{ r.meta }}</span>
            </button>
          </div>
          <p class="hint">↑ ↓ 选择 · ↵ 打开 · 搜索仅覆盖当前身份可见的数据</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.layer { position: fixed; inset: 0; z-index: 90; background: rgba(0, 0, 0, 0.18); display: flex; justify-content: center; padding: 12vh 16px 16px; }
.palette {
  width: min(600px, 100%); max-height: 70vh; display: flex; flex-direction: column; overflow: hidden;
  background: rgba(255, 255, 255, 0.9); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
  border-radius: 18px; box-shadow: var(--shadow-pop); align-self: flex-start;
}
.bar { display: flex; align-items: center; gap: 12px; padding: 0 16px; height: 56px; border-bottom: 1px solid var(--separator); }
.bar input { flex: 1; border: 0; background: transparent; outline: none; font-size: 17px; }
.bar input:focus-visible { box-shadow: none; }
.esc { font-family: var(--font); font-size: 11px; color: var(--label-3); background: var(--fill); padding: 2px 6px; border-radius: 6px; }
.list { overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 2px; }
.res { display: flex; align-items: center; gap: 12px; height: 44px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; text-align: left; font-size: 15px; }
.res.active { background: var(--fill); }
.meta { font-size: 12px; color: var(--label-3); white-space: nowrap; }
.none { padding: 24px; text-align: center; color: var(--label-3); font-size: 13px; }
.hint { padding: 10px 16px; font-size: 12px; color: var(--label-3); border-top: 1px solid var(--separator); }
.cmd-enter-active, .cmd-leave-active { transition: opacity 180ms var(--ease); }
.cmd-enter-active .palette, .cmd-leave-active .palette { transition: transform 220ms var(--ease); }
.cmd-enter-from, .cmd-leave-to { opacity: 0; }
.cmd-enter-from .palette, .cmd-leave-to .palette { transform: scale(0.98) translateY(-6px); }
@media (max-width: 767px) {
  .layer { padding-top: 12px; }
  .meta { display: none; }
}
</style>
