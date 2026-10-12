<template>
  <section class="forbidden-card">
    <div class="eyebrow">ACCESS CONTROL</div>
    <div class="status-mark" aria-hidden="true">!</div>
    <h1>{{ verificationFailed ? '暂时无法验证访问权限' : '当前账号没有访问权限' }}</h1>
    <p>
      {{ verificationFailed
        ? '权限服务暂时不可用，请稍后重试。'
        : '你没有查看此管理页面的权限，请联系系统管理员为当前账号分配对应菜单权限。' }}
    </p>
    <el-button type="primary" @click="router.replace('/dashboard')">返回工作台</el-button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const verificationFailed = computed(() => route.query.reason === 'verification-failed');
</script>

<style scoped>
.forbidden-card { max-width: 540px; margin: 10vh auto; padding: 42px 36px; border: 1px solid #e6ebf3; border-radius: 20px; background: #fff; text-align: center; box-shadow: 0 12px 36px #33415c0d; }
.eyebrow { color: #8994ab; font-size: 10px; font-weight: 750; letter-spacing: .16em; }
.status-mark { display: grid; width: 58px; height: 58px; place-items: center; margin: 22px auto 16px; border: 1px solid #f1d4d2; border-radius: 18px; color: #c56b62; background: #fff5f3; font-size: 28px; font-weight: 750; }
h1 { margin: 0; color: #202b43; font-size: 21px; }
p { margin: 12px 0 24px; color: #78869b; font-size: 13px; line-height: 1.8; }
@media (max-width: 540px) { .forbidden-card { margin: 7vh 8px; padding: 32px 22px; } }
</style>
