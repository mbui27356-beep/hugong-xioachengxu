import { ref } from 'vue'

/** 写操作成功后通知外壳刷新侧栏计数 */
export const dataVersion = ref(0)
export function notifyChanged() {
  dataVersion.value += 1
}
