<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{ values: number[]; labels: string[]; height?: number; format?: (v: number) => string; unit?: string }>(), {
  height: 140,
  unit: '',
})

const W = 600
const pad = { t: 16, r: 8, b: 24, l: 8 }
const hover = ref<number | null>(null)

const max = computed(() => Math.max(1, ...props.values))
const pts = computed(() => {
  const n = props.values.length
  const h = props.height - pad.t - pad.b
  return props.values.map((v, i) => ({
    x: pad.l + (n <= 1 ? 0 : (i * (W - pad.l - pad.r)) / (n - 1)),
    y: pad.t + h - (v / max.value) * h,
  }))
})
const line = computed(() => pts.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
const area = computed(() => {
  if (!pts.value.length) return ''
  const base = props.height - pad.b
  return `${line.value} L${pts.value[pts.value.length - 1].x},${base} L${pts.value[0].x},${base} Z`
})
const fmt = (v: number) => (props.format ? props.format(v) : `${v}${props.unit}`)
const focus = computed(() => (hover.value == null ? props.values.length - 1 : hover.value))

function onMove(e: MouseEvent) {
  const el = e.currentTarget as SVGElement
  const rect = el.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * W
  let best = 0
  pts.value.forEach((p, i) => {
    if (Math.abs(p.x - x) < Math.abs(pts.value[best].x - x)) best = i
  })
  hover.value = best
}
</script>

<template>
  <div class="trend">
    <div class="readout">
      <span class="val num">{{ fmt(values[focus] ?? 0) }}</span>
      <span class="lab">{{ labels[focus] }}</span>
    </div>
    <svg
      :viewBox="`0 0 ${W} ${height}`"
      preserveAspectRatio="none"
      class="svg"
      :style="{ height: `${height}px` }"
      role="img"
      :aria-label="`趋势：${labels[0]} 至 ${labels[labels.length - 1]}`"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <line v-for="g in 3" :key="g" :x1="0" :x2="W" :y1="pad.t + ((height - pad.t - pad.b) * (g - 1)) / 2" :y2="pad.t + ((height - pad.t - pad.b) * (g - 1)) / 2" class="grid" />
      <path :d="area" class="area" />
      <path :d="line" class="line" vector-effect="non-scaling-stroke" />
      <line v-if="pts[focus]" :x1="pts[focus].x" :x2="pts[focus].x" :y1="pad.t" :y2="height - pad.b" class="cursor" vector-effect="non-scaling-stroke" />
    </svg>
    <div v-if="pts[focus]" class="dot" :style="{ left: `${(pts[focus].x / W) * 100}%`, top: `${pts[focus].y + 30}px` }" />
    <div class="axis">
      <span>{{ labels[0] }}</span>
      <span>{{ labels[labels.length - 1] }}</span>
    </div>
  </div>
</template>

<style scoped>
.trend { position: relative; }
.readout { display: flex; align-items: baseline; gap: 8px; height: 30px; }
.val { font-size: 22px; line-height: 28px; font-weight: 600; letter-spacing: -0.3px; }
.lab { font-size: 13px; color: var(--label-3); }
.svg { display: block; width: 100%; overflow: visible; cursor: crosshair; }
.grid { stroke: var(--separator); stroke-width: 1; vector-effect: non-scaling-stroke; }
.area { fill: rgba(0, 0, 0, 0.035); }
.line { fill: none; stroke: var(--label); stroke-width: 1.75; stroke-linejoin: round; stroke-linecap: round; }
.cursor { stroke: var(--label-4); stroke-width: 1; stroke-dasharray: 3 3; }
.dot {
  position: absolute; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 50%;
  background: var(--surface); box-shadow: 0 0 0 2px var(--label); pointer-events: none;
}
.axis { display: flex; justify-content: space-between; font-size: 12px; color: var(--label-3); margin-top: -18px; }
</style>
