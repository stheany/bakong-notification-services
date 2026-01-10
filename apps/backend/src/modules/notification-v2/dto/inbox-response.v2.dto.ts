import { NotificationV2 } from 'src/entities/notification.v2.entity'
import { DateFormatter, PaginationMeta, Language, NotificationType } from '@bakong/shared'
import { BaseResponseDto } from 'src/common/base-response.dto'
import { Message, ApnsConfig } from 'firebase-admin/messaging'
import { ImageService } from '../../image/image.service'
import { TemplateServiceV2 } from '@/modules/template-v2/template.v2.service'
import { CategoryTypeV2 } from '@/entities/category-type-v2.entity'

export interface NotificationDataV2 {
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

export class InboxResponseDtoV2 implements NotificationDataV2 {
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
    data: NotificationV2,
    language: Language,
    baseUrl: string,
    templateServiceV2?: TemplateServiceV2,
    imageService?: ImageService,
    req?: any,
  ) {
    const isV2 = InboxResponseDtoV2.isV2Request(req)
    const userTranslation =
      templateServiceV2?.findBestTranslation(data.template, language) ||
      data.template?.translations?.find((t) => t.language === language) ||
      data.template?.translations?.[0] ||
      null

    this.id = Number(data.id)
    this.templateId = Number(data.templateId || 0)
    this.language = String(language)

    // ✅ safe notificationType
    this.notificationType = (data.template?.notificationType ||
      NotificationType.ANNOUNCEMENT) as any

    // ✅ V2 requirement: categoryType MUST be translated display string
    this.categoryType =
      InboxResponseDtoV2.getCategoryDisplayName(data.template?.categoryTypeEntity, language) || 'Other'


    // ✅ V2: include icon url if have categoryTypeId
    if (isV2) {
      this.categoryIcon = InboxResponseDtoV2.buildCategoryIconUrl(baseUrl, data.template?.categoryTypeId)
    }

    this.bakongPlatform =
      data.template?.bakongPlatform ||
      (data as any)?.userBakongPlatform ||   // if you pass it in
      'BAKONG'


    this.createdDate = DateFormatter.formatDateByLanguage(data.createdAt, language)
    this.timestamp = data.createdAt.toISOString()

    this.title = userTranslation?.title || ''
    this.content = userTranslation?.content || ''

    const imageId =
      (userTranslation as any)?.imageId ??
      (data.template as any)?.imageId ??
      null

    this.imageUrl =
      imageId
        ? (imageService?.buildImageUrl(imageId, req, baseUrl) ||
          `${baseUrl}/api/v1/image/${imageId}`)
        : ''

    this.linkPreview = userTranslation?.linkPreview || ''
  }

  // =========================
  // ✅ RESPONSE BUILDERS
  // =========================

  static getResponse(
    data: NotificationDataV2 | NotificationDataV2[],
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
    notifications: NotificationDataV2[],
    message: string,
    pagination?: PaginationMeta,
    userBakongPlatform?: string,
  ) {
    // ✅ sanitize: categoryType must never be empty
    const sanitized = notifications.map((n) => ({
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
  ): NotificationDataV2 {
    const isV2 = InboxResponseDtoV2.isV2Request(req)

    const categoryType = InboxResponseDtoV2.getCategoryDisplayName(
      template?.categoryTypeEntity,
      language,
    )

    const baseData: NotificationDataV2 = {
      id: Number(notificationId),
      templateId: Number(template?.id),
      language: String(translation?.language || language),
      notificationType: template?.notificationType,

      // ✅ translated display name
      categoryType,

      // ✅ icon only on v2
      categoryIcon:
        isV2 && baseUrl
          ? (categoryIcon || InboxResponseDtoV2.buildCategoryIconUrl(baseUrl, template?.categoryTypeId))
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
    categoryIcon?: string
  ): NotificationDataV2 {
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
    )
  }

  // =========================
  // ✅ CATEGORY HELPERS (single source of truth)
  // =========================

  static getCategoryDisplayName(
    category: CategoryTypeV2 | undefined,
    lang: Language,
  ): string {
    const defaultOther =
      lang === Language.KM ? 'ផ្សេងៗ'
        : lang === Language.JP ? 'その他'
          : 'Other'

    if (!category) return defaultOther

    const safe = (v?: string) => (typeof v === 'string' ? v.trim() : '')

    if (lang === Language.KM) return safe(category.namekh) || safe(category.name) || defaultOther
    if (lang === Language.JP) return safe(category.namejp) || safe(category.name) || defaultOther
    return safe(category.name) || defaultOther
  }

  private static DEFAULT_OTHER_CATEGORY_ID = 3

  static buildCategoryIconUrl(baseUrl: string, categoryTypeId?: number | null): string {
    const id = categoryTypeId ?? InboxResponseDtoV2.DEFAULT_OTHER_CATEGORY_ID
    return `${baseUrl}/api/v1/category-type/${id}/icon`
  }


  private static isV2Request(req?: any): boolean {
    return (
      req?.version === '2' ||
      String(req?.url || '').includes('/v2/') ||
      String(req?.originalUrl || '').includes('/v2/')
    )
  }

  // =========================
  // ✅ FCM BUILDERS (unchanged, but keep safe)
  // =========================


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



