<script setup lang="ts">
import { toasts } from '@/composables/toast'
import Icon from '../icons/Icon.vue'
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="`t-${t.tone}`" role="status">
          <Icon v-if="t.tone === 'success'" name="check" :size="16" :stroke="2" class="ic ok" />
          <Icon v-else-if="t.tone === 'danger'" name="alert" :size="16" class="ic bad" />
          <Icon v-else-if="t.tone === 'warning'" name="info" :size="16" class="ic warn" />
          <div class="text">
            <p class="title">{{ t.title }}</p>
            <p v-if="t.message" class="msg">{{ t.message }}</p>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 100;
  display: flex; flex-direction: column-reverse; align-items: center; gap: 8px; pointer-events: none;
  width: min(440px, calc(100vw - 32px));
}
.toast {
  display: flex; gap: 10px; align-items: flex-start; padding: 12px 16px; border-radius: 14px;
  background: rgba(29, 29, 31, 0.92); color: #fff; box-shadow: var(--shadow-pop);
  backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur); max-width: 100%; pointer-events: auto;
}
.ic { margin-top: 2px; }
.ok { color: #5fd38a; }
.bad { color: #ff6b7a; }
.warn { color: #ffb44d; }
.title { font-size: 15px; line-height: 20px; font-weight: 500; }
.msg { font-size: 13px; line-height: 18px; color: rgba(255, 255, 255, 0.72); margin-top: 2px; }
.toast-enter-active, .toast-leave-active { transition: opacity 240ms var(--ease), transform 240ms var(--ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px) scale(0.98); }
</style>
