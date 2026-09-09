<template>
  <div class="login-container">
    <el-card class="login-card">
      <h2>{{ $t('login.changePassword') }}</h2>
      <el-form @submit.prevent="handleChange">
        <el-form-item>
          <el-input v-model="form.oldPassword" type="password" :placeholder="$t('login.oldPassword')" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.newPassword" type="password" :placeholder="$t('login.newPassword')" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.confirmPassword" type="password" :placeholder="$t('login.confirmPassword')" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit" :loading="loading" style="width:100%">
            {{ $t('common.confirm') }}
          </el-button>
        </el-form-item>
      </el-form>
      <p v-if="error" class="error">{{ error }}</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/client';

const router = useRouter();
const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });
const loading = ref(false);
const error = ref('');

async function handleChange() {
  if (form.newPassword !== form.confirmPassword) {
    error.value = 'Passwords do not match';
    return;
  }
  loading.value = true;
  try {
    await api.put('/auth/change-password', {
      old_password: form.oldPassword,
      new_password: form.newPassword,
    });
    router.push('/dashboard');
  } catch (e: any) {
    error.value = e.message || 'Failed';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 24px; background: radial-gradient(circle at 20% 10%, #3d3d78, transparent 30%), #17172f; }
.login-card { width: min(420px, 100%); padding: 20px; border: 0; border-radius: 22px; box-shadow: 0 28px 80px rgba(0,0,0,.28); animation: card-in .6s var(--ease); }
.login-card h2 { text-align: center; margin-bottom: 24px; }
.error { color: #f56c6c; text-align: center; }
@keyframes card-in { from { opacity: 0; transform: translateY(16px); } }
</style>
