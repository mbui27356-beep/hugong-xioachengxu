// 由后端模块 backend/src/modules/admin/catalog.ts 对应的 HTTP 客户端；类型直接取自后端实现，保证两端一致。
import type * as M from '../../../backend/src/modules/admin/catalog'
import { rpc } from './http'

export type * from '../../../backend/src/modules/admin/catalog'

export const listRegions = rpc<typeof M.listRegions>('catalog', 'listRegions')
export const saveCity = rpc<typeof M.saveCity>('catalog', 'saveCity')
export const toggleCity = rpc<typeof M.toggleCity>('catalog', 'toggleCity')
export const deleteCity = rpc<typeof M.deleteCity>('catalog', 'deleteCity')
export const moveCity = rpc<typeof M.moveCity>('catalog', 'moveCity')
export const saveDistrict = rpc<typeof M.saveDistrict>('catalog', 'saveDistrict')
export const toggleDistrict = rpc<typeof M.toggleDistrict>('catalog', 'toggleDistrict')
export const deleteDistrict = rpc<typeof M.deleteDistrict>('catalog', 'deleteDistrict')
export const moveDistrict = rpc<typeof M.moveDistrict>('catalog', 'moveDistrict')
export const listGrades = rpc<typeof M.listGrades>('catalog', 'listGrades')
export const saveGrade = rpc<typeof M.saveGrade>('catalog', 'saveGrade')
export const toggleGrade = rpc<typeof M.toggleGrade>('catalog', 'toggleGrade')
export const deleteGrade = rpc<typeof M.deleteGrade>('catalog', 'deleteGrade')
export const moveGrade = rpc<typeof M.moveGrade>('catalog', 'moveGrade')
export const listHospitals = rpc<typeof M.listHospitals>('catalog', 'listHospitals')
export const getHospital = rpc<typeof M.getHospital>('catalog', 'getHospital')
export const saveHospital = rpc<typeof M.saveHospital>('catalog', 'saveHospital')
export const toggleHospital = rpc<typeof M.toggleHospital>('catalog', 'toggleHospital')
export const saveCampus = rpc<typeof M.saveCampus>('catalog', 'saveCampus')
export const toggleCampus = rpc<typeof M.toggleCampus>('catalog', 'toggleCampus')
export const moveCampus = rpc<typeof M.moveCampus>('catalog', 'moveCampus')
export const listCampusOptions = rpc<typeof M.listCampusOptions>('catalog', 'listCampusOptions')
export const getDepartmentTree = rpc<typeof M.getDepartmentTree>('catalog', 'getDepartmentTree')
export const saveDepartment = rpc<typeof M.saveDepartment>('catalog', 'saveDepartment')
export const toggleDepartment = rpc<typeof M.toggleDepartment>('catalog', 'toggleDepartment')
export const reorderDepartments = rpc<typeof M.reorderDepartments>('catalog', 'reorderDepartments')
export const saveWard = rpc<typeof M.saveWard>('catalog', 'saveWard')
export const toggleWard = rpc<typeof M.toggleWard>('catalog', 'toggleWard')
