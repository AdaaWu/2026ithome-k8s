import { createApp } from 'vue'
import App from './presentation/App.vue'
import router from './router'
import './presentation/styles/global.css'

createApp(App).use(router).mount('#app')
