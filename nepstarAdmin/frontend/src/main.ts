import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import './styles/theme.css';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
import { createI18n } from 'vue-i18n';
import zhCN from './i18n/zh-CN.json';
import en from './i18n/en.json';
import es from './i18n/es.json';
import App from './App.vue';
import router from './router';

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('lang') || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zhCN, en, es },
});

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.use(i18n);
app.mount('#app');
