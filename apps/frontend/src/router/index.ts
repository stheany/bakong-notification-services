import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, UserRole } from '@/stores/auth'

const isApiV2Enabled = () => {
  const apiVersion = localStorage.getItem('api_version')
  const useApiV2 = localStorage.getItem('USE_API_V2')
  return apiVersion === 'v2' || useApiV2 === 'true' || useApiV2 === '1'
}

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_URL || '/'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('../views/ChangePasswordView.vue'),
      meta: { requiresAuth: true },
    },

    {
      path: '/',
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        // -------------------
        // V1 ROUTES
        // -------------------
        {
          path: '',
          name: 'home',
          component: () => import('../views/HomeView.vue'),
        },
        {
          path: 'schedule',
          name: 'schedule',
          component: () => import('../views/ScheduleView.vue'),
        },
        {
          path: 'schedule/:id',
          name: 'schedule-detail',
          component: () => import('../views/ScheduleDetailView.vue'),
        },
        {
          path: 'category-type',
          name: 'category-type',
          component: () => import('../views/TypeView.vue'),
        },
        {
          path: 'notifications/create',
          name: 'create-notification',
          component: () => import('../views/CreateNotificationView.vue'),
        },
        {
          path: 'notifications/edit/:id',
          name: 'edit-notification',
          component: () => import('../views/CreateNotificationView.vue'),
        },

        // -------------------
        // COMMON ROUTES
        // -------------------
        {
          path: 'users',
          name: 'users',
          component: () => import('../views/UsersView.vue'),
          meta: { requiredRole: UserRole.ADMIN_USER },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/SettingView.vue'),
        },
        {
          path: 'settings/change-password',
          name: 'settings-change-password',
          component: () => import('../views/SettingChangePasswordView.vue'),
        },
        {
          path: 'settings/change-profile',
          name: 'settings-change-profile',
          component: () => import('../views/SettingChangeProfileView.vue'),
        },
        {
          path: 'profile-notification-setup',
          name: 'profile-notification-setup',
          component: () => import('../views/ProfileNotificationSetup.vue'),
        },

        // -------------------
        // V2 ROUTES
        // NOTE: child routes must NOT start with "/"
        // -------------------
        {
          path: 'v2',
          name: 'home-v2',
          component: () => import('../views/HomeView-v2.vue'),
        },
        {
          path: 'v2/category-type',
          name: 'category-type-v2',
          component: () => import('../views/TypeView-v2.vue'),
        },
        {
          path: 'v2/notifications/create',
          name: 'create-notification-v2',
          component: () => import('../views/CreateNotificationView-v2.vue'),
        },
        {
          path: 'v2/notifications/edit/:id',
          name: 'edit-notification-v2',
          component: () => import('../views/CreateNotificationView-v2.vue'),
        },

        // -------------------
        // USER MANAGEMENT ROUTES
        // -------------------
        {
          path: 'users/create',
          name: 'create-user',
          component: () => import('../views/CreateUserView.vue'),
          meta: {
            requiredRole: UserRole.ADMIN_USER,
            breadcrumb: {
              label: 'Create User',
              parent: { name: 'user-management', label: 'Users' },
            },
          },
        },
        {
          path: 'users/view/:id',
          name: 'view-user',
          component: () => import('../views/CreateUserView.vue'),
          meta: {
            requiredRole: UserRole.ADMIN_USER,
            breadcrumb: {
              label: 'View User',
              parent: { name: 'user-management', label: 'Users' },
            },
          },
        },
        {
          path: 'users/edit/:id',
          name: 'edit-user',
          component: () => import('../views/CreateUserView.vue'),
          meta: {
            requiredRole: UserRole.ADMIN_USER,
            breadcrumb: {
              label: 'Edit User',
              parent: { name: 'user-management', label: 'Users' },
            },
          },
        },
        {
          path: 'user-management',
          name: 'user-management',
          component: () => import('../views/UserManagementView.vue'),
          meta: {
            requiredRole: UserRole.ADMIN_USER,
            breadcrumb: { label: 'User Management' },
          },
        },
      ],
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // -------------------
  // AUTH GUARD (your original logic)
  // -------------------
  if (to.meta.requiresAuth) {
    const storedToken = localStorage.getItem('auth_token')
    if (!storedToken) {
      // No token found
    }

    if (!authStore.token || !authStore.user) {
      try {
        await authStore.initializeAuth()
      } catch (error) {
        console.error('Auth initialization failed:', error)
        next('/login')
        return
      }
    }
  }

  const isAuthenticated = authStore.isAuthenticated

  if (to.meta.requiresAuth && !isAuthenticated) {
    if (authStore.token && !authStore.user) {
      authStore.logout()
    }
    next('/login')
    return
  }

  const requiredRole =
    to.meta.requiredRole || to.matched.find((route) => route.meta.requiredRole)?.meta.requiredRole
  if (requiredRole && isAuthenticated) {
    const userRole = authStore.user?.role
    if (!userRole || userRole !== requiredRole) {
      console.log('Router guard - insufficient permissions, redirecting to dashboard')
      next('/')
      return
    }
  }

  if ((to.name === 'login' || to.name === 'register') && isAuthenticated) {
    next('/')
    return
  }

  if (
    to.meta.requiresAuth === false &&
    !isAuthenticated &&
    to.name !== 'login' &&
    to.name !== 'register'
  ) {
    next()
    return
  }

  // -------------------
  // API VERSION ROUTING (NEW)
  // -------------------
  const v2Enabled = isApiV2Enabled()

  const V1_TO_V2: Record<string, string> = {
    home: 'home-v2',
    'category-type': 'category-type-v2',
    'create-notification': 'create-notification-v2',
    'edit-notification': 'edit-notification-v2',
  }

  const V2_TO_V1: Record<string, string> = {
    'home-v2': 'home',
    'category-type-v2': 'category-type',
    'create-notification-v2': 'create-notification',
    'edit-notification-v2': 'edit-notification',
  }

  if (v2Enabled && to.name && V1_TO_V2[String(to.name)]) {
    const targetName = V1_TO_V2[String(to.name)]
    return next({ name: targetName, params: to.params, query: to.query })
  }

  if (!v2Enabled && to.name && V2_TO_V1[String(to.name)]) {
    const targetName = V2_TO_V1[String(to.name)]
    return next({ name: targetName, params: to.params, query: to.query })
  }

  next()
})

export default router
