import { iconUri } from '../../core/icons'

Component({
  properties: {
    name: { type: String, value: 'info' },
    color: { type: String, value: '#1D1D1F' },
    size: { type: Number, value: 40 },
    stroke: { type: Number, value: 1.7 },
  },
  data: { src: '' },
  lifetimes: {
    attached() {
      this.setData({ src: iconUri(this.data.name, this.data.color, this.data.stroke) })
    },
  },
  observers: {
    'name, color, stroke'(name: string, color: string, stroke: number) {
      this.setData({ src: iconUri(name, color, stroke) })
    },
  },
})
