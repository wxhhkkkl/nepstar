<template>
  <el-menu
    :default-active="route.path"
    router
    background-color="transparent"
    text-color="#76d4d7"
    active-text-color="#ffffff"
    class="side-menu"
  >
    <template v-for="menu in authStore.menus" :key="menu.id">
      <el-sub-menu v-if="menu.children && menu.children.length" :index="String(menu.id)" popper-class="side-popper">
        <template #title><span class="menu-title">{{ menuName(menu) }}</span></template>
        <el-menu-item v-for="child in menu.children" :key="child.id" :index="child.route_path || ''">
          <span class="sub-title">{{ menuName(child) }}</span>
        </el-menu-item>
      </el-sub-menu>
      <el-menu-item v-else :index="menu.route_path || ''">
        <span class="menu-title">{{ menuName(menu) }}</span>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useAppStore } from '@/stores/app';

const route = useRoute();
const authStore = useAuthStore();
const appStore = useAppStore();

function menuName(menu: any): string {
  const lang = appStore.language;
  return lang === 'en' ? menu.name_en : lang === 'es' ? menu.name_es : menu.name_zh;
}
</script>

<style>
.side-menu { border-right: none !important; padding: 8px 0; flex: 1; overflow-y: auto; }
.side-menu .el-menu-item,
.side-menu .el-sub-menu__title { position: relative; height: 46px; line-height: 46px; margin: 3px 12px; border-radius: 11px; font-size: 13px; font-weight: 550; padding-left: 16px !important; transition: color .2s ease, background .2s ease, transform .25s var(--ease); }
.side-menu .el-menu-item:hover,
.side-menu .el-sub-menu__title:hover { background: rgba(255,255,255,.07) !important; transform: translateX(2px); }
.side-menu .el-menu-item.is-active { background: linear-gradient(100deg, var(--sidebar-active), #7a70df) !important; color: #fff !important; box-shadow: 0 8px 20px rgba(80,75,190,.3); }
.side-menu .el-menu-item.is-active::before { position: absolute; left: 0; width: 3px; height: 18px; border-radius: 0 4px 4px 0; background: white; content: ""; }
.side-menu .el-menu { background: transparent !important; }
.side-menu .el-menu .el-menu-item { padding-left: 42px !important; font-size: 12px; }
.menu-title, .sub-title { display: inline-block; }
.side-popper { background: #312e81 !important; border: none !important; }
.side-popper .el-menu-item { background: transparent !important; color: #c7d2fe !important; }
.side-popper .el-menu-item:hover { background: rgba(255,255,255,.1) !important; color: #fff !important; }
</style>
