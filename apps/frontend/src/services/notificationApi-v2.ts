import { apiV2, uploadApi } from './api-v2'
import { TimezoneUtils } from '@bakong/shared'
import { getApiPrefix } from './apiPrefix'

export interface CreateTemplateRequestV2 {
  imageId?: string
  platforms: string[]
  bakongPlatform?: string
  sendType: string
  sendInterval?: {
    cron: string
    startAt: string
    endAt: string
  }
  isSent: boolean
  sendSchedule?: string
  translations: {
    language: string
    title: string
    content: string
    image?: string
    linkPreview?: string
  }[]
  notificationType?: string
  categoryTypeId?: number
  priority?: number
  accountIds?: string[]
}
export interface NotificationV2 {
  author: any
  image: string
  id: number | string
  type: string
  title: string
  description: string
  content: string
  status: string
  date: string
  createdAt?: Date
  templateId?: number
  isSent?: boolean
  sendSchedule?: string
  sendType?: string
  sendInterval?: number | { cron: string; startAt: string; endAt: string }
  lastSentAt?: Date
  nextSendAt?: Date
  accountId?: string
  fcmToken?: string
  firebaseMessageId?: number
  sendCount?: number
  templateStartAt?: string
  templateEndAt?: string
}
enum NotificationType {
  FLASH_NOTIFICATION = 'FLASH_NOTIFICATION',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  NOTIFICATION = 'NOTIFICATION',
}
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
export interface NotificationFilters {
  page?: number
  pageSize?: number
  status?: string
  type?: string
  search?: string
  language?: string
}
const toCambodiaTime = (utcDate: Date | string): Date => {
  return TimezoneUtils.toCambodiaTime(utcDate)
}
const formatNotificationDate = (date: Date | string): string => {
  const cambodiaDate = toCambodiaTime(date)
  return cambodiaDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
export interface TestTokenRequest {
  token: string
  bakongPlatform?: string
}
export interface TestTokenResponse {
  isValid: boolean
  formatValid: boolean
  firebaseValid: boolean
  error?: string
  errorCode?: string
  messageId?: string
}
export const testFCMToken = async (data: TestTokenRequest): Promise<TestTokenResponse> => {
  const response = await apiV2.post(`${getApiPrefix()}/notification/test-token`, data)
  console.log('🔍 [testFCMToken] Full API response:', response.data)
  const result = response.data?.data || response.data
  console.log('🔍 [testFCMToken] Parsed result:', result)
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid response structure from token test endpoint')
  }
  return result as TestTokenResponse
}
export interface SyncUsersResponse {
  totalCount: number
  updatedCount: number
  platformUpdates: number
  languageUpdates: number
  invalidTokens: number
  updatedIds: string[]
  updatedIdsCount: number
}
export const syncUsers = async (): Promise<SyncUsersResponse> => {
  const response = await apiV2.post(`${getApiPrefix()}/notification/sync-users`)
  console.log('🔍 [syncUsers] Full API response:', response.data)
  const result = response.data?.data || response.data
  console.log('🔍 [syncUsers] Parsed result:', result)
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid response structure from sync users endpoint')
  }
  return result as SyncUsersResponse
}
export interface InboxRequest {
  fcmToken: string
  accountId: string
  platform?: string
  participantCode?: string
  language?: string
  bakongPlatform: string
  page?: number | null
  size?: number | null
}
export interface InboxSyncResponse {
  accountId: string
  bakongPlatform: string
  syncedAt: string
}
export interface InboxNotificationCenterResponse {
  notifications: any[]
  page: number
  size: number
  itemCount: number
  pageCount: number
  totalCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  userBakongPlatform?: string
}
export const testInbox = async (data: InboxRequest): Promise<any> => {
  const response = await apiV2.post(`${getApiPrefix()}/notification/inbox`, data)
  console.log('🔍 [testInbox] Full API response:', response.data)
  return response.data
}
const mapBackendStatusToFrontend = (backendStatus: string): string => {
  switch (backendStatus) {
    case 'SENT':
      return 'published'
    case 'SCHEDULED':
      return 'scheduled'
    case 'INTERVALED':
      return 'scheduled'
    case 'ERROR':
      return 'draft'
    default:
      return 'draft'
  }
}
const getAuthorName = (template: any): string => {
  if (template.publishedBy) {
    return template.publishedBy
  }
  if (template.updatedBy) {
    return template.updatedBy
  }
  if (template.createdBy) {
    return template.createdBy
  }
  return 'System'
}
export const notificationApi = {
  async getAllNotifications(
    filters: NotificationFilters = {},
  ): Promise<PaginatedResponse<NotificationV2>> {
    try {
      const response = await apiV2.get(`${getApiPrefix()}/template`, {
        params: {
          page: filters.page || 1,
          size: filters.pageSize || 100,
          language: filters.language || 'KM',
          format: 'notification',
          isAscending: false,
        },
      })
      if (response.status === 304) {
        return {
          data: [],
          total: 0,
          page: 1,
          pageSize: 100,
          totalPages: 0,
        }
      }
      let notifications = []
      let meta = null
      if (response.data && Array.isArray(response.data)) {
        notifications = response.data
        meta = {
          page: filters.page || 1,
          size: filters.pageSize || 100,
          itemCount: notifications.length,
          pageCount: 1,
          totalCount: notifications.length,
          hasPreviousPage: false,
          hasNextPage: false,
        }
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        notifications = response.data.data
        meta = response.data.meta
      } else if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
        notifications = response.data.data.data
        meta = response.data.data.meta
      } else if (!response.data) {
        return {
          data: [],
          total: 0,
          page: 1,
          pageSize: 100,
          totalPages: 0,
        }
      } else {
        throw new Error('Invalid response format from backend')
      }
      const mappedNotifications = notifications.map((notification: any) => {
        return {
          id: notification.id,
          author: notification.author,
          title: notification.title,
          description: notification.description,
          content: notification.content,
          image: notification.image,
          date: notification.date,
          status: notification.status,
          type: notification.type,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt,
          templateId: notification.templateId,
          isSent: notification.isSent,
          sendType: notification.sendType,
          scheduledTime: notification.scheduledTime,
          language: notification.language,
          bakongPlatform: notification.bakongPlatform,
        }
      })
      return {
        data: mappedNotifications,
        total: meta?.total || mappedNotifications.length,
        page: meta?.page || 1,
        pageSize: meta?.pageSize || 100,
        totalPages: meta?.totalPages || 1,
      }
    } catch (error: any) {
      console.error('Error fetching notifications:', error)
      if (error.response?.status === 401) {
        console.log('User does not have permission to view notifications')
        return {
          data: [],
          total: 0,
          page: 1,
          pageSize: 100,
          totalPages: 0,
        }
      }
      throw error
    }
  },

  async uploadImage(file: File): Promise<string> {
    try {
      const formData = new FormData()
      formData.append('files', file)
      const response = await apiV2.post(`/api/v1/image/upload`, formData)
      return response.data.data.fileId || response.data.data.files?.[0]?.fileId
    } catch (error) {
      console.error('Error uploading image:', error)
      throw error
    }
  },
  async uploadImages(
    items: { file: File; language?: string }[] | File[],
  ): Promise<{ language?: string; fileId: string; mimeType: string; originalFileName: string }[]> {
    try {
      const formData = new FormData()
      const normalized: { file: File; language?: string }[] =
        Array.isArray(items) && (items as any[])[0] && (items as any[])[0].file
          ? (items as any)
          : (items as File[]).map((f) => ({ file: f }))
      const MAX_TOTAL_SIZE = 18 * 1024 * 1024 // 18MB
      const MAX_SINGLE_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file (backend limit)
      let totalSize = 0
      const sizeErrors: string[] = []
      normalized.forEach((item, index) => {
        const fileSize = item.file.size
        if (fileSize > MAX_SINGLE_FILE_SIZE) {
          sizeErrors.push(
            `File ${index + 1} (${item.file.name}) is ${(fileSize / 1024 / 1024).toFixed(2)}MB, exceeds 10MB limit`,
          )
        }
        totalSize += fileSize
      })
      if (totalSize > MAX_TOTAL_SIZE) {
        const totalMB = (totalSize / 1024 / 1024).toFixed(2)
        throw new Error(
          `Total upload size (${totalMB}MB) exceeds limit (18MB). Please compress images further or upload fewer images.`,
        )
      }
      if (sizeErrors.length > 0) {
        throw new Error(sizeErrors.join('; '))
      }
      const languages: string[] = []
      normalized.forEach((item) => {
        formData.append('files', item.file)
        if (item.language) languages.push(item.language)
      })
      if (languages.length) {
        formData.append('languages', JSON.stringify(languages))
      }
        const response = await apiV2.post(`/api/v1/image/upload`, formData)
      return (
        response.data.data.files ||
        (response.data.data.fileId
          ? [
              {
                language: languages[0],
                fileId: response.data.data.fileId,
                mimeType: normalized[0].file.type,
                originalFileName: normalized[0].file.name,
              },
            ]
          : [])
      )
    } catch (error) {
      console.error('Error uploading images:', error)
      throw error
    }
  },
  
  async sendNotification(
    templateId: number,
    notificationType?: string,
    publishNow?: boolean,
    accountId?: string | string[],
  ): Promise<any> {
    try {
      const payload: any = { templateId }
  
      if (notificationType) payload.notificationType = notificationType
      if (publishNow === true) payload.publishNow = true
      if (accountId !== undefined) payload.accountId = accountId
  
      const response = await apiV2.post(
        `${getApiPrefix()}/notification/send`,
        payload,
      )
      return response.data
    } catch (error) {
      console.error('[notificationApi-v2] sendNotification error:', error)
      throw error
    }
  }
  

}
