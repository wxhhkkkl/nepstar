<template>
  <router-view v-if="isAuthPage" v-slot="{ Component }">
    <transition name="route" mode="out-in"><component :is="Component" /></transition>
  </router-view>

  <div v-else class="layout" :class="{ 'sidebar-open': mobileMenuOpen }">
    <div class="mobile-mask" @click="mobileMenuOpen = false" />
    <aside class="sidebar">
      <div class="logo">
        <span class="logo-mark">LQ</span>
        <div class="logo-copy">
          <strong>LOONGQI</strong>
          <span>SMART ADMIN</span>
        </div>
      </div>
      <div class="nav-label">WORKSPACE</div>
      <SidebarMenu />
      <div class="sidebar-footer">
        <span class="status-dot" />
        <span>System online</span>
      </div>
    </aside>

    <div class="right">
      <header class="topbar">
        <button class="menu-button" aria-label="打开导航" @click="mobileMenuOpen = true">
          <el-icon><Menu /></el-icon>
        </button>
        <div class="page-context">
          <span class="eyebrow">Management Console</span>
          <span class="welcome">{{ $t('app.welcomeBack') }}{{ displayName }}</span>
        </div>
        <div class="topbar-actions">
          <LangSwitcher />
          <span class="divider" />
          <el-dropdown trigger="click">
            <button class="user-chip">
              <span class="avatar">{{ avatarText }}</span>
              <span class="user-copy"><strong>{{ displayName }}</strong><small>{{ $t('app.role') }}</small></span>
              <el-icon><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="logout">{{ $t('app.logout') }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="route" mode="out-in"><component :is="Component" /></transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowDown, Menu } from '@element-plus/icons-vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import SidebarMenu from '@/components/SidebarMenu.vue';
import LangSwitcher from '@/components/LangSwitcher.vue';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const authStore = useAuthStore();
const { locale } = useI18n();
const mobileMenuOpen = ref(false);
const isAuthPage = computed(() => ['/login', '/change-password'].includes(route.path));
const displayName = computed(() => authStore.user?.realName || authStore.user?.username || 'Admin');
const avatarText = computed(() => displayName.value.trim().slice(0, 1).toUpperCase());

watch(() => appStore.language, (lang) => { locale.value = lang; });
watch(() => route.path, () => { mobileMenuOpen.value = false; });
locale.value = appStore.language;

onMounted(async () => {
  if (authStore.token && !authStore.user) {
    try { await authStore.fetchUserInfo(); } catch { /* handled by interceptor */ }
  }
});

function logout() { authStore.logout(); router.push('/login'); }
</script>

<style>
.layout { display: flex; min-height: 100vh; }
.sidebar { position: relative; z-index: 30; display: flex; width: 250px; flex-shrink: 0; flex-direction: column; overflow: hidden; background: radial-gradient(circle at 20% 0%, #303060 0, transparent 38%), var(--sidebar-bg); box-shadow: 8px 0 30px rgba(23,23,47,.08); }
.logo { display: flex; align-items: center; gap: 12px; height: 82px; padding: 0 22px; color: white; }
.logo-mark { display: grid; width: 42px; height: 42px; place-items: center; border: 1px solid rgba(255,255,255,.22); border-radius: 13px; background: linear-gradient(145deg, #7777ee, #4d4dbe); box-shadow: 0 8px 22px rgba(91,91,214,.38); font-size: 14px; font-weight: 800; letter-spacing: .05em; }
.logo-copy { display: flex; flex-direction: column; gap: 2px; }
.logo-copy strong { font-size: 16px; letter-spacing: .08em; }
.logo-copy span, .nav-label { color: #777b9e; font-size: 9px; font-weight: 700; letter-spacing: .18em; }
.nav-label { padding: 17px 24px 7px; }
.sidebar-footer { display: flex; align-items: center; gap: 9px; margin: 16px; padding: 13px; border: 1px solid rgba(255,255,255,.06); border-radius: 12px; color: #898daa; background: rgba(255,255,255,.035); font-size: 11px; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #3ad6a1; box-shadow: 0 0 0 4px rgba(58,214,161,.12); }
.right { display: flex; min-width: 0; flex: 1; flex-direction: column; }
.topbar { display: flex; height: 74px; flex-shrink: 0; align-items: center; justify-content: space-between; padding: 0 30px; border-bottom: 1px solid rgba(232,233,241,.8); background: rgba(255,255,255,.82); backdrop-filter: blur(18px); }
.page-context { display: flex; flex-direction: column; gap: 3px; }
.eyebrow { color: #9699aa; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.welcome { color: var(--text); font-size: 14px; font-weight: 600; }
.topbar-actions { display: flex; align-items: center; gap: 14px; }
.divider { width: 1px; height: 26px; background: var(--border); }
.user-chip { display: flex; align-items: center; gap: 10px; padding: 5px 7px; border: 0; border-radius: 12px; color: var(--text); background: transparent; cursor: pointer; transition: background .2s ease; }
.user-chip:hover { background: #f4f4fa; }
.avatar { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px; color: #fff; background: linear-gradient(145deg, #6868df, #8f7ce8); font-weight: 700; box-shadow: 0 5px 14px rgba(91,91,214,.25); }
.user-copy { display: flex; min-width: 76px; flex-direction: column; align-items: flex-start; }
.user-copy strong { max-width: 120px; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.user-copy small { color: #9a9dae; font-size: 10px; }
.content { flex: 1; overflow: auto; padding: 28px 30px 36px; background: radial-gradient(circle at 95% 0, rgba(116,103,218,.07), transparent 24%), var(--content-bg); }
.content > * { width: 100%; max-width: 1540px; margin-inline: auto; }
.menu-button { display: none; border: 0; color: var(--text); background: transparent; font-size: 22px; }
.mobile-mask { display: none; }

@media (max-width: 900px) {
  .sidebar { position: fixed; inset: 0 auto 0 0; transform: translateX(-102%); transition: transform .35s var(--ease); }
  .sidebar-open .sidebar { transform: translateX(0); }
  .sidebar-open .mobile-mask { position: fixed; z-index: 20; display: block; inset: 0; background: rgba(23,23,47,.38); backdrop-filter: blur(3px); }
  .menu-button { display: inline-flex; }
  .page-context { display: none; }
  .topbar { height: 64px; padding: 0 16px; }
  .content { padding: 20px 16px 28px; }
  .user-copy, .divider { display: none; }
}
</style>
