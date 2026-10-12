import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

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
  { path: '/health/plans', name: 'HealthPlans', component: () => import('@/views/health/PlanList.vue'), meta: { requiresAuth: true } },
  { path: '/health/ai-consult-settings', name: 'AiConsultSettings', component: () => import('@/views/health/AiConsultSettings.vue'), meta: { requiresAuth: true, permission: { menuPath: '/health/ai-consult-settings', action: 'view' } } },
  { path: '/health/ai-consult-overview', name: 'AiConsultOverview', component: () => import('@/views/health/AiConsultOverview.vue'), meta: { requiresAuth: true, permission: { menuPath: '/health/ai-consult-overview', action: 'view' } } },
  { path: '/forbidden', name: 'Forbidden', component: () => import('@/views/ForbiddenPage.vue'), meta: { requiresAuth: true } },
  { path: '/report/:id', name: 'ReportDetail', component: () => import('@/views/report/ReportDetail.vue'), meta: { requiresAuth: true } },
  { path: '/', redirect: '/dashboard' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

function findMenuId(menus: any[], routePath: string): number | null {
  for (const menu of menus) {
    if (menu.route_path === routePath) return Number(menu.id);
    const nested = findMenuId(menu.children || [], routePath);
    if (nested !== null) return nested;
  }
  return null;
}

router.beforeEach(async (to) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth !== false && !token) {
    return '/login';
  }

  const permission = to.meta.permission as { menuPath: string; action: string } | undefined;
  if (!permission) return true;

  const authStore = useAuthStore();
  if (!authStore.user) {
    try {
      await authStore.fetchUserInfo();
    } catch {
      return { name: 'Forbidden', query: { reason: 'verification-failed' } };
    }
  }
  if (authStore.roles.includes('admin')) return true;
  const menuId = findMenuId(authStore.menus, permission.menuPath);
  if (menuId !== null && authStore.hasPermission(String(menuId), permission.action)) return true;
  return { name: 'Forbidden', query: { from: to.fullPath } };
});

export default router;
