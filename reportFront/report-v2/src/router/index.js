import { createRouter, createWebHashHistory } from 'vue-router'
import ReportHome from '@/views/ReportHome.vue'
import SystemDetail from '@/views/SystemDetail.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: ReportHome },
    { path: '/system/:systemId', name: 'system-detail', component: SystemDetail },
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.name === 'home' && from.name === 'system-detail') return false
    return { top: 0 }
  },
})
