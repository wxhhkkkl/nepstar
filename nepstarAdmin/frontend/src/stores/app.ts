import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  const language = ref(localStorage.getItem('lang') || 'zh-CN');
  const sidebarCollapsed = ref(false);

  function setLanguage(lang: string) {
    language.value = lang;
    localStorage.setItem('lang', lang);
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  return { language, sidebarCollapsed, setLanguage, toggleSidebar };
});
