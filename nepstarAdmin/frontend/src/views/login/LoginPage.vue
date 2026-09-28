<template>
  <div class="login-page">
    <!-- 海王星辰登录背景：星轨环 / 四角星 / 流星 / 上升微光 -->
    <div class="neptune-bg">
      <div class="orbit orbit-1"></div>
      <div class="orbit orbit-2"></div>
      <div class="meteor meteor-1"></div>
      <div class="meteor meteor-2"></div>
      <div
        v-for="(star, i) in stars"
        :key="`star-${i}`"
        class="star"
        :class="{ yellow: star.yellow }"
        :style="star.style"
      ></div>
      <div v-for="(dot, i) in riseDots" :key="`dot-${i}`" class="rise-dot" :style="dot.style"></div>
    </div>

    <div class="login-card">
      <div class="brand">
        <span class="brand-icon">◆</span>
        <h1>NEPSTARAdmin</h1>
        <p>{{ $t('login.title') }}</p>
      </div>
      <el-form @submit.prevent="handleLogin" class="login-form">
        <el-input v-model="form.username" :placeholder="$t('login.username')" size="large" prefix-icon="User" />
        <el-input v-model="form.password" type="password" :placeholder="$t('login.password')" size="large" prefix-icon="Lock" show-password style="margin-top:16px" @keyup.enter="handleLogin" />
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

// 粒子的位置/大小/时序只在组件创建时随机一次，写进 CSS 变量，动画全部由 keyframes 驱动
const rand = (min: number, max: number) => (min + Math.random() * (max - min)).toFixed(2);

const stars = Array.from({ length: 40 }, () => ({
  yellow: Math.random() < 0.25,
  style: `--x:${rand(2, 98)}%;--y:${rand(2, 96)}%;--s:${rand(6, 22)}px;--tw:${rand(2.2, 4.5)}s;--df:${rand(10, 20)}s;--dl:${rand(0, 6)}s;--o:${rand(0.5, 1)}`,
}));

const riseDots = Array.from({ length: 14 }, () => ({
  style: `--x:${rand(3, 97)}%;--s:${rand(3, 7)}px;--t:${rand(9, 18)}s;--dl:${rand(0, 12)}s`,
}));
</script>

<style scoped>
.login-page { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 24px; position: relative; overflow: hidden; }

/* ---------- 背景容器（铺满视口，置于最底层） ---------- */
/* 品牌色：青绿 #15A29E / 星黄 #F7C81F / 白 #FFFFFF */
.neptune-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: radial-gradient(ellipse 120% 90% at 50% 30%, #1DB5B0 0%, #15A29E 42%, #0E7F7D 78%, #0A6664 100%);
}
/* 轻微暗角，让中心登录区更聚焦 */
.neptune-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 70% 60% at 50% 50%, transparent 55%, rgba(4, 54, 52, .38) 100%);
  pointer-events: none;
}

/* ① 星轨环：呼应 logo 的椭圆轨道，缓慢旋转 */
.orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 3px solid rgba(255, 255, 255, .35);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: orbitSpin 40s linear infinite;
}
.orbit-1 { width: 88vmin; height: 60vmin; }
.orbit-2 { width: 118vmin; height: 82vmin; border-width: 2px; border-color: rgba(255, 255, 255, .16); animation-duration: 65s; animation-direction: reverse; }
/* 环上的"领航星"：用伪元素挂一颗小星跟着转 */
.orbit::before {
  content: "";
  position: absolute;
  top: -9px;
  left: 50%;
  width: 16px;
  height: 16px;
  background: #F7C81F;
  clip-path: polygon(50% 0%, 63% 37%, 100% 50%, 63% 63%, 50% 100%, 37% 63%, 0% 50%, 37% 37%);
  filter: drop-shadow(0 0 6px rgba(247, 200, 31, .9));
}
.orbit-2::before { width: 11px; height: 11px; background: #fff; filter: drop-shadow(0 0 5px rgba(255, 255, 255, .8)); }
@keyframes orbitSpin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

/* ② 四角星粒子：提取 logo 星星造型，闪烁 + 漂浮 */
.star {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--s);
  height: var(--s);
  background: #fff;
  clip-path: polygon(50% 0%, 63% 37%, 100% 50%, 63% 63%, 50% 100%, 37% 63%, 0% 50%, 37% 37%);
  opacity: 0;
  animation:
    twinkle var(--tw, 3s) ease-in-out var(--dl, 0s) infinite,
    drift var(--df, 14s) ease-in-out var(--dl, 0s) infinite alternate;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, .55));
}
.star.yellow { background: #F7C81F; filter: drop-shadow(0 0 6px rgba(247, 200, 31, .75)); }
@keyframes twinkle {
  0%, 100% { opacity: 0; transform: scale(.5) rotate(0deg); }
  50% { opacity: var(--o, .9); transform: scale(1) rotate(20deg); }
}
@keyframes drift {
  from { margin-top: 0; }
  to { margin-top: -26px; }
}

/* ③ 流星：偶尔划过，增加灵动感 */
.meteor {
  position: absolute;
  width: 140px;
  height: 2px;
  background: linear-gradient(90deg, rgba(255, 255, 255, .95), transparent);
  border-radius: 2px;
  transform: rotate(-32deg);
  opacity: 0;
  animation: meteorFly 1.6s ease-out infinite;
}
.meteor-1 { top: 18%; left: 68%; animation-delay: 4s; animation-duration: 9s; }
.meteor-2 { top: 34%; left: 82%; animation-delay: 7.5s; animation-duration: 12s; }
@keyframes meteorFly {
  0% { opacity: 0; transform: rotate(-32deg) translateX(0); }
  4% { opacity: 1; }
  14% { opacity: 0; transform: rotate(-32deg) translateX(-260px); }
  100% { opacity: 0; transform: rotate(-32deg) translateX(-260px); }
}

/* ④ 上升微光粒子：底部缓缓升起，营造"星辰大海"纵深 */
.rise-dot {
  position: absolute;
  bottom: -10px;
  left: var(--x);
  width: var(--s);
  height: var(--s);
  border-radius: 50%;
  background: rgba(255, 255, 255, .5);
  filter: blur(1px);
  animation: riseUp var(--t, 12s) linear var(--dl, 0s) infinite;
}
@keyframes riseUp {
  0% { transform: translateY(0); opacity: 0; }
  12% { opacity: .7; }
  100% { transform: translateY(-108vh); opacity: 0; }
}

.login-card { width: min(420px, 100%); background: rgba(255,255,255,.96); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.65); border-radius: 24px; padding: 46px 40px; box-shadow: 0 30px 90px rgba(0,0,0,.32); position: relative; z-index: 1; animation: card-in .7s var(--ease) both; }
.brand { text-align: center; margin-bottom: 32px; }
.brand-icon { display: inline-grid; width: 48px; height: 48px; place-items: center; border-radius: 15px; color: white; background: linear-gradient(145deg, #17b3b7, #02787d); box-shadow: 0 10px 26px rgba(2,155,160,.3); font-size: 0; }
.brand-icon::after { content: "NEP"; font-size: 13px; font-weight: 800; letter-spacing: .06em; }
.brand h1 { font-size: 24px; color: #1e1b4b; margin: 8px 0 4px; }
.brand p { color: #64748b; font-size: 14px; }
.login-form { display: flex; flex-direction: column; gap: 4px; }
.login-btn { width: 100%; height: 44px; font-size: 16px; margin-top: 8px; background: #029ba0; border-color: #029ba0; }
.login-btn:hover { background: #02787d; border-color: #02787d; }
.error { color: #ef4444; text-align: center; margin-top: 12px; font-size: 13px; }
@keyframes card-in { from { opacity: 0; transform: translateY(18px) scale(.98); } }
@media (max-width: 520px) { .login-card { padding: 36px 24px; } }
</style>
