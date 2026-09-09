import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/api/client';

interface UserInfo {
  id: number;
  username: string;
  realName: string;
  langPref: string;
  mustChangePwd: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref<UserInfo | null>(null);
  const roles = ref<string[]>([]);
  const menus = ref<any[]>([]);
  const permissions = ref<Record<string, string[]>>({});

  async function login(username: string, password: string, lang: string) {
    const res = await api.post('/auth/login', { username, password, lang });
    token.value = res.data.token;
    localStorage.setItem('token', res.data.token);
    user.value = res.data.user;
    await fetchUserInfo();
    return res.data;
  }

  async function fetchUserInfo() {
    const res = await api.get('/auth/me');
    user.value = res.data.user;
    roles.value = res.data.roles?.map((r: any) => r.roleCode) || [];
    menus.value = res.data.menus || [];
    permissions.value = res.data.permissions || {};
  }

  function logout() {
    token.value = '';
    user.value = null;
    roles.value = [];
    menus.value = [];
    permissions.value = {};
    localStorage.removeItem('token');
  }

  function hasPermission(menuId: string, action: string): boolean {
    return permissions.value[menuId]?.includes(action) || false;
  }

  return { token, user, roles, menus, permissions, login, fetchUserInfo, logout, hasPermission };
});
