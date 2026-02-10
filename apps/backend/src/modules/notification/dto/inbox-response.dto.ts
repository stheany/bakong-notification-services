import {
  DateFormatter,
  PaginationMeta,
  Language,
  NotificationType,
  BakongApp,
} from '@bakong/shared';
import { BaseResponseDto } from 'src/common/base-response.dto';
import { Message, ApnsConfig } from 'firebase-admin/messaging';
import { ImageService } from '../../image/image.service';
import { TemplateService } from '@/modules/template/template.service';
import { Template } from 'src/entities/template.entity';
import { CategoryType } from '@/entities/category-type.entity';
import { Notification } from 'src/entities/notification.entity';
export interface NotificationData {
  id: number;
  templateId: number;
  language: string;
  notificationType: string;
  categoryType: string;
  categoryIcon?: string;
  bakongPlatform?: string;
  createdDate: string;
  timestamp: string;
  title: string;
  content: string;
  imageUrl: string;
  linkPreview: string;
  sendCount?: number;
}
export class InboxResponseDto implements NotificationData {
  id: number;
  templateId: number;
  language: string;
  title: string;
  content: string;
  imageUrl: string;
  linkPreview: string;
  notificationType: string;
  categoryType: string;
  categoryIcon?: string;
  bakongPlatform?: string;
  createdDate: string;
  timestamp: string;
  sendCount?: number;
  constructor(
    data: Notification,
    language: Language,
    baseUrl: string,
    templateService?: TemplateService,
    imageService?: ImageService,
    req?: any
  ) {
    const template = (data as any).template as Template | undefined;
    const userTranslation =
      (template && templateService?.findBestTranslation(template, language)) ||
      null;
    this.id = Number((data as any).id);
    this.templateId = Number((data as any).templateId || template?.id || 0);
    const isV2 =
      (req as any)?.version === '2' ||
      req?.url?.includes('/v2/') ||
      req?.originalUrl?.includes('/v2/');
    let storedLanguage: Language = Language.KM; // Default to KM
    if ((data as any).language) {
      storedLanguage = (data as any).language as Language;
    } else if (userTranslation) {
      storedLanguage = userTranslation.language as Language;
    }
    this.language = String(storedLanguage);
    let displayLanguage: Language = language;
    if (template?.translations && Array.isArray(template.translations)) {
      const userLangExists = template.translations.some(
        (t: any) => t.language === language
      );
      if (!userLangExists) {
        displayLanguage = Language.KM;
      }
    } else {
      displayLanguage = Language.KM;
    }
    try {
      if (storedLanguage === Language.EN) {
        displayLanguage = Language.EN;
      }
    } catch (e) {}
    try {
      if ((template as any)?.bakongPlatform === BakongApp.BAKONG_TOURIST) {
        displayLanguage = Language.EN;
      }
    } catch (e) {}
    const userLangTranslation =
      template && templateService?.findBestTranslation(template, language);
    this.notificationType = ((template as any)?.notificationType ||
      NotificationType.ANNOUNCEMENT) as any;
    if (isV2) {
      this.categoryType =
        InboxResponseDto.getCategoryDisplayName(
          template?.categoryTypeEntity,
          displayLanguage
        ) || 'Other';
      this.categoryIcon = baseUrl
        ? InboxResponseDto.buildCategoryIconUrl(
            baseUrl,
            template?.categoryTypeId ?? template?.categoryTypeEntity?.id ?? null
          )
        : undefined;
    } else {
      if ((template as any)?.bakongPlatform === BakongApp.BAKONG_TOURIST) {
        this.categoryType =
          InboxResponseDto.getCategoryDisplayName(
            template?.categoryTypeEntity,
            Language.EN
          ) || 'Other';
      } else {
        this.categoryType =
          InboxResponseDto.getCategoryDisplayName(
            template?.categoryTypeEntity,
            storedLanguage
          ) || 'Other';
      }
      this.categoryIcon = undefined;
    }
    this.bakongPlatform =
      (template as any)?.bakongPlatform ||
      (data as any)?.userBakongPlatform ||
      'BAKONG';
    this.createdDate = DateFormatter.formatDateByLanguage(
      (data as any).createdAt,
      displayLanguage
    );
    this.timestamp = (data as any).createdAt.toISOString();
    const storedTranslation =
      template &&
      templateService?.findBestTranslation(template, storedLanguage);
    const contentTranslation =
      userLangTranslation || storedTranslation || userTranslation;
    this.title = contentTranslation?.title || '';
    this.content = contentTranslation?.content || '';
    const imageId =
      (userTranslation as any)?.imageId ?? (template as any)?.imageId ?? null;
    this.imageUrl = imageId
      ? imageService?.buildImageUrl(imageId, req, baseUrl) ||
        `${baseUrl}/api/v1/image/${imageId}`
      : '';
    this.linkPreview = storedTranslation?.linkPreview || '';
  }

  static getResponse(
    data: NotificationData | NotificationData[],
    message: string,
    pagination?: PaginationMeta
  ) {
    if (!Array.isArray(data)) {
      return BaseResponseDto.success({
        data,
        message,
      });
    }
    const sorted = [...data].sort((a, b) => Number(b.id) - Number(a.id));
    return BaseResponseDto.success({
      data: {
        notifications: sorted,
        ...pagination,
      },
      message,
    });
  }

  static getNotificationCenterResponse(
    notifications: NotificationData | NotificationData[],
    message: string,
    pagination?: PaginationMeta,
    userBakongPlatform?: string
  ) {
    const sanitized = (notifications as NotificationData[]).map((n) => ({
      ...n,
      categoryType:
        typeof n.categoryType === 'string' && n.categoryType.trim()
          ? n.categoryType
          : 'Other',
    }));
    const response = this.getResponse(sanitized, message, pagination);
    if (
      userBakongPlatform &&
      response.data &&
      typeof response.data === 'object'
    ) {
      (response.data as any).userBakongPlatform = userBakongPlatform;
    }
    return response;
  }

  static getSyncResponse(
    accountId: string,
    bakongPlatform: string,
    dataUpdated = true,
    syncStatus?: {
      status: 'SUCCESS' | 'FAILED';
      lastSyncAt: string | null;
      lastSyncMessage: string | null;
    }
  ) {
    return BaseResponseDto.success({
      message: dataUpdated
        ? 'User data synchronized successfully'
        : 'User data is already up to date',
      data: {
        accountId,
        bakongPlatform,
        syncedAt: new Date().toISOString(),
        dataUpdated,
        syncStatus: syncStatus || null,
      },
    });
  }

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
    failedUsers?: string[]
  ): NotificationData {
    const isV2 =
      (req as any)?.version === '2' ||
      req?.url?.includes('/v2/') ||
      req?.originalUrl?.includes('/v2/');
    const storedLanguage: Language = translation?.language
      ? (translation.language as Language)
      : Language.KM;
    let displayLanguage: Language = language; // User's preferred language
    if (template?.translations && Array.isArray(template.translations)) {
      const userLangExists = template.translations.some(
        (t: any) => t.language === language
      );
      if (!userLangExists) {
        displayLanguage = Language.KM;
      }
    } else {
      displayLanguage = Language.KM;
    }
    try {
      if (storedLanguage === Language.EN) displayLanguage = Language.EN;
    } catch (e) {}
    try {
      if ((template as any)?.bakongPlatform === BakongApp.BAKONG_TOURIST)
        displayLanguage = Language.EN;
    } catch (e) {}
    let categoryType: string;
    let finalCategoryIcon: string | undefined;
    if (isV2) {
      categoryType =
        InboxResponseDto.getCategoryDisplayName(
          template?.categoryTypeEntity,
          displayLanguage
        ) || 'Other';
      finalCategoryIcon = baseUrl
        ? categoryIcon ||
          InboxResponseDto.buildCategoryIconUrl(
            baseUrl,
            template?.categoryTypeId
          )
        : undefined;
    } else {
      if ((template as any)?.bakongPlatform === BakongApp.BAKONG_TOURIST) {
        categoryType =
          InboxResponseDto.getCategoryDisplayName(
            template?.categoryTypeEntity,
            Language.EN
          ) || 'Other';
      } else {
        const rawName = template?.categoryTypeEntity?.name || 'Other';
        let upperName = rawName.toUpperCase();
        upperName = upperName.replace(/\s+&\s+/g, '_AND_');
        upperName = upperName.replace(/\s+/g, '_');
        categoryType = upperName;
      }
      finalCategoryIcon = undefined;
    }
    const baseData: NotificationData = {
      id: Number(notificationId),
      templateId: Number(template?.id),
      language: String(storedLanguage), // Show actual language used (KM for FCM push)
      notificationType: template?.notificationType,
      categoryType,
      categoryIcon: finalCategoryIcon,
      bakongPlatform: template?.bakongPlatform,
      createdDate: DateFormatter.formatDateByLanguage(
        new Date(),
        displayLanguage
      ), // Use user's language for date
      timestamp: new Date().toISOString(),
      title: translation?.title || '', // Content from translation (KM for FCM push)
      content: translation?.content || '', // Content from translation (KM for FCM push)
      imageUrl: imageUrl || '',
      linkPreview: translation?.linkPreview || '',
    };
    if (template?.notificationType === NotificationType.FLASH_NOTIFICATION) {
      baseData.sendCount = sendCount || 1;
    }
    return baseData;
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
    failedUsers?: string[]
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
      failedUsers
    );
  }

  static getCategoryDisplayName(
    categoryType: CategoryType | undefined,
    lang: Language
  ): string {
    const defaultOther =
      lang === Language.KM
        ? 'ផ្សេងៗ'
        : lang === Language.JP
        ? 'その他'
        : 'Other';
    if (!categoryType) return defaultOther;
    const safe = (v?: string) => (typeof v === 'string' ? v.trim() : '');
    if (lang === Language.KM)
      return (
        safe(categoryType.namekh) || safe(categoryType.name) || defaultOther
      );
    if (lang === Language.JP)
      return (
        safe(categoryType.namejp) || safe(categoryType.name) || defaultOther
      );
    return safe(categoryType.name) || defaultOther;
  }

  private static DEFAULT_OTHER_CATEGORY_ID = 3;
  static buildCategoryIconUrl(
    baseUrl: string,
    categoryTypeId?: number | null
  ): string {
    const id = categoryTypeId ?? InboxResponseDto.DEFAULT_OTHER_CATEGORY_ID;
    return `${baseUrl}/api/v2/category-type/${id}/icon`;
  }

  static buildFCMResult(
    mode: 'individual' | 'shared',
    successfulNotifications: any[],
    failedUsers: any[],
    fcmUsers: any[],
    sharedNotificationId?: number,
    sharedSuccessfulCount?: number,
    sharedFailedCount?: number,
    sharedFailedUsers?: Array<{
      accountId: string;
      error: string;
      errorCode?: string;
    }>
  ) {
    const checkInvalidTokens = (
      users: Array<{ accountId: string; error?: string; errorCode?: string }>
    ): boolean => {
      if (!users || users.length === 0) return false;
      const invalidTokenErrorCodes = [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
        'messaging/invalid-argument',
      ];
      const allInvalidTokens = users.every(
        (u) => u.errorCode && invalidTokenErrorCodes.includes(u.errorCode)
      );
      const invalidTokenCount = users.filter(
        (u) => u.errorCode && invalidTokenErrorCodes.includes(u.errorCode)
      ).length;
      const majorityInvalidTokens = invalidTokenCount > users.length / 2;
      return allInvalidTokens || majorityInvalidTokens;
    };
    const allFailedUsers =
      mode === 'individual' ? failedUsers : sharedFailedUsers || [];
    const failedDueToInvalidTokens = checkInvalidTokens(allFailedUsers);
    const failedUserDetails = allFailedUsers.map((u) => ({
      accountId: u.accountId,
      error: u.error,
      errorCode: u.errorCode,
    }));
    if (mode === 'individual') {
      return {
        notificationId:
          successfulNotifications.length > 0
            ? successfulNotifications[0].id
            : null,
        successfulCount: successfulNotifications.length,
        failedCount: failedUsers.length,
        failedUsers: failedUsers.map((u) => u.accountId),
        failedDueToInvalidTokens,
        failedUserDetails, // Include detailed error info for debugging
      };
    } else {
      return {
        notificationId: sharedNotificationId || null,
        successfulCount: sharedSuccessfulCount ?? 0,
        failedCount: sharedFailedCount ?? 0,
        failedUsers: (sharedFailedUsers || []).map((u) => u.accountId),
        failedDueToInvalidTokens,
        failedUserDetails, // Include detailed error info for debugging
      };
    }
  }

  static buildAndroidPayload(
    token: string,
    title: string,
    body: string,
    notificationId: string,
    extra?: Record<string, string>
  ): Message {
    const dataPayload = {
      type: 'NOTIFICATION',
      notificationId,
      title: title,
      body: body,
      timestamp: new Date().toISOString(),
      ...(extra ?? {}),
      content: extra?.content || '',
      linkPreview: extra?.linkPreview || '',
      createdDate:
        extra?.createdDate ||
        DateFormatter.formatDateByLanguage(new Date(), Language.EN),
      notification_title: extra?.notification_title || title,
      notification_body: extra?.notification_body || body,
    };
    const stringDataPayload: Record<string, string> = {};
    Object.entries(dataPayload).forEach(([key, value]) => {
      if (key === 'categoryType' && (!value || String(value).trim() === '')) {
        stringDataPayload[key] = 'NEWS';
      } else {
        stringDataPayload[key] = String(value || '');
      }
    });
    return {
      token,
      data: dataPayload,
      android: {
        priority: 'high',
      },
    };
  }

  static buildAndroidDataOnlyPayload(
    token: string,
    title: string,
    body: string,
    notificationId: string,
    extra?: Record<string, any>
  ): Message {
    const data: Record<string, string> = {
      type: 'NOTIFICATION',
      notificationId: String(notificationId),
      title: String(title),
      body: String(body),
      timestamp: new Date().toISOString(),
      ...(extra
        ? Object.fromEntries(
            Object.entries(extra).map(([key, value]) => [
              key,
              String(value || ''),
            ])
          )
        : {}),
    };
    return {
      token,
      android: {
        priority: 'high',
        ttl: 3600000,
        collapseKey: `template_${String(extra?.templateId ?? 'unknown')}`,
      },
      data,
    };
  }

  static buildIOSAlertPayload(
    token: string,
    title: string,
    body: string,
    notificationId: string,
    notification?: Record<string, string | number>
  ): Message {
    const aps: Record<string, any> = {
      alert: { title, body },
      sound: 'default',
      badge: 1,
      type: 'NOTIFICATION',
      notification: notification || [], // Mobile app reads this from aps payload (non-standard but was working before)
    };
    const dataPayload: Record<string, string> = {
      notificationId: String(notificationId),
    };
    if (notification) {
      Object.entries(notification).forEach(([key, value]) => {
        if (key !== 'type') {
          dataPayload[key] = String(value ?? '');
        }
      });
    }
    dataPayload.type = 'NOTIFICATION';
    const apns: ApnsConfig = {
      headers: {
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
      payload: { aps },
    };
    return {
      token,
      notification: {
        title,
        body,
      },
      apns,
      data: dataPayload,
    };
  }

  static buildIOSPayload(
    token: string,
    type: NotificationType,
    title: string,
    body: string,
    notificationId: string,
    notification?: Record<string, string | number>
  ): Message {
    return this.buildIOSAlertPayload(
      token,
      title,
      body,
      notificationId,
      notification
    );
  }
}
