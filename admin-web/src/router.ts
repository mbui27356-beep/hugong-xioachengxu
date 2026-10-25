import { createRouter, createWebHistory, type RouteComponent, type RouteRecordRaw } from 'vue-router'
import { NAV_ITEMS } from './nav'

const pages: Record<string, () => Promise<RouteComponent>> = {
  dashboard: () => import('./pages/DashboardPage.vue'),
  orders: () => import('./pages/OrdersPage.vue'),
  dispatch: () => import('./pages/DispatchPage.vue'),
  payments: () => import('./pages/PaymentsPage.vue'),
  patients: () => import('./pages/PatientsPage.vue'),
  messages: () => import('./pages/MessagesPage.vue'),
  regions: () => import('./pages/RegionsPage.vue'),
  hospitals: () => import('./pages/HospitalsPage.vue'),
  departments: () => import('./pages/DepartmentsPage.vue'),
  packages: () => import('./pages/PackagesPage.vue'),
  agreements: () => import('./pages/AgreementsPage.vue'),
  settings: () => import('./pages/SettingsPage.vue'),
}

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  ...NAV_ITEMS.map(
    (n): RouteRecordRaw => ({ path: n.path, name: n.name, component: pages[n.name], meta: { title: n.title, perm: n.perm } }),
  ),
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from) => (to.path === from.path ? false : { top: 0 }),
})

router.afterEach((to) => {
  const t = to.meta.title as string | undefined
  document.title = t ? `${t} · 陪护管理后台（演示）` : '陪护管理后台（演示）'
})
