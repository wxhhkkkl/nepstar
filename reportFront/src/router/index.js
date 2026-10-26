import { createRouter, createWebHashHistory } from 'vue-router'
import ReportHome from '@/views/ReportHome.vue'
import SystemDetail from '@/views/SystemDetail.vue'
import IndicatorDetail from '@/views/IndicatorDetail.vue'
import AiConsult from '@/views/AiConsult.vue'
import PlanDetail from '@/views/PlanDetail.vue'
import RouteNotFound from '@/views/RouteNotFound.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: ReportHome },
    { path: '/system/:systemId', name: 'system-detail', component: SystemDetail },
    { path: '/system/:systemId/indicator/:indicatorCode', name: 'indicator-detail', component: IndicatorDetail },
    { path: '/ai-consult', name: 'ai-consult', component: AiConsult },
    { path: '/plans/:planId', name: 'plan-detail', component: PlanDetail },
    { path: '/:pathMatch(.*)*', name: 'route-not-found', component: RouteNotFound },
  ],
  scrollBehavior(to, from, savedPosition) {
    // 首页由真实报告渲染后统一定位，避免浏览器返回时先在骨架屏上恢复滚动。
    if (to.name === 'home') return false
    if (to.name === 'plan-detail') return false
    if (savedPosition) return savedPosition
    if (to.name === 'system-detail' && ['indicator-detail', 'plan-detail'].includes(from.name)) return false
    if (to.name === 'ai-consult' && ['system-detail', 'indicator-detail', 'plan-detail'].includes(from.name)) return false
    return { top: 0 }
  },
})
