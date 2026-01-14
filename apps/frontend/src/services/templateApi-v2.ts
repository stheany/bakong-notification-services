import { NotificationType } from '@bakong/shared'
import { apiV2 } from './api-v2'
import type { CreateTemplateRequestV2, NotificationFilters, NotificationV2, PaginatedResponse } from './notificationApi-v2'
import { getApiPrefix } from './apiPrefix'

export interface TemplateV2 {
  id: number
  title: string
  content: string
  image?: string
  sendType: string
  createdAt: string
  updatedAt: string
  translations?: Array<{
    title: string
    content: string
  }>
}

export const templateApi = {
  async getTemplateById(id: number): Promise<TemplateV2> {
    try {
      const response = await apiV2.get(`${getApiPrefix()}/template/${id}`)
      return response.data
    } catch (error) {
      console.error('Error fetching template:', error)
      throw error
    }
  },

  async deleteTemplate(id: number): Promise<boolean> {
    try {
      await apiV2.delete(`${getApiPrefix()}/template/${id}`)
      return true
    } catch (error) {
      console.error('Error deleting template:', error)
      throw error
    }
  },

  async updateNotification(id: number, notification: Partial<NotificationV2>): Promise<NotificationV2> {
    const response = await apiV2.post(`${getApiPrefix()}/template/${id}/update`, notification)
    return response.data
  },
  async deleteNotification(id: number): Promise<void> {
    try {
      await apiV2.post(`${getApiPrefix()}/template/${id}/remove`)
    } catch (error) {
      console.error('Error deleting notification:', error)
      throw error
    }
  },
  async sendNotificationNow(id: number): Promise<void> {
    await apiV2.post(`${getApiPrefix()}/template/${id}/send-now`)
  },
  async scheduleNotification(id: number, scheduleTime: string): Promise<void> {
    await apiV2.post(`${getApiPrefix()}/template/${id}/schedule`, { scheduleTime })
  },
  async updateTemplate(id: number, templateData: CreateTemplateRequestV2): Promise<any> {
    try {
      const sanitizedData = {
        ...templateData,
        translations: templateData.translations?.map((t) => ({
          language: t.language,
          title: t.title,
          content: t.content,
          image: typeof t.image === 'string' ? t.image : '', // Ensure image is only a string (fileId), not a File or Buffer
          linkPreview: t.linkPreview,
        })),
      }
      const response = await apiV2.post(`${getApiPrefix()}/template/${id}/update`, sanitizedData, {
        timeout: 60000,
      })
      return response.data
    } catch (error: any) {
      console.error(`Error updating template ${id}:`, error)
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        status: error.response?.status,
      })
      throw error
    }
  },
  async getNotifications(
    filters: NotificationFilters = {},
  ): Promise<PaginatedResponse<NotificationV2>> {
    try {
      const response = await apiV2.get(`${getApiPrefix()}/template/all`)
      if (Array.isArray(response.data)) {
        const notifications = response.data
          .map((template: any) => {
            const translation = template.translations?.[0]
            if (!translation) return null
            return {
              id: template.templateId || template.id,
              author: getAuthorName(template),
              title: translation.title,
              description: translation.content,
              content: translation.content,
              image: translation.image ? `${getApiPrefix()}/image/${translation.image.fileId}` : '',
              linkPreview: translation.linkPreview,
              date: template.date,
              status: template.status || (template.isSent
                ? 'published'
                : template.sendType === 'SEND_SCHEDULE' || template.sendType === 'SEND_INTERVAL'
                  ? 'scheduled'
                  : 'draft'),
              type: template.notificationType,
              createdAt: template.createdAt,
              templateId: template.templateId || template.id,
              isSent: template.isSent,
              sendType: template.sendType,
            }
          })
          .filter(Boolean)
        let filteredNotifications = notifications.filter((n) => n !== null) as NotificationV2[]
        if (filters.status) {
          filteredNotifications = filteredNotifications.filter((n) => n.status === filters.status)
        }
        if (filters.type) {
          filteredNotifications = filteredNotifications.filter((n) => n.type === filters.type)
        }
        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          filteredNotifications = filteredNotifications.filter(
            (n) =>
              n.title.toLowerCase().includes(searchLower) ||
              n.description.toLowerCase().includes(searchLower) ||
              n.type.toLowerCase().includes(searchLower),
          )
        }
        const page = filters.page || 1
        const pageSize = filters.pageSize || 10
        const startIndex = (page - 1) * pageSize
        const endIndex = startIndex + pageSize
        const paginatedData = filteredNotifications.slice(startIndex, endIndex)
        return {
          data: paginatedData,
          total: filteredNotifications.length,
          page,
          pageSize,
          totalPages: Math.ceil(filteredNotifications.length / pageSize),
        }
      }
      return {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      }
    } catch (error: any) {
      console.error('Error fetching notifications:', error)
      throw error
    }
  },
  async getNotificationById(id: number): Promise<NotificationV2> {
    const response = await apiV2.get(`${getApiPrefix()}/template/${id}`)
    const template = response.data
    const translation = template.translations?.[0]
    return {
      id: template.id,
      type: template.notificationType || template.categoryType || NotificationType.ANNOUNCEMENT,
      title: translation?.title || 'Notification',
      description: translation?.content || 'No content available',
      content: translation?.content || 'No content available',
      status: template.isSent ? 'SENT' : 'SCHEDULED',
      date: template.date,
      createdAt: template.createdAt,
      templateId: template.id,
      isSent: template.isSent,
      sendSchedule: template.sendSchedule,
      author: getAuthorName(template),
      image: '',
    }
  },
  async createNotification(notification: Omit<NotificationV2, 'id'>): Promise<NotificationV2> {
    const response = await apiV2.post(`${getApiPrefix()}/template/create`, notification)
    return response.data
  },
  async createTemplate(templateData: CreateTemplateRequestV2): Promise<any> {
    try {
      const response = await apiV2.post(`${getApiPrefix()}/template/create`, templateData)
      return response.data
    } catch (error: any) {
      console.error('Error creating template:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        status: error.response?.status,
      })
      throw error
    }
  },
  
}
function getAuthorName(template: any): any {
  throw new Error('Function not implemented.')
}

