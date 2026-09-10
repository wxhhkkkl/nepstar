import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'Login', component: () => import('@/views/login/LoginPage.vue'), meta: { requiresAuth: false } },
  { path: '/change-password', name: 'ChangePassword', component: () => import('@/views/login/ChangePasswordPage.vue'), meta: { requiresAuth: true } },
  { path: '/dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/DashboardPage.vue'), meta: { requiresAuth: true } },
  { path: '/device/list', name: 'DeviceList', component: () => import('@/views/device/DeviceList.vue'), meta: { requiresAuth: true } },
  { path: '/report/list', name: 'ReportList', component: () => import('@/views/report/ReportList.vue'), meta: { requiresAuth: true } },
  { path: '/customer/list', name: 'CustomerList', component: () => import('@/views/customer/CustomerList.vue'), meta: { requiresAuth: true } },
  { path: '/system/users', name: 'UserList', component: () => import('@/views/system/UserList.vue'), meta: { requiresAuth: true } },
  { path: '/system/roles', name: 'RoleList', component: () => import('@/views/system/RoleList.vue'), meta: { requiresAuth: true } },
  { path: '/system/menus', name: 'MenuList', component: () => import('@/views/system/MenuList.vue'), meta: { requiresAuth: true } },
  { path: '/system/organizations', name: 'OrganizationList', component: () => import('@/views/system/OrganizationList.vue'), meta: { requiresAuth: true } },
  { path: '/health/indicators', name: 'HealthIndicators', component: () => import('@/views/health/IndicatorList.vue'), meta: { requiresAuth: true } },
  { path: '/health/products', name: 'HealthProducts', component: () => import('@/views/health/ProductList.vue'), meta: { requiresAuth: true } },
  { path: '/report/:id', name: 'ReportDetail', component: () => import('@/views/report/ReportDetail.vue'), meta: { requiresAuth: true } },
  { path: '/', redirect: '/dashboard' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth !== false && !token) {
    next('/login');
  } else {
    next();
  }
});

export default router;
