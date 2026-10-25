// 预约草稿：跨页面保存用户已选内容。上级变化时清空不兼容的下级选择。

import type { Assessment, BedInfo, ConsentRef, HospitalCard, LocationSnapshot, OfferingView, Quote } from '../core/types'

export interface BookingDraft {
  hospital: HospitalCard | null
  location: LocationSnapshot | null
  consents: ConsentRef[]
  startAt: number
  units: number
  assessment: Assessment
  offering: OfferingView | null
  patientId: string
  bed: BedInfo
  quote: Quote | null
  requestId: string
}

function empty(): BookingDraft {
  return {
    hospital: null,
    location: null,
    consents: [],
    startAt: 0,
    units: 1,
    assessment: {},
    offering: null,
    patientId: '',
    bed: { room: '', bedNo: '', unsure: false },
    quote: null,
    requestId: '',
  }
}

let draft: BookingDraft = empty()

export function getDraft(): BookingDraft {
  return draft
}

export function setHospital(h: HospitalCard) {
  if (draft.hospital && draft.hospital.id === h.id) return
  draft = { ...empty(), hospital: h, patientId: draft.patientId }
}

export function setLocation(loc: LocationSnapshot) {
  const prev = draft.location
  const same = prev && prev.campusId === loc.campusId && prev.departmentId === loc.departmentId && prev.wardId === loc.wardId
  draft.location = loc
  if (!same) {
    draft.offering = null
    draft.quote = null
  }
}

export function patch(p: Partial<BookingDraft>) {
  Object.assign(draft, p)
  if (p.offering !== undefined || p.startAt !== undefined || p.units !== undefined || p.assessment !== undefined) {
    draft.quote = null
  }
}

export function resetDraft() {
  draft = empty()
}
