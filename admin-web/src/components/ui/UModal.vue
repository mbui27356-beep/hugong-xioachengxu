<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

const open = defineModel<boolean>('open', { default: false })
withDefaults(defineProps<{ title?: string; description?: string; width?: number; dismissible?: boolean }>(), { width: 440, dismissible: true })
const emit = defineEmits<{ close: [] }>()

function close() {
  open.value = false
  emit('close')
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.stopPropagation()
    close()
  }
}
watch(open, (v) => {
  if (v) window.addEventListener('keydown', onKey, true)
  else window.removeEventListener('keydown', onKey, true)
}, { immediate: true })
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-layer" @mousedown.self="dismissible && close()">
        <div class="dialog" role="dialog" aria-modal="true" :aria-label="title" :style="{ '--w': `${width}px` }">
          <header v-if="title" class="head">
            <h2 class="t-headline">{{ title }}</h2>
            <p v-if="description" class="t-foot c-2">{{ description }}</p>
          </header>
          <div class="body"><slot /></div>
          <footer v-if="$slots.footer" class="foot"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-layer { position: fixed; inset: 0; z-index: 80; background: rgba(0, 0, 0, 0.24); display: grid; place-items: center; padding: 16px; }
.dialog {
  width: min(var(--w), 100%); max-height: calc(100vh - 32px); overflow: auto;
  background: var(--surface); border-radius: var(--radius-card); box-shadow: var(--shadow-pop);
  display: flex; flex-direction: column;
}
.head { padding: 24px 24px 0; display: flex; flex-direction: column; gap: 6px; }
.body { padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; }
.body:empty { display: none; }
.foot { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 24px 24px; }
.modal-enter-active, .modal-leave-active { transition: opacity 220ms var(--ease); }
.modal-enter-active .dialog, .modal-leave-active .dialog { transition: transform 260ms var(--ease); }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .dialog, .modal-leave-to .dialog { transform: scale(0.97); }
@media (max-width: 767px) {
  .foot { flex-direction: column-reverse; }
  .foot :deep(.btn) { width: 100%; height: 44px; }
}
</style>
