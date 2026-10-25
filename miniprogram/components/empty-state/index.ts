Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    icon: { type: String, value: 'inbox' },
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
    actionText: { type: String, value: '' },
  },
  methods: {
    onAction() {
      this.triggerEvent('action')
    },
  },
})
