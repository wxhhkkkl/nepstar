<template>
  <div class="login-page">
    <div class="bg-animation">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
      <div class="blob blob-4"></div>
    </div>
    <div class="login-card">
      <div class="brand">
        <span class="brand-icon">◆</span>
        <h1>LOONGQIAdmin</h1>
        <p>{{ $t('login.title') }}</p>
      </div>
      <el-form @submit.prevent="handleLogin" class="login-form">
        <el-input v-model="form.username" :placeholder="$t('login.username')" size="large" prefix-icon="User" />
        <el-input v-model="form.password" type="password" :placeholder="$t('login.password')" size="large" prefix-icon="Lock" show-password style="margin-top:16px" @keyup.enter="handleLogin" />
        <div class="lang-row"><LangSwitcher /></div>
        <el-button type="primary" native-type="submit" :loading="loading" size="large" class="login-btn">{{ $t('login.login') }}</el-button>
      </el-form>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';
import LangSwitcher from '@/components/LangSwitcher.vue';

const router = useRouter();
const authStore = useAuthStore();
const appStore = useAppStore();
const form = reactive({ username: '', password: '' });
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  loading.value = true; error.value = '';
  try {
    const data = await authStore.login(form.username, form.password, appStore.language);
    router.push(data.must_change_pwd ? '/change-password' : '/dashboard');
  } catch (e: any) { error.value = e.message || 'Login failed'; }
  finally { loading.value = false; }
}
</script>

<style scoped>
.login-page { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 24px; background: radial-gradient(circle at 15% 15%, #3d3d78 0, transparent 28%), radial-gradient(circle at 85% 80%, #4b477f 0, transparent 26%), #17172f; position: relative; overflow: hidden; }
.login-page::before { position: absolute; inset: 0; opacity: .25; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 42px 42px; content: ""; mask-image: radial-gradient(circle at center, black, transparent 72%); }
.bg-animation { position: absolute; inset: 0; pointer-events: none; }
.blob { position: absolute; border-radius: 50%; opacity: .12; animation: float 12s ease-in-out infinite; }
.blob-1 { width: 400px; height: 400px; background: #818cf8; top: -100px; left: -80px; animation-delay: 0s; }
.blob-2 { width: 300px; height: 300px; background: #c084fc; bottom: -80px; right: -60px; animation-delay: -4s; }
.blob-3 { width: 200px; height: 200px; background: #6366f1; top: 40%; left: 60%; animation-delay: -7s; }
.blob-4 { width: 250px; height: 250px; background: #a5b4fc; bottom: 20%; left: -100px; animation-delay: -10s; }
@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -40px) scale(1.15); }
  50% { transform: translate(-20px, 20px) scale(.95); }
  75% { transform: translate(-40px, -10px) scale(1.08); }
}
.login-card { width: min(420px, 100%); background: rgba(255,255,255,.96); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.65); border-radius: 24px; padding: 46px 40px; box-shadow: 0 30px 90px rgba(0,0,0,.32); position: relative; z-index: 1; animation: card-in .7s var(--ease) both; }
.brand { text-align: center; margin-bottom: 32px; }
.brand-icon { display: inline-grid; width: 48px; height: 48px; place-items: center; border-radius: 15px; color: white; background: linear-gradient(145deg, #7373e6, #4e4ebd); box-shadow: 0 10px 26px rgba(91,91,214,.3); font-size: 0; }
.brand-icon::after { content: "LQ"; font-size: 13px; font-weight: 800; letter-spacing: .06em; }
.brand h1 { font-size: 24px; color: #1e1b4b; margin: 8px 0 4px; }
.brand p { color: #64748b; font-size: 14px; }
.login-form { display: flex; flex-direction: column; gap: 4px; }
.lang-row { display: flex; justify-content: center; margin: 8px 0; }
.login-btn { width: 100%; height: 44px; font-size: 16px; margin-top: 8px; background: #6366f1; border-color: #6366f1; }
.login-btn:hover { background: #4f46e5; border-color: #4f46e5; }
.error { color: #ef4444; text-align: center; margin-top: 12px; font-size: 13px; }
@keyframes card-in { from { opacity: 0; transform: translateY(18px) scale(.98); } }
@media (max-width: 520px) { .login-card { padding: 36px 24px; } }
</style>
