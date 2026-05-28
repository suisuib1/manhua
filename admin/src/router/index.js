import { createRouter, createWebHistory } from 'vue-router'
import { setUnauthorizedHandler } from '../utils/request'
import { useAuthStore } from '../stores/auth'
import AdminLayout from '../layouts/AdminLayout.vue'
import AdminUserDetail from '../pages/AdminUserDetail.vue'
import AdminUsers from '../pages/AdminUsers.vue'
import ComicChapterDetail from '../pages/ComicChapterDetail.vue'
import ComicChapters from '../pages/ComicChapters.vue'
import Dashboard from '../pages/Dashboard.vue'
import GenerationTaskDetail from '../pages/GenerationTaskDetail.vue'
import GenerationTasks from '../pages/GenerationTasks.vue'
import Login from '../pages/Login.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: {
        guestOnly: true,
      },
    },
    {
      path: '/',
      component: AdminLayout,
      meta: {
        requiresAuth: true,
      },
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: Dashboard,
        },
        {
          path: 'users',
          name: 'adminUsers',
          component: AdminUsers,
        },
        {
          path: 'users/:id',
          name: 'adminUserDetail',
          component: AdminUserDetail,
        },
        {
          path: 'generation-tasks',
          name: 'generationTasks',
          component: GenerationTasks,
        },
        {
          path: 'generation-tasks/:id',
          name: 'generationTaskDetail',
          component: GenerationTaskDetail,
        },
        {
          path: 'comic-chapters',
          name: 'comicChapters',
          component: ComicChapters,
        },
        {
          path: 'comic-chapters/:diaryEntryId',
          name: 'comicChapterDetail',
          component: ComicChapterDetail,
        },
      ],
    },
  ],
})

let adminChecked = false

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.guestOnly && auth.isLoggedIn) {
    return '/dashboard'
  }

  if (!to.meta.requiresAuth) {
    return true
  }

  if (!auth.isLoggedIn) {
    return '/login'
  }

  if (!adminChecked) {
    try {
      await auth.fetchMe()
      adminChecked = true
    } catch (err) {
      auth.logout()
      return '/login'
    }
  }

  return true
})

setUnauthorizedHandler(() => {
  const auth = useAuthStore()
  adminChecked = false
  auth.logout()
  if (router.currentRoute.value.path !== '/login') {
    router.replace('/login')
  }
})

export default router
