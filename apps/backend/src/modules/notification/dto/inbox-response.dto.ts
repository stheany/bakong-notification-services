import { DateFormatter, PaginationMeta, Language, NotificationType } from '@bakong/shared'
import { BaseResponseDto } from 'src/common/base-response.dto'
import { Message, ApnsConfig } from 'firebase-admin/messaging'
import { ImageService } from '../../image/image.service'
import { TemplateService } from '@/modules/template/template.service'
import { Template } from 'src/entities/template.entity'
import { CategoryType } from '@/entities/category-type.entity'


export interface NotificationData {
  id: number
  templateId: number
  language: string
  notificationType: string

  // ✅ V2 requirement: categoryType is translated display string (not enum, not id)
  categoryType: string
  categoryIcon?: string

  bakongPlatform?: string
  createdDate: string
  timestamp: string
  title: string
  content: string
  imageUrl: string
  linkPreview: string
  sendCount?: number
}

export class InboxResponseDto implements NotificationData {
  id: number
  templateId: number
  language: string
  title: string
  content: string
  imageUrl: string
  linkPreview: string

  notificationType: string
  categoryType: string
  categoryIcon?: string

  bakongPlatform?: string
  createdDate: string
  timestamp: string
  sendCount?: number

  constructor(
    data: Notification,
    language: Language,
    baseUrl: string,
    templateService?: TemplateService,
    imageService?: ImageService,
    req?: any,
  ) {
    const template = (data as any).template as Template | undefined
  
    const userTranslation =
      (template && templateService?.findBestTranslation(template, language)) || null
  
    this.id = Number((data as any).id)
    this.templateId = Number((data as any).templateId || template?.id || 0)
    this.language = String(language)
  
    this.notificationType = ((template as any)?.notificationType ||
      NotificationType.ANNOUNCEMENT) as any

      // ✅ V2 requirement: categoryType MUST be translated display string
      this.categoryType =
        InboxResponseDto.getCategoryDisplayName(template?.categoryTypeEntity, language) || 'Other'

      // ✅ V2 requirement: categoryIcon per record
      this.categoryIcon = baseUrl
        ? InboxResponseDto.buildCategoryIconUrl(
            baseUrl,
            template?.categoryTypeId ?? template?.categoryTypeEntity?.id ?? null,
          )
        : undefined

  
    this.bakongPlatform =
      (template as any)?.bakongPlatform ||
      (data as any)?.userBakongPlatform ||
      'BAKONG'
  
    this.createdDate = DateFormatter.formatDateByLanguage((data as any).createdAt, language)
    this.timestamp = (data as any).createdAt.toISOString()
  
    this.title = userTranslation?.title || ''
    this.content = userTranslation?.content || ''
  
    const imageId =
      (userTranslation as any)?.imageId ??
      (template as any)?.imageId ??
      null
  
    this.imageUrl =
      imageId
        ? (imageService?.buildImageUrl(imageId, req, baseUrl) ||
          `${baseUrl}/api/v1/image/${imageId}`)
        : ''
  
    this.linkPreview = userTranslation?.linkPreview || ''
    console.log('template translations:', (data as any).template?.translations?.length)
    console.log('picked translation:', userTranslation?.language)

  }
  
  // =========================
  // ✅ RESPONSE BUILDERS
  // =========================

  static getResponse(
    data: NotificationData | NotificationData[],
    message: string,
    pagination?: PaginationMeta,
  ) {
    if (!Array.isArray(data)) {
      return BaseResponseDto.success({
        data,
        message,
      })
    }

    const sorted = [...data].sort((a, b) => Number(b.id) - Number(a.id))

    return BaseResponseDto.success({
      data: {
        notifications: sorted,
        ...pagination,
      },
      message,
    })
  }

  static getNotificationCenterResponse(
    notifications: NotificationData | NotificationData[],
    message: string,
    pagination?: PaginationMeta,
    userBakongPlatform?: string,
  ) {
    // ✅ sanitize: categoryType must never be empty
    const sanitized = (notifications as NotificationData[]).map((n) => ({
      ...n,
      categoryType:
        typeof n.categoryType === 'string' && n.categoryType.trim()
          ? n.categoryType
          : 'Other',
    }))
                                                                                                                                 
    const response = this.getResponse(sanitized, message, pagination)

    // attach extra field
    if (userBakongPlatform && response.data && typeof response.data === 'object') {
      ; (response.data as any).userBakongPlatform = userBakongPlatform
    }

    return response
  }

  static getSyncResponse(
    accountId: string,
    bakongPlatform: string,
    dataUpdated: boolean = true,
    syncStatus?: {
      status: 'SUCCESS' | 'FAILED'
      lastSyncAt: string | null
      lastSyncMessage: string | null
    },
  ) {
    return BaseResponseDto.success({
      message: dataUpdated ? 'User data synchronized successfully' : 'User data is already up to date',
      data: {
        accountId,
        bakongPlatform,
        syncedAt: new Date().toISOString(),
        dataUpdated,
        syncStatus: syncStatus || null,
      },
    })
  }

  // =========================
  // ✅ DATA BUILDERS (used by send APIs)
  // =========================

  static buildBaseNotificationData(
    template: any,
    translation: any,
    language: Language,
    imageUrl = '',
    notificationId?: number,
    sendCount?: number,
    baseUrl?: string,
    req?: any,
    categoryIcon?: string,
    failedUsers?: string[],
  ): NotificationData {

    const categoryType = InboxResponseDto.getCategoryDisplayName(
      template?.categoryTypeEntity,
      language,
    )

    const baseData: NotificationData = {
      id: Number(notificationId),
      templateId: Number(template?.id),
      language: String(translation?.language || language),
      notificationType: template?.notificationType,

      // ✅ translated display name
      categoryType,

      // ✅ icon only on v2
      categoryIcon:
        baseUrl
          ? (categoryIcon || InboxResponseDto.buildCategoryIconUrl(baseUrl, template?.categoryTypeId))
          : undefined,


      bakongPlatform: template?.bakongPlatform,
      createdDate: DateFormatter.formatDateByLanguage(new Date(), language),
      timestamp: new Date().toISOString(),
      title: translation?.title || '',
      content: translation?.content || '',
      imageUrl: imageUrl || '',
      linkPreview: translation?.linkPreview || '',
    }

    if (template?.notificationType === NotificationType.FLASH_NOTIFICATION) {
      baseData.sendCount = sendCount || 1
    }

    return baseData
  }

  static buildSendApiNotificationData(
    template: any,
    translation: any,
    language: Language,
    imageUrl = '',
    notificationId?: number,
    sendCount?: number,
    baseUrl?: string,
    req?: any,
    categoryIcon?: string,
    failedUsers?: string[],
  ): NotificationData {
    return this.buildBaseNotificationData(
      template,
      translation,
      language,
      imageUrl,
      notificationId,
      sendCount,
      baseUrl,
      req,
      categoryIcon,
      failedUsers,
    )
  }

  // =========================
  // ✅ CATEGORY HELPERS (single source of truth)
  // =========================

  static getCategoryDisplayName(
    categoryType: CategoryType | undefined,
    lang: Language,
  ): string {
    const defaultOther =
      lang === Language.KM ? 'ផ្សេងៗ'
        : lang === Language.JP ? 'その他'
          : 'Other'

    if (!categoryType) return defaultOther

    const safe = (v?: string) => (typeof v === 'string' ? v.trim() : '')

    if (lang === Language.KM) return safe(categoryType.namekh) || safe(categoryType.name) || defaultOther
    if (lang === Language.JP) return safe(categoryType.namejp) || safe(categoryType.name) || defaultOther
    return safe(categoryType.name) || defaultOther
  }

  private static DEFAULT_OTHER_CATEGORY_ID = 3

  static buildCategoryIconUrl(baseUrl: string, categoryTypeId?: number | null): string {
    const id = categoryTypeId ?? InboxResponseDto.DEFAULT_OTHER_CATEGORY_ID
    return `${baseUrl}/api/v1/category-type/${id}/icon`
  }

  static buildFCMResult(
    mode: 'individual' | 'shared',
    successfulNotifications: any[],
    failedUsers: any[],
    fcmUsers: any[],
    sharedNotificationId?: number,
    sharedSuccessfulCount?: number,
    sharedFailedCount?: number,
    sharedFailedUsers?: Array<{ accountId: string; error: string; errorCode?: string }>,
  ) {
    // Check if failures are due to invalid tokens
    const checkInvalidTokens = (
      users: Array<{ accountId: string; error?: string; errorCode?: string }>,
    ): boolean => {
      if (!users || users.length === 0) return false

      const invalidTokenErrorCodes = [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
        'messaging/invalid-argument',
      ]

      // Check if all failures are due to invalid tokens
      const allInvalidTokens = users.every(
        (u) => u.errorCode && invalidTokenErrorCodes.includes(u.errorCode),
      )

      // Or check if majority are invalid tokens (more than 50%)
      const invalidTokenCount = users.filter(
        (u) => u.errorCode && invalidTokenErrorCodes.includes(u.errorCode),
      ).length
      const majorityInvalidTokens = invalidTokenCount > users.length / 2

      return allInvalidTokens || majorityInvalidTokens
    }

    const allFailedUsers = mode === 'individual' ? failedUsers : sharedFailedUsers || []
    const failedDueToInvalidTokens = checkInvalidTokens(allFailedUsers)

    // Extract error codes for debugging
    const failedUserDetails = allFailedUsers.map((u) => ({
      accountId: u.accountId,
      error: u.error,
      errorCode: u.errorCode,
    }))

    if (mode === 'individual') {
      return {
        notificationId: successfulNotifications.length > 0 ? successfulNotifications[0].id : null,
        successfulCount: successfulNotifications.length,
        failedCount: failedUsers.length,
        failedUsers: failedUsers.map((u) => u.accountId),
        failedDueToInvalidTokens,
        failedUserDetails, // Include detailed error info for debugging
      }
    } else {
      return {
        notificationId: sharedNotificationId || null,
        successfulCount: sharedSuccessfulCount ?? 0,
        failedCount: sharedFailedCount ?? 0,
        failedUsers: (sharedFailedUsers || []).map((u) => u.accountId),
        failedDueToInvalidTokens,
        failedUserDetails, // Include detailed error info for debugging
      }
    }
  }


  static buildAndroidPayload(
    token: string,
    title: string,
    body: string,
    notificationId: string,
    extra?: Record<string, string>,
  ): Message {
    const dataPayload = {
      type: 'NOTIFICATION',
      notificationId,
      title,
      body,
      timestamp: new Date().toISOString(),
      ...(extra ?? {}),
    }

    // ensure all values are string & not undefined
    const safeData: Record<string, string> = {}
    Object.entries(dataPayload).forEach(([k, v]) => {
      if (v === undefined) return
      safeData[k] = String(v ?? '')
    })

    // ensure categoryType never empty
    if (safeData.categoryType !== undefined && !safeData.categoryType.trim()) {
      safeData.categoryType = 'Other'
    }

    return {
      token,
      data: safeData,
      android: { priority: 'high' },
    }
  }

  static buildAndroidDataOnlyPayload(
    token: string,
    title: string,
    body: string,
    notificationId: string,
    extra?: Record<string, any>,
  ): Message {
    const data: Record<string, string> = {
      type: 'NOTIFICATION',
      notificationId: String(notificationId),
      title: String(title),
      body: String(body),
      timestamp: new Date().toISOString(),
      ...(extra
        ? Object.fromEntries(
          Object.entries(extra)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value ?? '')]),
        )
        : {}),
    }

    if (data.categoryType !== undefined && !data.categoryType.trim()) {
      data.categoryType = 'Other'
    }

    return {
      token,
      android: {
        priority: 'high',
        ttl: 3600000,
        collapseKey: `template_${String(extra?.templateId ?? 'unknown')}`,
      },
      data,
    }
  }

  static buildIOSAlertPayload(
    token: string,
    title: string,
    body: string,
    notificationId: string,
    notification?: Record<string, string | number>,
  ): Message {
    const aps: Record<string, any> = {
      alert: { title, body },
      sound: 'default',
      badge: 1,
      type: 'NOTIFICATION',
      notification: notification || [],
    }

    const dataPayload: Record<string, string> = {
      notificationId: String(notificationId),
    }

    if (notification) {
      Object.entries(notification).forEach(([key, value]) => {
        if (value === undefined) return
        if (key === 'type') return
        dataPayload[key] = String(value ?? '')
      })
    }

    dataPayload.type = 'NOTIFICATION'

    // ensure categoryType never empty
    if (dataPayload.categoryType !== undefined && !dataPayload.categoryType.trim()) {
      dataPayload.categoryType = 'Other'
    }

    const apns: ApnsConfig = {
      headers: {
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
      payload: { aps },
    }

    return {
      token,
      notification: { title, body },
      apns,
      data: dataPayload,
    }
  }

  static buildIOSPayload(
    token: string,
    type: NotificationType,
    title: string,
    body: string,
    notificationId: string,
    notification?: Record<string, string | number>,
  ): Message {
    return this.buildIOSAlertPayload(token, title, body, notificationId, notification)
  }
}



