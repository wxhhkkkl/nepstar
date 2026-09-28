import { createRouter, createWebHashHistory } from 'vue-router'
import ReportHome from '@/views/ReportHome.vue'
import SystemDetail from '@/views/SystemDetail.vue'
import IndicatorDetail from '@/views/IndicatorDetail.vue'
import RouteNotFound from '@/views/RouteNotFound.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: ReportHome },
    { path: '/system/:systemId', name: 'system-detail', component: SystemDetail },
    { path: '/system/:systemId/indicator/:indicatorCode', name: 'indicator-detail', component: IndicatorDetail },
    { path: '/:pathMatch(.*)*', name: 'route-not-found', component: RouteNotFound },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.name === 'home' && from.name === 'system-detail') return false
    if (to.name === 'system-detail' && from.name === 'indicator-detail') return false
    return { top: 0 }
  },
})
