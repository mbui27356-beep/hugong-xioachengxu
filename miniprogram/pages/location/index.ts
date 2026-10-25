import { catalog } from '../../services/index'
import { getDraft, setLocation } from '../../store/booking'
import type { CampusNode, HospitalCard } from '../../core/types'

Page({
  data: {
    scrolled: false,
    loading: true,
    error: '',
    hospitalId: '',
    hospital: {} as HospitalCard,
    campuses: [] as CampusNode[],
    campusIndex: 0,
    campus: {} as CampusNode,
    deptId: '',
    wardId: '',
    summary: '',
    ready: false,
  },

  onLoad(q: Record<string, string | undefined>) {
    this.setData({ hospitalId: q.hospitalId || '' })
    this.load()
  },

  onPageScroll(e: WechatMiniprogram.Page.IPageScrollOption) {
    const scrolled = e.scrollTop > 40
    if (scrolled !== this.data.scrolled) this.setData({ scrolled })
  },

  async load() {
    this.setData({ loading: true, error: '' })
    const res = await catalog.getHospitalTree(this.data.hospitalId)
    if (!res.ok) {
      this.setData({ loading: false, error: res.error.message })
      return
    }
    const { hospital, campuses } = res.data
    // 恢复草稿中的已选位置（返回上一步时保留）
    const prev = getDraft().location
    let campusIndex = 0
    let deptId = ''
    let wardId = ''
    if (prev && prev.hospitalId === hospital.id) {
      campusIndex = Math.max(0, campuses.findIndex((c) => c.id === prev.campusId))
      deptId = prev.departmentId
      wardId = prev.wardId
    }
    this.setData({ loading: false, hospital, campuses, campusIndex, campus: campuses[campusIndex] || ({} as CampusNode), deptId, wardId })
    this.refresh()
  },

  pickCampus(e: WechatMiniprogram.TouchEvent) {
    const campusIndex = Number(e.currentTarget.dataset.index)
    if (campusIndex === this.data.campusIndex) return
    // 上级变化：清空不兼容的科室与病区
    this.setData({ campusIndex, campus: this.data.campuses[campusIndex], deptId: '', wardId: '' })
    this.refresh()
  },

  pickDept(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    if (id === this.data.deptId) return
    this.setData({ deptId: id, wardId: '' })
    this.refresh()
  },

  pickWard(e: WechatMiniprogram.TouchEvent) {
    this.setData({ wardId: e.currentTarget.dataset.id as string })
    this.refresh()
  },

  refresh() {
    const { campus, deptId, wardId } = this.data
    const dept = (campus.departments || []).find((d) => d.id === deptId)
    const ward = dept ? dept.wards.find((w) => w.id === wardId) : undefined
    const ready = !!dept && (!dept.wards.length || !!ward)
    const summary = dept ? [campus.name, dept.name, ward ? ward.name : ''].filter(Boolean).join(' · ') : ''
    this.setData({ ready, summary })
  },

  switchHospital() {
    wx.navigateBack()
  },

  next() {
    const { hospital, campus, deptId, wardId, ready } = this.data
    if (!ready) {
      const dept = (campus.departments || []).find((d) => d.id === deptId)
      wx.showToast({ title: dept ? '请选择病区' : '请选择科室', icon: 'none' })
      return
    }
    const dept = campus.departments.find((d) => d.id === deptId)!
    const ward = dept.wards.find((w) => w.id === wardId)
    setLocation({
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      campusId: campus.id,
      campusName: campus.name,
      departmentId: dept.id,
      departmentName: dept.name,
      wardId: ward ? ward.id : '',
      wardName: ward ? ward.name : '',
      address: campus.address,
    })
    const consented = getDraft().consents.length > 0
    wx.navigateTo({ url: consented ? '/pages/service/index' : '/pages/consent/index' })
  },
})
