import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router/index.js'
import './styles/styles.css'
import './styles/overrides.css'
import './styles/score-colors.css'

createApp(App).use(router).mount('#app')
