import { createRouter, createWebHashHistory } from 'vue-router'
import { useGame } from '@/application/useGame'
import TitleView from '@/presentation/views/TitleView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'title', component: TitleView },
    { path: '/map', name: 'map', component: () => import('@/presentation/views/MapView.vue') },
    { path: '/day/:n(\\d+)', name: 'day', component: () => import('@/presentation/views/DayView.vue'), props: (r) => ({ day: Number(r.params.n) }) },
    { path: '/codex', name: 'codex', component: () => import('@/presentation/views/CodexView.vue') },
    { path: '/ruler', name: 'ruler', component: () => import('@/presentation/views/RulerView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// 還沒取暱稱就先回起始畫面
router.beforeEach((to) => {
  const { progress } = useGame()
  if (to.name !== 'title' && !progress.value.nickname) return { name: 'title' }
})

export default router
