// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import api from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import router from '../index';

describe('AI consultation admin route permissions', () => {
  let auth: ReturnType<typeof useAuthStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    auth = useAuthStore();
    auth.token = 'test-token';
    auth.user = {
      id: 1, username: 'operator', real_name: 'Operator', lang_pref: 'zh-CN',
    };
    auth.roles = ['operator'];
    auth.menus = [{ id: 10, route_path: '/health', children: [
      { id: 41, route_path: '/health/ai-consult-settings' },
      { id: 42, route_path: '/health/ai-consult-overview' },
    ] }];
    auth.permissions = {};
    localStorage.setItem('token', 'test-token');
    await router.replace('/login');
  });

  it('redirects a direct settings URL without view permission before loading the page', async () => {
    await router.push('/health/ai-consult-settings');

    expect(router.currentRoute.value.name).toBe('Forbidden');
    expect(router.currentRoute.value.query.from).toBe('/health/ai-consult-settings');
  });

  it('allows the exact menu view permission', async () => {
    auth.permissions = { '41': ['view'] };
    await router.push('/health/ai-consult-settings');

    expect(router.currentRoute.value.name).toBe('AiConsultSettings');
  });

  it('keeps the admin-role bypass consistent with the backend', async () => {
    auth.roles = ['admin'];
    auth.menus = [];
    auth.permissions = {};
    await router.push('/health/ai-consult-overview');

    expect(router.currentRoute.value.name).toBe('AiConsultOverview');
  });

  it('accepts the actual snake_case role returned by /auth/me after refresh', async () => {
    auth.user = null;
    auth.roles = [];
    auth.menus = [];
    const get = vi.spyOn(api, 'get').mockResolvedValueOnce({ data: {
      user: { id: 1, username: 'admin', real_name: '系统管理员', lang_pref: 'zh-CN' },
      roles: [{ role_code: 'admin', role_name: '系统管理员' }],
      menus: [{ id: 10, route_path: '/health', children: [
        { id: 41, route_path: '/health/ai-consult-settings' },
      ] }],
      permissions: { '41': ['view', 'edit', 'publish'] },
    } });

    await router.push('/health/ai-consult-settings');

    expect(router.currentRoute.value.name).toBe('AiConsultSettings');
    expect(auth.roles).toContain('admin');
    expect(auth.user).toMatchObject({ real_name: '系统管理员' });
    get.mockRestore();
  });
});
