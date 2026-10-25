import { patients } from '../../services/index'
import { patch } from '../../store/booking'
import { validatePatient } from '../../core/domain'
import type { Gender, PatientInput } from '../../core/types'

const EMPTY: PatientInput = { name: '', gender: '', age: null, contactName: '', contactPhone: '', contactRelation: '', isDefault: false }

Page({
  data: {
    scrolled: false,
    id: '',
    selectAfter: false,
    saving: false,
    form: { ...EMPTY } as PatientInput,
    ageText: '',
    genders: [
      { value: 'M', label: '男' },
      { value: 'F', label: '女' },
      { value: '', label: '不填' },
    ],
    relations: ['本人', '子女', '配偶', '父母', '孙辈', '其他亲属', '朋友'],
  },

  async onLoad(q: Record<string, string | undefined>) {
    this.setData({ id: q.id || '', selectAfter: q.select === '1' })
    if (!q.id) return
    const res = await patients.get(q.id)
    if (!res.ok) {
      wx.showModal({ title: '无法编辑', content: res.error.message, showCancel: false, success: () => wx.navigateBack() })
      return
    }
    const p = res.data
    this.setData({
      form: { name: p.name, gender: p.gender, age: p.age, contactName: p.contactName, contactPhone: p.contactPhone, contactRelation: p.contactRelation, isDefault: p.isDefault },
      ageText: p.age === null ? '' : String(p.age),
    })
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 40
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value })
  },

  onAge(e: WechatMiniprogram.Input) {
    const v = e.detail.value.replace(/\D/g, '')
    this.setData({ ageText: v, 'form.age': v ? Number(v) : null })
  },

  pickGender(e: WechatMiniprogram.TouchEvent) {
    this.setData({ 'form.gender': e.currentTarget.dataset.value as Gender })
  },

  pickRelation(e: WechatMiniprogram.TouchEvent) {
    const relation = e.currentTarget.dataset.value as string
    const upd: Record<string, string> = { 'form.contactRelation': relation }
    // 本人即联系人：自动带出姓名
    if (relation === '本人' && !this.data.form.contactName) upd['form.contactName'] = this.data.form.name
    this.setData(upd)
  },

  onDefault(e: WechatMiniprogram.SwitchChange) {
    this.setData({ 'form.isDefault': e.detail.value })
  },

  async save() {
    if (this.data.saving) return
    const err = validatePatient(this.data.form)
    if (err) {
      wx.showToast({ title: err, icon: 'none' })
      return
    }
    this.setData({ saving: true })
    const res = await patients.save(this.data.id || null, this.data.form)
    this.setData({ saving: false })
    if (!res.ok) {
      wx.showToast({ title: res.error.message, icon: 'none' })
      return
    }
    if (this.data.selectAfter) {
      // 从预约流程新增：直接选中并返回核对页
      patch({ patientId: res.data.id })
      wx.navigateBack({ delta: 2 })
      return
    }
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 500)
  },

  remove() {
    wx.showModal({
      title: '移除这位就诊人？',
      content: '只移除常用档案，已提交的订单不受影响。',
      confirmText: '移除',
      confirmColor: '#D70015',
      success: async (r) => {
        if (!r.confirm) return
        const res = await patients.remove(this.data.id)
        if (!res.ok) {
          wx.showToast({ title: res.error.message, icon: 'none' })
          return
        }
        wx.navigateBack()
      },
    })
  },
})
