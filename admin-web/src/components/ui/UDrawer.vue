<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import Icon from '../icons/Icon.vue'

const open = defineModel<boolean>('open', { default: false })
withDefaults(defineProps<{ title?: string; subtitle?: string; width?: number }>(), { width: 600 })
const emit = defineEmits<{ close: [] }>()

function close() {
  open.value = false
  emit('close')
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value && !document.querySelector('.modal-layer')) close()
}
watch(open, (v) => {
  if (v) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
}, { immediate: true })
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="drawer-layer" @mousedown.self="close">
        <aside class="panel" role="dialog" aria-modal="true" :aria-label="title" :style="{ '--w': `${width}px` }">
          <header class="head">
            <div class="titles">
              <slot name="title"><h2 class="t-title2">{{ title }}</h2></slot>
              <p v-if="subtitle" class="t-foot c-2">{{ subtitle }}</p>
              <slot name="meta" />
            </div>
            <button class="x" type="button" aria-label="关闭" @click="close"><Icon name="close" :size="16" /></button>
          </header>
          <div class="body"><slot /></div>
          <footer v-if="$slots.footer" class="foot"><slot name="footer" /></footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-layer { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.18); display: flex; justify-content: flex-end; }
.panel {
  width: min(var(--w), 100vw - 16px); height: calc(100% - 16px); margin: 8px;
  background: var(--bg); border-radius: var(--radius-card); box-shadow: var(--shadow-pop);
  display: flex; flex-direction: column; overflow: hidden;
}
.head {
  display: flex; align-items: flex-start; gap: 12px; padding: 20px 20px 16px 24px;
  background: var(--glass); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
  border-bottom: 1px solid var(--separator);
}
.titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.x { width: 30px; height: 30px; border-radius: 50%; border: 0; background: var(--fill); color: var(--label-2); display: grid; place-items: center; flex: none; }
.x:hover { background: var(--fill-hover); color: var(--label); }
.x:focus-visible { border-radius: 50%; }
.body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
.foot {
  display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; padding: 14px 20px;
  background: var(--glass); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
  border-top: 1px solid var(--separator);
}
.drawer-enter-active, .drawer-leave-active { transition: opacity 260ms var(--ease); }
.drawer-enter-active .panel, .drawer-leave-active .panel { transition: transform 300ms var(--ease); }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .panel, .drawer-leave-to .panel { transform: translateX(24px); }
@media (max-width: 767px) {
  .drawer-layer { align-items: flex-end; }
  .panel { width: 100%; height: calc(100% - 24px); margin: 0; border-radius: 20px 20px 0 0; }
  .head { padding: 16px 16px 12px; }
  .body { padding: 16px 12px; }
  .foot { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }
  .drawer-enter-from .panel, .drawer-leave-to .panel { transform: translateY(32px); }
}
</style>
