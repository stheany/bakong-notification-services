import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { getApiPrefix } from './apiPrefix'

// In dev mode, uses Vite proxy (configured in vite.config.ts)
// In production, uses VITE_API_BASE_URL environment variable
// Empty string means use relative URLs (same protocol as page)
const API_BASE_URL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_API_BASE_URL !== undefined && import.meta.env.VITE_API_BASE_URL !== null
    ? import.meta.env.VITE_API_BASE_URL
    : 'http://localhost:4004'

// Helper function to clear auth state (both localStorage and store)
const clearAuthState = () => {
  try {
    const authStore = useAuthStore()
    authStore.logout()
  } catch (e) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
  }
}

export const apiV2 = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const uploadApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
})

const addAuthInterceptor = (axiosInstance: typeof apiV2) => {
  axiosInstance.interceptors.request.use(
    async (config) => {
      // Always put api-key for auth + notification endpoints (both v1/v2)
      if (
        config.url?.includes('/auth/login') ||
        config.url?.includes('/auth/register') ||
        config.url?.includes('/notification/')
      ) {
        config.headers['x-api-key'] = 'BAKONG'
      }

      // Skip bearer token only for login/register
      if (!config.url?.includes('/auth/login') && !config.url?.includes('/auth/register')) {
        const token = localStorage.getItem('auth_token')

        if (token && token.trim() !== '') {
          const tokenParts = token.split('.')
          if (tokenParts.length === 3) {
            try {
              const payload = JSON.parse(atob(tokenParts[1]))
              const now = Math.floor(Date.now() / 1000)

              if (payload.exp && payload.exp < now) {
                clearAuthState()
                return Promise.reject(new Error('Token expired. Please login again.'))
              }

              config.headers.Authorization = `Bearer ${token}`
            } catch (e) {
              clearAuthState()
              return Promise.reject(new Error('Invalid token. Please login again.'))
            }
          } else {
            clearAuthState()
            return Promise.reject(new Error('Invalid token format. Please login again.'))
          }
        } else {
          clearAuthState()
          return Promise.reject(new Error('No authentication token found. Please login.'))
        }
      }

      return config
    },
    (error) => Promise.reject(error),
  )
}

addAuthInterceptor(apiV2)
addAuthInterceptor(uploadApi)

const addResponseInterceptor = (axiosInstance: typeof apiV2) => {
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const isAuthEndpoint =
        error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register')
      const isChangePasswordEndpoint = error.config?.url?.includes('/auth/change-password')
      const currentToken = localStorage.getItem('auth_token')
      const isOnAuthPage =
        window.location.pathname.includes('/login') ||
        window.location.pathname.includes('/register')

      if (error.response?.status === 401) {
        if (isChangePasswordEndpoint) return Promise.reject(error)
        if (isAuthEndpoint) return Promise.reject(error)

        clearAuthState()
        if (!isOnAuthPage) window.location.href = '/login'
        return Promise.reject(error)
      }

      if (error.response?.status === 500 && currentToken && !isAuthEndpoint) {
        try {
          const tokenParts = currentToken.split('.')
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]))
            const now = Math.floor(Date.now() / 1000)

            if (payload.exp && payload.exp < now) {
              clearAuthState()
              if (!isOnAuthPage) window.location.href = '/login'
              return Promise.reject(new Error('Token expired. Please login again.'))
            }
          } else {
            clearAuthState()
            if (!isOnAuthPage) window.location.href = '/login'
            return Promise.reject(new Error('Invalid token format. Please login again.'))
          }
        } catch (e) {
          clearAuthState()
          if (!isOnAuthPage) window.location.href = '/login'
          return Promise.reject(new Error('Invalid token. Please login again.'))
        }
      }

      return Promise.reject(error)
    },
  )
}

addResponseInterceptor(apiV2)
addResponseInterceptor(uploadApi)

// ✅ AUTH API now respects toggle v1/v2
export const authApi = {
  login: (credentials: { username: string; password: string }) => {
    const formData = new URLSearchParams()
    formData.append('username', credentials.username)
    formData.append('password', credentials.password)

    const requestConfig = {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }

    return apiV2.post(`${getApiPrefix()}/auth/login`, formData.toString(), requestConfig)
  },

  register: (userData: { username: string; password: string; displayName: string; role: string }) =>
    apiV2.post(`${getApiPrefix()}/auth/register`, userData),

  logout: () => apiV2.post(`${getApiPrefix()}/auth/logout`),

  refreshToken: () => apiV2.post(`${getApiPrefix()}/auth/refresh`),

  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('files', file)
    return uploadApi.post(`${getApiPrefix()}/auth/upload-avatar`, formData)
  },
}

// (Optional) if you still use these older notification endpoints
export const notificationApi = {
  getNotifications: (params?: { page?: number; limit?: number }) =>
    apiV2.get(`${getApiPrefix()}/notifications`, { params }),

  sendNotification: (data: any) => apiV2.post(`${getApiPrefix()}/notifications`, data),

  getNotificationById: (id: string) => apiV2.get(`${getApiPrefix()}/notifications/${id}`),
}

export const templateApi = {
  getTemplateById: (id: number) => apiV2.get(`${getApiPrefix()}/template/${id}`),
  deleteTemplate: (id: number) => apiV2.delete(`${getApiPrefix()}/template/${id}/remove`),
  updateTemplate: (id: number, data: any) => apiV2.put(`${getApiPrefix()}/template/${id}`, data),
  createTemplate: (data: any) => apiV2.post(`${getApiPrefix()}/template`, data),
}

export const categoryTypeApi = {
  findAll: () => apiV2.get(`${getApiPrefix()}/category-type`),
  getIcon: (id: number) => apiV2.get(`${getApiPrefix()}/category-type/${id}/icon`),
  findOne: (id: number) => apiV2.get(`${getApiPrefix()}/category-type/${id}`),
  create: (data: any) => apiV2.post(`${getApiPrefix()}/category-type`, data),
  update: (id: number, data: any) => apiV2.put(`${getApiPrefix()}/category-type/${id}`, data),
  remove: (id: number) => apiV2.delete(`${getApiPrefix()}/category-type/${id}`),
}

export const homeApi = {
  getHomeData: () => apiV2.get(`${getApiPrefix()}/home`),
}

export const managementApi = {
  healthCheck: () => apiV2.get(`${getApiPrefix()}/management/healthcheck`),
}

export default apiV2
