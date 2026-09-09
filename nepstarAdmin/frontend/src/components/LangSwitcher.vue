<template>
  <el-dropdown @command="switchLang">
    <el-button type="text">
      {{ labels[appStore.language] }}
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="zh-CN">中文</el-dropdown-item>
        <el-dropdown-item command="en">English</el-dropdown-item>
        <el-dropdown-item command="es">Español</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
const labels: Record<string, string> = { 'zh-CN': '中文', en: 'English', es: 'Español' };

function switchLang(lang: string) {
  appStore.setLanguage(lang);
}
</script>
