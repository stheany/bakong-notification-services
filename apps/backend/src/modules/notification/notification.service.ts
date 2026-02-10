import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BakongUser } from 'src/entities/bakong-user.entity';
import { Notification } from 'src/entities/notification.entity';
import { Repository, Between } from 'typeorm';
import { Messaging } from 'firebase-admin/messaging';
import { Template } from 'src/entities/template.entity';
import { TemplateTranslation } from 'src/entities/template-translation.entity';
import { CategoryType } from 'src/entities/category-type.entity';
import { ValidationHelper } from 'src/common/util/validation.helper';
import { BaseFunctionHelper } from 'src/common/util/base-function.helper';
import { FirebaseManager } from 'src/common/services/firebase-manager.service';
import { PaginationUtils } from '@bakong/shared';
import { BaseResponseDto } from '../../common/base-response.dto';
import SentNotificationDto from './dto/send-notification.dto';
import { NotificationInboxDto } from './dto/notification-inbox.dto';
import { TemplateService } from '../template/template.service';
import { ImageService } from '../image/image.service';
import { DateFormatter } from '@bakong/shared';
import { ResponseMessage, ErrorCode, BakongApp } from '@bakong/shared';
import { Language, NotificationType } from '@bakong/shared';
import { InboxResponseDto } from './dto/inbox-response.dto';
@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notiRepo: Repository<Notification>,
    @InjectRepository(BakongUser)
    private readonly bkUserRepo: Repository<BakongUser>,
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
    @Inject(forwardRef(() => TemplateService))
    private readonly templateService: TemplateService,
    private readonly imageService: ImageService,
    private readonly baseFunctionHelper: BaseFunctionHelper
  ) {}

  /**
   * Get Firebase Messaging instance for a specific Bakong platform
   * Falls back to default if platform is not specified
   */
  /**
   * Test FCM token validation - sends a test notification to verify token validity
   * This is useful for debugging token issues
   */
  async testFCMToken(
    token: string,
    bakongPlatform?: BakongApp | string | null
  ): Promise<{
    isValid: boolean;
    formatValid: boolean;
    firebaseValid: boolean;
    error?: string;
    errorCode?: string;
    messageId?: string;
  }> {
    console.log('🧪 [testFCMToken] Starting token test...');
    console.log(
      '🧪 [testFCMToken] Token:',
      token ? `${token.substring(0, 30)}...` : 'NO TOKEN'
    );
    console.log('🧪 [testFCMToken] Platform:', bakongPlatform || 'DEFAULT');
    const formatValid = ValidationHelper.isValidFCMTokenFormat(token);
    console.log(
      '🧪 [testFCMToken] Format validation:',
      formatValid ? '✅ PASS' : '❌ FAIL'
    );
    if (!formatValid) {
      return {
        isValid: false,
        formatValid: false,
        firebaseValid: false,
        error: 'Token format is invalid',
        errorCode: 'INVALID_FORMAT',
      };
    }
    const fcm = this.getFCM(bakongPlatform);
    if (!fcm) {
      return {
        isValid: false,
        formatValid: true,
        firebaseValid: false,
        error: 'Firebase FCM is not initialized',
        errorCode: 'FCM_NOT_INITIALIZED',
      };
    }
    const testMessage = {
      token: token,
      notification: {
        title: '🧪 Token Test',
        body: 'This is a test notification to validate your token',
      },
      data: {
        test: 'true',
        timestamp: new Date().toISOString(),
      },
    };
    try {
      console.log('🧪 [testFCMToken] Attempting to send test notification...');
      const messageId = await fcm.send(testMessage);
      console.log(
        '✅ [testFCMToken] Token is VALID - notification sent successfully!'
      );
      return {
        isValid: true,
        formatValid: true,
        firebaseValid: true,
        messageId: String(messageId),
      };
    } catch (error: any) {
      const errorCode = error.code || 'UNKNOWN_ERROR';
      const errorMessage = error.message || 'Unknown error';
      console.error('❌ [testFCMToken] Token is INVALID:', {
        errorCode,
        errorMessage,
      });
      const isInvalidToken =
        errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/invalid-argument';
      return {
        isValid: false,
        formatValid: true,
        firebaseValid: !isInvalidToken,
        error: errorMessage,
        errorCode: errorCode,
      };
    }
  }

  private getFCM(bakongPlatform?: string | null): Messaging | null {
    const fcm = FirebaseManager.getMessaging(bakongPlatform);
    if (fcm) {
      const appName = bakongPlatform
        ? FirebaseManager.getAppName(bakongPlatform)
        : 'DEFAULT';
      const serviceAccountPath = bakongPlatform
        ? FirebaseManager.getServiceAccountPath(bakongPlatform)
        : null;
      console.log(
        `🔥 [getFCM] Using Firebase app: ${appName} for platform: ${
          bakongPlatform || 'DEFAULT'
        }`
      );
      console.log(
        `🔥 [getFCM] Service account path: ${
          serviceAccountPath || 'Using default'
        }`
      );
      if (serviceAccountPath && require('fs').existsSync(serviceAccountPath)) {
        try {
          const fs = require('fs');
          const serviceAccount = JSON.parse(
            fs.readFileSync(serviceAccountPath, 'utf8')
          );
          console.log(
            `🔥 [getFCM] Firebase Project ID: ${
              serviceAccount.project_id || 'NOT FOUND'
            }`
          );
          console.log(
            `🔥 [getFCM] Service Account Email: ${
              serviceAccount.client_email || 'NOT FOUND'
            }`
          );
        } catch (e: any) {
          console.warn(
            `⚠️ [getFCM] Could not read service account file: ${e.message}`
          );
        }
      }
    } else {
      console.error(
        `❌ [getFCM] No FCM instance available for platform: ${
          bakongPlatform || 'DEFAULT'
        }`
      );
    }
    return fcm;
  }

  async sendWithTemplate(
    template: Template,
    accountIdList?: string[]
  ): Promise<{
    successfulCount: number;
    failedCount: number;
    failedUsers?: string[];
    failedDueToInvalidTokens?: boolean;
  }> {
    console.log(
      '📤 [sendWithTemplate] ========== STARTING SEND PROCESS =========='
    );
    console.log('📤 [sendWithTemplate] Template ID:', template.id);
    console.log(
      '📤 [sendWithTemplate] Template bakongPlatform:',
      template.bakongPlatform,
      `(type: ${typeof template.bakongPlatform})`
    );
    console.log(
      '📤 [sendWithTemplate] Template created at:',
      template.createdAt
    );
    console.log(
      '📤 [sendWithTemplate] Template has translations:',
      template.translations?.length || 0
    );
    if (template.translations && template.translations.length > 0) {
      template.translations.forEach((t, idx) => {
        console.log(`📤 [sendWithTemplate] Translation ${idx + 1}:`, {
          language: t.language,
          titleLength: t.title?.length || 0,
          contentLength: t.content?.length || 0,
          titlePreview: t.title ? `${t.title.substring(0, 50)}...` : 'NO TITLE',
        });
      });
    }
    if (!template.translations?.length) {
      console.warn(
        '⚠️ [sendWithTemplate] No translations found for template:',
        template.id
      );
      return { successfulCount: 0, failedCount: 0, failedUsers: [] };
    }
    const platformsArray = ValidationHelper.parsePlatforms(template.platforms);
    console.log('📤 [sendWithTemplate] Parsed platforms:', {
      raw: template.platforms,
      parsed: platformsArray,
      type: typeof template.platforms,
      isArray: Array.isArray(template.platforms),
    });
    const normalizedPlatforms = platformsArray
      .map((p) => ValidationHelper.normalizeEnum(p))
      .filter((p) => p === 'ALL' || p === 'IOS' || p === 'ANDROID'); // Only allow valid platform values
    if (normalizedPlatforms.length === 0) {
      console.warn(
        '⚠️ [sendWithTemplate] No valid platforms found, defaulting to ALL'
      );
      normalizedPlatforms.push('ALL');
    }
    console.log('📤 [sendWithTemplate] Target platforms:', {
      raw: template.platforms,
      parsed: platformsArray,
      normalized: normalizedPlatforms,
    });
    console.log('📤 [sendWithTemplate] Syncing and normalizing all users...');
    const syncResult = await this.baseFunctionHelper.syncAllUsers();
    console.log('📤 [sendWithTemplate] User sync complete:', {
      totalUsers: syncResult.totalCount,
      updatedUsers: syncResult.updatedCount,
      invalidTokensCleaned: syncResult.invalidTokens,
      updatedUserIds: syncResult.updatedIds?.slice(0, 10), // Log first 10 for debugging
    });
    console.log(
      '📤 [sendWithTemplate] Querying users from database again after sync (fresh query)...'
    );
    let users = await this.bkUserRepo.createQueryBuilder('user').getMany();
    console.log(
      '📤 [sendWithTemplate] Total users fetched from database:',
      users.length
    );
    const bakongPlatformDebug: Record<string, number> = {};
    const usersWithNullPlatform: string[] = [];
    users.forEach((user) => {
      const platform = user.bakongPlatform || 'NULL';
      bakongPlatformDebug[platform] = (bakongPlatformDebug[platform] || 0) + 1;
      if (!user.bakongPlatform) {
        usersWithNullPlatform.push(user.accountId);
      }
    });
    console.log(
      '📤 [sendWithTemplate] DEBUG - BakongPlatform values from database:',
      bakongPlatformDebug
    );
    if (usersWithNullPlatform.length > 0) {
      console.warn(
        '⚠️ [sendWithTemplate] DEBUG - Users with NULL bakongPlatform:',
        usersWithNullPlatform.slice(0, 10)
      );
    }
    if (syncResult.updatedIds && syncResult.updatedIds.length > 0) {
      const updatedUsers = users.filter((u) =>
        syncResult.updatedIds.includes(u.accountId)
      );
      console.log(
        '📤 [sendWithTemplate] Users that were updated during sync:',
        {
          count: updatedUsers.length,
          accountIds: updatedUsers.map((u) => u.accountId).slice(0, 10),
          tokenStatus: updatedUsers.slice(0, 5).map((u) => ({
            accountId: u.accountId,
            hasToken: !!u.fcmToken?.trim(),
            tokenLength: u.fcmToken?.length || 0,
          })),
        }
      );
    }
    if (template.bakongPlatform) {
      const beforeCount = users.length;
      const bakongPlatformBreakdown: Record<string, number> = {};
      const allUsersBeforeFilter = [...users]; // Save copy before filtering
      const usersWithTokensBeforeFilter: Array<{
        accountId: string;
        bakongPlatform: string | null;
        fcmToken: string;
      }> = [];
      users.forEach((user) => {
        const platform = user.bakongPlatform || 'NULL';
        bakongPlatformBreakdown[platform] =
          (bakongPlatformBreakdown[platform] || 0) + 1;
        if (user.fcmToken?.trim()) {
          usersWithTokensBeforeFilter.push({
            accountId: user.accountId,
            bakongPlatform: user.bakongPlatform || null,
            fcmToken: user.fcmToken.substring(0, 30) + '...',
          });
        }
      });
      console.log(
        '📤 [sendWithTemplate] ========== BAKONGPLATFORM FILTERING DEBUG =========='
      );
      console.log(
        '📤 [sendWithTemplate] BakongPlatform distribution BEFORE filtering:',
        bakongPlatformBreakdown
      );
      console.log(
        '📤 [sendWithTemplate] Template bakongPlatform:',
        template.bakongPlatform,
        `(type: ${typeof template.bakongPlatform})`
      );
      console.log(
        '📤 [sendWithTemplate] Users with tokens BEFORE filtering:',
        usersWithTokensBeforeFilter.length
      );
      if (usersWithTokensBeforeFilter.length > 0) {
        console.log(
          '📤 [sendWithTemplate] Sample users with tokens:',
          usersWithTokensBeforeFilter.slice(0, 5)
        );
      }
      const templateBakongPlatform = String(
        template.bakongPlatform
      ).toUpperCase();
      const filteredOutUsers: Array<{
        accountId: string;
        userPlatform: string | null;
        templatePlatform: string;
        hasToken: boolean;
      }> = [];
      const filteredUsers = users.filter((user) => {
        const userBakongPlatform = user.bakongPlatform
          ? String(user.bakongPlatform).toUpperCase()
          : null;
        const matches = userBakongPlatform === templateBakongPlatform;
        if (!matches) {
          filteredOutUsers.push({
            accountId: user.accountId,
            userPlatform: user.bakongPlatform || null,
            templatePlatform: template.bakongPlatform,
            hasToken: !!user.fcmToken?.trim(),
          });
        }
        return matches;
      });
      users = filteredUsers;
      console.log(
        `📤 [sendWithTemplate] Filtered by bakongPlatform (${template.bakongPlatform}): ${beforeCount} → ${users.length} users`
      );
      if (filteredOutUsers.length > 0) {
        console.log(
          '📤 [sendWithTemplate] Users filtered out due to bakongPlatform mismatch:',
          filteredOutUsers.length
        );
        const filteredOutWithTokens = filteredOutUsers.filter(
          (u) => u.hasToken
        );
        if (filteredOutWithTokens.length > 0) {
          console.warn(
            `⚠️ [sendWithTemplate] ${filteredOutWithTokens.length} user(s) with tokens were filtered out due to bakongPlatform mismatch:`,
            filteredOutWithTokens.slice(0, 10)
          );
        }
      }
      console.log(
        '📤 [sendWithTemplate] ===================================================='
      );
      if (users.length === 0) {
        const platformName =
          template.bakongPlatform === 'BAKONG_TOURIST'
            ? 'Bakong Tourist'
            : template.bakongPlatform === 'BAKONG_JUNIOR'
            ? 'Bakong Junior'
            : 'Bakong';
        throw new Error(
          `No users found for ${platformName} app. Please ensure there are registered users for this platform before sending notifications.`
        );
      }
    }
    const targetsAllPlatforms = normalizedPlatforms.includes('ALL');
    console.log(
      '📤 [sendWithTemplate] Targeting ALL platforms?',
      targetsAllPlatforms
    );
    if (targetsAllPlatforms) {
      console.log(
        '📤 [sendWithTemplate] ✅ "ALL" detected - will send to iOS, Android, and any platform'
      );
    } else {
      console.log(
        '📤 [sendWithTemplate] Targeting specific platforms:',
        normalizedPlatforms
      );
    }
    const userPlatformBreakdown: Record<string, number> = {};
    users.forEach((user) => {
      const platform = user.platform || 'NULL';
      const normalizedUserPlatform = user.platform
        ? ValidationHelper.normalizeEnum(user.platform)
        : 'NULL';
      const key = `${platform} (normalized: ${normalizedUserPlatform})`;
      userPlatformBreakdown[key] = (userPlatformBreakdown[key] || 0) + 1;
    });
    console.log(
      '📤 [sendWithTemplate] User platforms BEFORE filtering:',
      userPlatformBreakdown
    );
    const matchingUsers = users.filter((user) => {
      if (!user.platform) {
        console.log(
          `📤 [sendWithTemplate] Filtering out user ${user.accountId}: no platform set`
        );
        return false;
      }
      if (targetsAllPlatforms) {
        return true;
      }
      const normalizedUserPlatform = ValidationHelper.normalizeEnum(
        user.platform
      );
      const matches = normalizedPlatforms.some(
        (p) => normalizedUserPlatform === p
      );
      if (!matches) {
        console.log(
          `📤 [sendWithTemplate] Filtering out user ${
            user.accountId
          }: platform "${
            user.platform
          }" (normalized: "${normalizedUserPlatform}") not in target platforms [${normalizedPlatforms.join(
            ', '
          )}]`
        );
      }
      return matches;
    });
    if (matchingUsers.length > 0) {
      const platformBreakdown: Record<string, number> = {};
      matchingUsers.forEach((user) => {
        const platform = user.platform || 'NULL';
        const normalizedPlatform = user.platform
          ? ValidationHelper.normalizeEnum(user.platform)
          : 'NULL';
        const key = `${platform} (normalized: ${normalizedPlatform})`;
        platformBreakdown[key] = (platformBreakdown[key] || 0) + 1;
      });
      console.log(
        '📤 [sendWithTemplate] Platform breakdown AFTER filtering:',
        platformBreakdown
      );
    } else {
      console.log('📤 [sendWithTemplate] No users match platform filter');
    }
    console.log(
      '📤 [sendWithTemplate] Users matching platform filter:',
      matchingUsers.length
    );
    let finalUsers = matchingUsers;
    let notFoundAccountIds: string[] = [];
    if (accountIdList && accountIdList.length > 0) {
      const beforeAccountIdFilter = finalUsers.length;
      const foundAccountIds = new Set(finalUsers.map((u) => u.accountId));
      finalUsers = finalUsers.filter((user) =>
        accountIdList.includes(user.accountId)
      );
      notFoundAccountIds = accountIdList.filter(
        (accountId) => !foundAccountIds.has(accountId)
      );
      console.log(
        `📤 [sendWithTemplate] Filtered by accountId list (${accountIdList.length} accountIds): ${beforeAccountIdFilter} → ${finalUsers.length} users`
      );
      if (notFoundAccountIds.length > 0) {
        console.warn(
          `⚠️ [sendWithTemplate] ${
            notFoundAccountIds.length
          } accountId(s) not found in database: ${notFoundAccountIds.join(
            ', '
          )}`
        );
      }
      if (finalUsers.length === 0) {
        console.warn(
          `⚠️ [sendWithTemplate] No users match the accountId list. Requested: ${accountIdList.join(
            ', '
          )}`
        );
        return {
          successfulCount: 0,
          failedCount: 0,
          failedUsers: accountIdList,
        };
      }
    }
    if (!finalUsers.length) {
      console.warn(
        `⚠️ [sendWithTemplate] Template platform requirement: ${normalizedPlatforms.join(
          ', '
        )}`
      );
      console.warn(
        `⚠️ [sendWithTemplate] Total users checked: ${
          users.length
        }, Users filtered out: ${users.length - matchingUsers.length}`
      );
      console.warn(
        '⚠️ [sendWithTemplate] Template will be kept as draft - no matching users found'
      );
      return { successfulCount: 0, failedCount: 0, failedUsers: [] };
    }
    const requestedLang: Language | undefined = undefined;
    try {
    } catch (e) {}
    const preferredLangForPush: Language =
      template.bakongPlatform === BakongApp.BAKONG_TOURIST
        ? Language.EN
        : Language.KM;
    let defaultTranslation = this.templateService.findBestTranslation(
      template,
      preferredLangForPush
    );
    if (!defaultTranslation) {
      console.warn(
        `⚠️ [sendWithTemplate] No ${preferredLangForPush} translation found, trying fallback`
      );
      defaultTranslation = this.templateService.findBestTranslation(
        template,
        undefined
      );
      if (!defaultTranslation) {
        return { successfulCount: 0, failedCount: 0, failedUsers: [] };
      }
      console.warn(
        `⚠️ [sendWithTemplate] Using fallback translation (${defaultTranslation.language}) instead of ${preferredLangForPush}`
      );
    }
    if (template.bakongPlatform === BakongApp.BAKONG_TOURIST) {
      if (defaultTranslation && defaultTranslation.language !== Language.EN) {
        console.log(
          `🔄 [sendWithTemplate] Temporarily coercing translation.language -> EN for template ${template.id}`
        );
        try {
          (defaultTranslation as any).language = Language.EN;
        } catch (e) {
          console.warn(
            '⚠️ [sendWithTemplate] Failed to coerce translation language in-memory:',
            e?.message || e
          );
        }
      }
    }
    const usersWithoutTokens = finalUsers.filter(
      (user) => !user.fcmToken?.trim()
    );
    const usersWithEmptyTokens = usersWithoutTokens.map((user) => ({
      accountId: user.accountId,
      error: 'FCM token is empty or missing',
      errorCode: 'messaging/invalid-registration-token',
    }));
    console.log(
      '📤 [sendWithTemplate] Users without FCM tokens:',
      usersWithoutTokens.length
    );
    if (usersWithoutTokens.length > 0) {
      console.log(
        '📤 [sendWithTemplate] Users with empty tokens:',
        usersWithoutTokens.map((u) => u.accountId)
      );
    }
    const usersWithTokens = finalUsers.filter((user) => user.fcmToken?.trim());
    console.log(
      '📤 [sendWithTemplate] Users with FCM tokens:',
      usersWithTokens.length
    );
    if (usersWithTokens.length > 0) {
      const userDetails = usersWithTokens.map((u) => ({
        accountId: u.accountId,
        platform: u.platform,
        tokenLength: u.fcmToken?.length || 0,
        tokenPrefix: u.fcmToken
          ? `${u.fcmToken.substring(0, 30)}...`
          : 'NO TOKEN',
        bakongPlatform: u.bakongPlatform,
      }));
      console.log(
        '📤 [sendWithTemplate] Users with tokens (for debugging):',
        userDetails.slice(0, 10)
      );
    }
    const fcm = this.getFCM(template.bakongPlatform);
    if (!fcm) {
      console.error(
        '❌ [sendWithTemplate] Firebase FCM is not initialized. Cannot send notifications.'
      );
      return {
        successfulCount: 0,
        failedCount: usersWithoutTokens.length,
        failedUsers: usersWithoutTokens.map((u) => u.accountId),
        failedDueToInvalidTokens: usersWithoutTokens.length > 0,
      };
    }
    console.log('📤 [sendWithTemplate] Preparing to send notifications...');
    console.log(
      '📤 [sendWithTemplate] Strategy: Try all format-valid tokens - Firebase will validate during actual send'
    );
    const formatValidUsers = usersWithTokens.filter(
      (user) =>
        user.fcmToken &&
        user.fcmToken.length > 50 &&
        ValidationHelper.isValidFCMTokenFormat(user.fcmToken)
    );
    console.log(
      '📤 [sendWithTemplate] Users with valid token format:',
      formatValidUsers.length
    );
    console.log(
      '📤 [sendWithTemplate] Will attempt to send to ALL format-valid tokens (skipping pre-validation for better reliability)'
    );
    const usersWithInvalidFormat = usersWithTokens.filter(
      (user) => !formatValidUsers.some((vu) => vu.accountId === user.accountId)
    );
    const invalidFormatUsers = usersWithInvalidFormat.map((user) => ({
      accountId: user.accountId,
      error: 'FCM token format is invalid',
      errorCode: 'messaging/invalid-registration-token',
    }));
    console.log(
      '📤 [sendWithTemplate] Users filtered out due to invalid token format:',
      invalidFormatUsers.length
    );
    if (invalidFormatUsers.length > 0) {
      console.log(
        '📤 [sendWithTemplate] Users with invalid format:',
        invalidFormatUsers.map((u) => u.accountId)
      );
    }
    const usersToSend = formatValidUsers;
    console.log('📤 [sendWithTemplate] Sending strategy:', {
      formatValid: formatValidUsers.length,
      willSendTo: usersToSend.length,
      note: 'Trying all format-valid tokens - Firebase will reject invalid ones during actual send',
    });
    if (usersToSend.length > 0) {
      console.log(
        '📤 [sendWithTemplate] Users that will receive notification:',
        usersToSend.map((u) => ({
          accountId: u.accountId,
          tokenPrefix: u.fcmToken
            ? `${u.fcmToken.substring(0, 30)}...`
            : 'NO TOKEN',
          platform: u.platform,
        }))
      );
    }
    if (!usersToSend.length) {
      const allInvalidUsers = [...usersWithEmptyTokens, ...invalidFormatUsers];
      return {
        successfulCount: 0,
        failedCount: allInvalidUsers.length,
        failedUsers: allInvalidUsers.map((u) => u.accountId),
        failedDueToInvalidTokens: allInvalidUsers.length > 0,
      };
    }
    console.log(
      `📤 [sendWithTemplate] Attempting to send FCM notifications to ${usersToSend.length} users (all format-valid tokens)...`
    );
    const result = (await this.sendFCM(
      template,
      defaultTranslation,
      usersToSend,
      undefined,
      'individual'
    )) as {
      notificationId: number | null;
      successfulCount: number;
      failedCount: number;
      failedUsers?: string[];
      failedDueToInvalidTokens?: boolean;
    };
    const allFailedUsers = [
      ...usersWithEmptyTokens.map((u) => u.accountId),
      ...invalidFormatUsers.map((u) => u.accountId),
      ...(result.failedUsers || []),
      ...notFoundAccountIds, // Add accountIds that were not found in database
    ];
    const totalFailedCount =
      usersWithoutTokens.length +
      invalidFormatUsers.length +
      result.failedCount +
      notFoundAccountIds.length;
    const hasInvalidTokens =
      usersWithoutTokens.length > 0 ||
      invalidFormatUsers.length > 0 ||
      result.failedDueToInvalidTokens === true;
    console.log('✅ [sendWithTemplate] Notification send complete:', {
      successfulCount: result.successfulCount,
      failedCount: totalFailedCount,
      failedUsers: allFailedUsers.length,
      failedDueToEmptyTokens: usersWithoutTokens.length,
      failedDueToInvalidFormat: invalidFormatUsers.length,
      failedDuringSend: result.failedCount,
      failedDueToInvalidTokensFromResult: result.failedDueToInvalidTokens,
      hasInvalidTokens: hasInvalidTokens,
      totalUsers: finalUsers.length,
      formatValidUsersAttempted: formatValidUsers.length,
      note: 'Attempted to send to ALL format-valid tokens (no pre-validation filtering)',
    });
    return {
      successfulCount: result.successfulCount,
      failedCount: totalFailedCount,
      failedUsers: allFailedUsers,
      failedDueToInvalidTokens: hasInvalidTokens,
    };
  }

  async sendNow(dto: SentNotificationDto, req?: any) {
    try {
      if (dto.notificationId) {
        const notification = await this.notiRepo.findOne({
          where: { id: dto.notificationId },
          relations: [
            'template',
            'template.translations',
            'template.categoryTypeEntity',
          ],
        });
        if (!notification) throw new Error('Notification not found');
        if (notification.template && !notification.template.translations) {
          notification.template.translations = [];
        }
        if (typeof dto.accountId === 'string' && dto.accountId.trim()) {
          const user = await this.baseFunctionHelper.findUserByAccountId(
            dto.accountId.trim()
          );
          if (
            user &&
            user.bakongPlatform &&
            notification.template.bakongPlatform
          ) {
            if (user.bakongPlatform !== notification.template.bakongPlatform) {
              return BaseResponseDto.error({
                errorCode: ErrorCode.TEMPLATE_NOT_FOUND,
                message: 'Notification not found for this Bakong platform',
                data: {
                  notificationId: dto.notificationId,
                  userPlatform: user.bakongPlatform,
                  templatePlatform: notification.template.bakongPlatform,
                },
              });
            }
          }
        }
        const trans = this.templateService.findBestTranslation(
          notification.template,
          dto.language
        );
        const imageUrl = trans?.imageId
          ? this.imageService.buildImageUrl(trans.imageId, req)
          : '';
        const baseUrl = this.baseFunctionHelper
          ? this.baseFunctionHelper.getBaseUrl(req)
          : 'http://localhost:4005';
        const language = (dto.language || 'EN') as Language;
        const categoryIcon = notification.template?.categoryTypeId
          ? InboxResponseDto.buildCategoryIconUrl(
              baseUrl,
              notification.template.categoryTypeId
            )
          : undefined;
        const result = InboxResponseDto.buildSendApiNotificationData(
          notification.template,
          trans,
          language,
          typeof imageUrl === 'string' ? imageUrl : '',
          notification.id,
          notification.sendCount,
          baseUrl,
          req,
          categoryIcon
        );
        return BaseResponseDto.success({
          data: { whatnews: result },
          message: `Send ${notification.template.notificationType} to users successfully.`,
        });
      }
      let userBakongPlatform: string | undefined = undefined;
      const singleAccountId =
        typeof dto.accountId === 'string' && dto.accountId.trim()
          ? dto.accountId.trim()
          : undefined;
      if (
        singleAccountId &&
        dto.notificationType === NotificationType.FLASH_NOTIFICATION
      ) {
        const user = await this.baseFunctionHelper.findUserByAccountId(
          singleAccountId
        );
        if (user && user.bakongPlatform) {
          userBakongPlatform = user.bakongPlatform;
          console.log(
            `✅ [sendNow] Using user ${dto.accountId} bakongPlatform (already synced in controller): ${userBakongPlatform}`
          );
        } else if (dto.bakongPlatform) {
          userBakongPlatform = dto.bakongPlatform;
          console.log(
            `⚠️ [sendNow] User ${singleAccountId} has no bakongPlatform in DB, using from request: ${userBakongPlatform}`
          );
        } else {
          const inferred = this.inferBakongPlatform(
            dto.participantCode,
            singleAccountId
          );
          if (inferred) {
            userBakongPlatform = inferred;
            console.warn(
              `⚠️ [sendNow] Inferring bakongPlatform for ${singleAccountId}: ${inferred}`
            );
          }
        }
      }
      let template: Template | null = null;
      let notificationType: NotificationType;
      if (
        dto.accountId &&
        dto.notificationType === NotificationType.FLASH_NOTIFICATION &&
        userBakongPlatform
      ) {
        const templates = await this.templateRepo.find({
          where: {
            notificationType: NotificationType.FLASH_NOTIFICATION,
            bakongPlatform: userBakongPlatform as any,
            isSent: true, // Only published templates, exclude drafts
          },
          relations: [
            'translations',
            'translations.image',
            'categoryTypeEntity',
          ],
          order: { priority: 'DESC', createdAt: 'DESC' },
        });
        template =
          templates.find((t) => t.translations && t.translations.length > 0) ||
          null;
        notificationType = NotificationType.FLASH_NOTIFICATION;
        if (template) {
          console.log(
            `📤 [sendNow] Found template matching user's bakongPlatform: ${userBakongPlatform}`
          );
        } else {
          console.log(
            `📤 [sendNow] No published template found for bakongPlatform: ${userBakongPlatform}, using default findNotificationTemplate`
          );
        }
      }
      if (!template) {
        const result = await this.templateService.findNotificationTemplate(dto);
        template = result.template;
        notificationType = result.notificationType;
      }
      if (!template) throw new Error(ResponseMessage.TEMPLATE_NOT_FOUND);
      let requestedLang: Language | undefined = undefined;
      try {
        if (
          typeof (dto as any).language === 'string' &&
          (dto as any).language.trim()
        ) {
          const lv = ValidationHelper.validateLanguage((dto as any).language);
          if (lv.isValid) requestedLang = lv.normalizedValue;
        }
      } catch (e) {}
      const preferredForSend: Language =
        template.bakongPlatform === BakongApp.BAKONG_TOURIST
          ? Language.EN
          : requestedLang || Language.KM;
      const translationValidation = ValidationHelper.validateTranslation(
        template,
        preferredForSend
      );
      let translation: TemplateTranslation;
      if (!translationValidation.isValid) {
        const fallbackValidation = ValidationHelper.validateTranslation(
          template,
          undefined
        );
        if (!fallbackValidation.isValid) {
          throw new Error(
            'No translation found and no fallback translation available'
          );
        }
        console.warn(
          `⚠️ [sendNow] No ${preferredForSend} translation found, using fallback translation (${fallbackValidation.translation.language})`
        );
        translation = fallbackValidation.translation;
      } else {
        translation = translationValidation.translation;
      }
      if (template.bakongPlatform === BakongApp.BAKONG_TOURIST) {
        if (translation && translation.language !== Language.EN) {
          console.log(
            `🔄 [sendNow] Temporarily coercing translation.language -> EN for template ${template.id}`
          );
          try {
            (translation as any).language = Language.EN;
          } catch (e) {
            console.warn(
              '⚠️ [sendNow] Failed to coerce translation language in-memory:',
              e?.message || e
            );
          }
        }
      }
      if (
        singleAccountId &&
        notificationType === NotificationType.FLASH_NOTIFICATION &&
        template.bakongPlatform &&
        !userBakongPlatform
      ) {
        const user = await this.baseFunctionHelper.findUserByAccountId(
          singleAccountId
        );
        if (user && !user.bakongPlatform) {
          await this.baseFunctionHelper.updateUserData({
            accountId: singleAccountId,
            bakongPlatform: template.bakongPlatform,
          });
          console.log(
            `📤 [sendNow] Auto-updated user ${singleAccountId} bakongPlatform to ${template.bakongPlatform} from template (user had no bakongPlatform)`
          );
        } else if (user && user.bakongPlatform) {
          console.log(
            `📤 [sendNow] User ${singleAccountId} already has bakongPlatform: ${user.bakongPlatform} - not overwriting`
          );
        }
      }
      let allUsers = await this.bkUserRepo.find();
      console.log('📤 [sendNow] Total users in database:', allUsers.length);
      if (template.bakongPlatform) {
        const beforeCount = allUsers.length;
        allUsers = allUsers.filter(
          (user) => user.bakongPlatform === template.bakongPlatform
        );
        console.log(
          `📤 [sendNow] Filtered by bakongPlatform (${template.bakongPlatform}): ${beforeCount} → ${allUsers.length} users`
        );
        if (
          allUsers.length === 0 &&
          !(
            notificationType === NotificationType.FLASH_NOTIFICATION &&
            dto.accountId
          )
        ) {
          const platformName =
            template.bakongPlatform === 'BAKONG_TOURIST'
              ? 'Bakong Tourist'
              : template.bakongPlatform === 'BAKONG_JUNIOR'
              ? 'Bakong Junior'
              : 'Bakong';
          if (dto.templateId) {
            try {
              await this.templateRepo.update(dto.templateId, { isSent: false });
              console.log(
                `📤 [sendNow] Marked template ${dto.templateId} as draft due to no users`
              );
            } catch (e) {}
          }
          return BaseResponseDto.error({
            errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
            message: ResponseMessage.NO_USERS_FOR_BAKONG_PLATFORM,
            data: {
              bakongPlatform: template.bakongPlatform,
              platformName: platformName,
            },
          });
        }
      }
      const usersWithTokens = allUsers.filter((u) => u.fcmToken?.trim());
      if (notificationType === NotificationType.FLASH_NOTIFICATION) {
        return await this.handleFlashNotification(
          template,
          translation,
          dto,
          req
        );
      }
      if (!usersWithTokens.length)
        throw new Error(ResponseMessage.NO_USERS_CAN_RECEIVE);
      await this.baseFunctionHelper.syncAllUsers();
      let refreshedUsers = await this.bkUserRepo.find();
      if (template.bakongPlatform) {
        const beforeCount = refreshedUsers.length;
        refreshedUsers = refreshedUsers.filter(
          (user) => user.bakongPlatform === template.bakongPlatform
        );
        console.log(
          `📤 [sendNow] After sync - Filtered by bakongPlatform (${template.bakongPlatform}): ${beforeCount} → ${refreshedUsers.length} users`
        );
        if (refreshedUsers.length === 0) {
          const platformName =
            template.bakongPlatform === 'BAKONG_TOURIST'
              ? 'Bakong Tourist'
              : template.bakongPlatform === 'BAKONG_JUNIOR'
              ? 'Bakong Junior'
              : 'Bakong';
          if (dto.templateId) {
            try {
              await this.templateRepo.update(dto.templateId, { isSent: false });
              console.log(
                `📤 [sendNow] After sync - Marked template ${dto.templateId} as draft due to no users`
              );
            } catch (e) {}
          }
          return BaseResponseDto.error({
            errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
            message: ResponseMessage.NO_USERS_FOR_BAKONG_PLATFORM,
            data: {
              bakongPlatform: template.bakongPlatform,
              platformName: platformName,
            },
          });
        }
      }
      let refreshedWithTokens = refreshedUsers.filter((u) =>
        u.fcmToken?.trim()
      );
      const accountIdList = Array.isArray(dto.accountId)
        ? dto.accountId.map((x: any) => String(x).trim()).filter(Boolean)
        : undefined;
      let notFoundAccountIds: string[] = [];
      if (accountIdList && accountIdList.length > 0) {
        const beforeAccountIdFilter = refreshedWithTokens.length;
        const foundAccountIds = new Set(
          refreshedWithTokens.map((u) => u.accountId)
        );
        refreshedWithTokens = refreshedWithTokens.filter((u) =>
          accountIdList.includes(u.accountId)
        );
        notFoundAccountIds = accountIdList.filter(
          (accountId) => !foundAccountIds.has(accountId)
        );
        console.log(
          `📤 [sendNow] Filtered by accountId list (${accountIdList.length} accountIds): ${beforeAccountIdFilter} → ${refreshedWithTokens.length} users`
        );
        if (notFoundAccountIds.length > 0) {
          console.warn(
            `⚠️ [sendNow] ${
              notFoundAccountIds.length
            } accountId(s) not found in database: ${notFoundAccountIds.join(
              ', '
            )}`
          );
        }
        if (refreshedWithTokens.length === 0) {
          console.warn(
            `⚠️ [sendNow] No users match the accountId list. Requested: ${accountIdList.join(
              ', '
            )}`
          );
          return BaseResponseDto.error({
            errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
            message: `No users found matching the provided accountId list: ${accountIdList.join(
              ', '
            )}`,
            data: {
              requestedAccountIds: accountIdList,
              bakongPlatform: template.bakongPlatform,
            },
          });
        }
      }
      const fcm = this.getFCM(template.bakongPlatform);
      if (!fcm) {
        throw new Error('Firebase FCM is not initialized for this platform');
      }
      const validUsers = await ValidationHelper.validateFCMTokens(
        refreshedWithTokens,
        fcm
      );
      if (!validUsers.length)
        throw new Error('No valid FCM tokens found after user data sync');
      let fcmResult: {
        successfulCount: number;
        failedCount: number;
        failedUsers?: string[];
        failedDueToInvalidTokens?: boolean;
      } | void;
      try {
        fcmResult = await this.sendFCM(
          template,
          translation,
          validUsers,
          req,
          'shared',
          0 // Use 0 as placeholder - we'll create records after successful sends
        );
      } catch (err) {
        throw new Error(`FCM ASYNC SEND ERROR: ${err}`);
      }
      if (
        !fcmResult ||
        typeof fcmResult !== 'object' ||
        !('successfulCount' in fcmResult)
      ) {
        throw new Error('FCM send failed or returned invalid result');
      }
      console.log(
        `📊 FCM send result: ${fcmResult.successfulCount} successful, ${fcmResult.failedCount} failed`
      );
      if (fcmResult.failedUsers && fcmResult.failedUsers.length > 0) {
        console.log(
          `❌ [sendNow] FAILED USERS LIST - ${fcmResult.failedUsers.length} user(s) failed to receive notification:`
        );
      }
      if (fcmResult.successfulCount === 0) {
        let errorMessage = 'Failed to send notification to any users.';
        if (fcmResult.failedCount > 0) {
          errorMessage = `Invalid Failed to send notification to any users. All ${fcmResult.failedCount} attempts failed.`;
        }
        const baseUrl = this.baseFunctionHelper
          ? this.baseFunctionHelper.getBaseUrl(req)
          : 'http://localhost:4005';
        const userLanguage = (dto.language || Language.KM) as Language;
        const imageId = translation?.imageId || null;
        const imageUrl = imageId
          ? this.imageService.buildImageUrl(imageId, req)
          : '';
        const isV2 =
          (req as any)?.version === '2' ||
          req?.url?.includes('/v2/') ||
          req?.originalUrl?.includes('/v2/');
        const categoryIcon =
          isV2 && template?.categoryTypeId
            ? InboxResponseDto.buildCategoryIconUrl(
                baseUrl,
                template.categoryTypeId
              )
            : undefined;
        const whatNewsObject = InboxResponseDto.buildSendApiNotificationData(
          template,
          translation,
          userLanguage,
          typeof imageUrl === 'string' ? imageUrl : '',
          0, // No record ID
          1,
          baseUrl,
          req,
          categoryIcon,
          fcmResult.failedUsers
        );
        const errorResponseData: any = {
          whatnews: whatNewsObject,
          successfulCount: 0,
          failedCount:
            fcmResult.failedCount + (notFoundAccountIds?.length || 0),
          failedUsers: [
            ...new Set([
              ...(fcmResult.failedUsers || []),
              ...(notFoundAccountIds || []),
            ]),
          ],
          failedDueToInvalidTokens: fcmResult.failedDueToInvalidTokens || false,
        };
        errorResponseData.successfulUsers = [];
        return BaseResponseDto.error({
          errorCode: 1, // Traditional error code
          message: errorMessage,
          data: errorResponseData,
        });
      }
      const failedUserAccountIds = new Set(
        (fcmResult.failedUsers || []).map((u: any) => String(u))
      );
      const successfulUsers = validUsers.filter(
        (u) => !failedUserAccountIds.has(String(u.accountId))
      );
      if (successfulUsers.length === 0) {
        throw new Error(
          'No successful users to create notification records for'
        );
      }
      console.log(
        `✅ [sendNow] Creating notification records for ${successfulUsers.length} successful user(s)`
      );
      const savedRecords = await Promise.all(
        successfulUsers.map((u) =>
          this.storeNotification({
            accountId: u.accountId,
            templateId: template.id,
            fcmToken: u.fcmToken,
            sendCount: 1,
            firebaseMessageId: 0, // Will be updated after FCM send
            language: translation.language,
          })
        )
      );
      if (
        fcmResult &&
        typeof fcmResult === 'object' &&
        'successfulSends' in fcmResult &&
        fcmResult.successfulSends
      ) {
        const successfulSends = (fcmResult as any).successfulSends as Array<{
          accountId: string;
          messageId: string;
        }>;
        const messageIdMap = new Map(
          successfulSends.map((s) => [s.accountId, s.messageId])
        );
        for (const record of savedRecords) {
          const messageIdStr = messageIdMap.get(record.accountId);
          if (messageIdStr) {
            try {
              const messageId =
                ValidationHelper.validateFirebaseMessageId(messageIdStr);
              await this.notiRepo.update(
                { id: record.id },
                { firebaseMessageId: messageId }
              );
              console.log(
                `✅ [sendNow] Updated firebaseMessageId for notification ${record.id} (accountId: ${record.accountId}): ${messageId}`
              );
            } catch (updateError) {
              console.error(
                `❌ [sendNow] Failed to update firebaseMessageId for notification ${record.id}:`,
                updateError
              );
            }
          }
        }
      }
      savedRecords.sort((a, b) => b.id - a.id);
      const successfulRecord = savedRecords[0];
      console.log(
        `✅ [sendNow] Using successful notification record ID ${successfulRecord.id} for accountId ${successfulRecord.accountId}`
      );
      const responseTranslation = translation; // Use the KM translation that was sent
      const imageUrl = responseTranslation?.imageId
        ? this.imageService.buildImageUrl(responseTranslation.imageId, req)
        : '';
      await this.templateService.markAsPublished(template.id, req?.user);
      const baseUrl = this.baseFunctionHelper
        ? this.baseFunctionHelper.getBaseUrl(req)
        : 'http://localhost:4005';
      const userLanguage = (dto.language || Language.KM) as Language;
      const isV2 =
        (req as any)?.version === '2' ||
        req?.url?.includes('/v2/') ||
        req?.originalUrl?.includes('/v2/');
      const categoryIcon =
        isV2 && template?.categoryTypeId
          ? InboxResponseDto.buildCategoryIconUrl(
              baseUrl,
              template.categoryTypeId
            )
          : undefined;
      const whatNews = InboxResponseDto.buildSendApiNotificationData(
        template,
        responseTranslation, // KM translation (what was sent)
        userLanguage, // User's language for categoryType/date display
        typeof imageUrl === 'string' ? imageUrl : '',
        successfulRecord.id,
        successfulRecord.sendCount,
        baseUrl,
        req,
        categoryIcon,
        fcmResult && typeof fcmResult === 'object' && 'failedUsers' in fcmResult
          ? fcmResult.failedUsers
          : undefined
      );
      const responseData: any = { whatnews: whatNews };
      if (
        fcmResult &&
        typeof fcmResult === 'object' &&
        'successfulCount' in fcmResult
      ) {
        responseData.successfulCount = fcmResult.successfulCount;
        const fcmFailedUsers = fcmResult.failedUsers || [];
        const notFoundIds = notFoundAccountIds || [];
        const allFailedUsers = [
          ...new Set([...fcmFailedUsers, ...notFoundIds]),
        ];
        responseData.failedUsers = allFailedUsers;
        responseData.failedCount = allFailedUsers.length;
        responseData.failedDueToInvalidTokens =
          fcmResult.failedDueToInvalidTokens || false;
        const successfulUserAccountIds = successfulUsers.map((u) =>
          String(u.accountId)
        );
        responseData.successfulUsers = successfulUserAccountIds;
      }
      return BaseResponseDto.success({
        data: responseData,
        message: `Send ${template.notificationType} to users successfully`,
      });
    } catch (error: any) {
      return BaseResponseDto.error({
        errorCode: error?.code || ErrorCode.INTERNAL_SERVER_ERROR,
        message: `Invalid ${
          error?.message || ResponseMessage.INTERNAL_SERVER_ERROR
        }`,
        data: { notification: {} },
      });
    }
  }

  private async sendFCM(
    template: Template,
    translation: TemplateTranslation,
    validUsers: BakongUser[],
    req?: any,
    mode: 'individual' | 'shared' = 'individual',
    sharedNotificationId?: number
  ): Promise<{
    notificationId: number | null;
    successfulCount: number;
    failedCount: number;
    failedUsers?: string[];
    failedDueToInvalidTokens?: boolean;
    successfulSends?: Array<{ accountId: string; messageId: string }>;
  } | void> {
    console.log('📨 [sendFCM] Starting FCM send process:', {
      templateId: template.id,
      validUsersCount: validUsers.length,
      mode: mode,
    });
    try {
      const successfulNotifications: Array<{ id: number }> = [];
      const failedUsers: Array<{
        accountId: string;
        error: string;
        errorCode?: string;
      }> = [];
      let sharedSuccessfulCount = 0;
      let sharedFailedCount = 0;
      const sharedFailedUsers: Array<{
        accountId: string;
        error: string;
        errorCode?: string;
      }> = [];
      const successfulSends: Array<{ accountId: string; messageId: string }> =
        []; // Track successful sends with message IDs
      const imageUrl = translation.imageId
        ? this.imageService.buildImageUrl(translation.imageId, req)
        : '';
      const imageUrlString = typeof imageUrl === 'string' ? imageUrl : '';
      const title = this.baseFunctionHelper.truncateText(
        'title',
        translation.title
      );
      const body = this.baseFunctionHelper.truncateText(
        'content',
        translation.content
      );
      console.log('📨 [sendFCM] Notification details:', {
        title: title,
        bodyLength: body?.length || 0,
        hasImage: !!imageUrlString,
      });
      const fcmUsers = this.baseFunctionHelper.filterValidFCMUsers(
        validUsers,
        mode
      );
      console.log('📨 [sendFCM] Filtered FCM users:', fcmUsers.length);
      for (const user of fcmUsers) {
        let notificationId: number | null = null;
        try {
          console.log('📨 [sendFCM] Sending to user:', {
            accountId: user.accountId,
            platform: user.platform,
            normalizedPlatform: ValidationHelper.normalizeEnum(user.platform),
            fcmToken: user.fcmToken
              ? `${user.fcmToken.substring(0, 30)}...`
              : 'NO TOKEN',
          });
          if (mode === 'individual') {
            const saved = await this.storeNotification({
              accountId: user.accountId,
              templateId: template.id,
              fcmToken: user.fcmToken,
              sendCount: 1,
              firebaseMessageId: 0,
              language: translation.language,
            });
            notificationId = saved.id;
            console.log(
              '📨 [sendFCM] Created notification record (temporary):',
              notificationId
            );
          } else {
            notificationId = sharedNotificationId ?? 0;
          }
          const notificationIdStr = String(notificationId);
          console.log(
            '📨 [sendFCM] Calling sendFCMPayloadToPlatform for user:',
            user.accountId
          );
          let usedTranslation = translation;
          try {
            if (user.language) {
              const candidate = this.templateService.findBestTranslation(
                template,
                user.language
              );
              if (candidate) usedTranslation = candidate;
            }
          } catch (e) {}
          const userTitle = this.baseFunctionHelper.truncateText(
            'title',
            usedTranslation.title
          );
          const userBody = this.baseFunctionHelper.truncateText(
            'content',
            usedTranslation.content
          );
          const response = await this.sendFCMPayloadToPlatform(
            user,
            template,
            usedTranslation,
            userTitle,
            userBody,
            notificationIdStr,
            imageUrlString,
            mode,
            req
          );
          console.log('📨 [sendFCM] Response from sendFCMPayloadToPlatform:', {
            accountId: user.accountId,
            hasResponse: !!response,
            responseType: typeof response,
            responseValue: response
              ? `${String(response).substring(0, 50)}...`
              : 'NULL',
            userPlatform: user.platform,
            userBakongPlatform: user.bakongPlatform,
            templatePlatforms: template.platforms,
            templateBakongPlatform: template.bakongPlatform,
          });
          if (response) {
            const responseString =
              typeof response === 'string'
                ? response
                : JSON.stringify(response);
            successfulSends.push({
              accountId: user.accountId,
              messageId: responseString, // Store full response string for parsing
            });
            if (
              mode === 'individual' ||
              (mode === 'shared' && notificationId && notificationId > 0)
            ) {
              await this.updateNotificationRecord(
                user,
                template,
                notificationId!,
                responseString,
                mode
              );
            }
            console.log(
              '✅ [sendFCM] Successfully sent to user:',
              user.accountId
            );
            if (mode === 'individual') {
              successfulNotifications.push({ id: notificationId! });
            } else if (mode === 'shared') {
              sharedSuccessfulCount++;
            }
          } else {
            console.warn(
              '⚠️ [sendFCM] No response from FCM for user:',
              user.accountId
            );
            if (mode === 'individual' && notificationId) {
              try {
                await this.notiRepo.delete({ id: notificationId });
                console.log(
                  `🗑️ [sendFCM] Deleted notification record ${notificationId} due to failed FCM send`
                );
              } catch (deleteError) {
                console.error(
                  `❌ [sendFCM] Failed to delete notification record ${notificationId}:`,
                  deleteError
                );
              }
            }
            if (mode === 'individual') {
              failedUsers.push({
                accountId: user.accountId,
                error:
                  'No response from FCM (platform mismatch or unrecognized platform)',
                errorCode: 'NO_RESPONSE',
              });
            } else if (mode === 'shared') {
              sharedFailedCount++;
              sharedFailedUsers.push({
                accountId: user.accountId,
                error:
                  'No response from FCM (platform mismatch or unrecognized platform)',
              });
            }
          }
        } catch (error: any) {
          const errorCode =
            error?.firebaseErrorCode || // Explicit Firebase code property we set
            error?.code || // Direct code property
            error?.originalError?.code || // From original Firebase error
            error?.originalError?.errorInfo?.code || // From Firebase errorInfo structure
            error?.message?.match(/\(code: ([^)]+)\)/)?.[1] || // Extract from message like "(code: messaging/invalid-argument)"
            'UNKNOWN_ERROR';
          const errorMessage = error?.message || 'Unknown error';
          console.error('❌ [sendFCM] Failed to send to user:', {
            accountId: user.accountId,
            errorMessage: errorMessage,
            errorCode: errorCode,
            errorDetails:
              error?.details || error?.originalError?.details || 'N/A',
            userPlatform: user.platform,
            userBakongPlatform: user.bakongPlatform,
            templatePlatforms: template.platforms,
            templateBakongPlatform: template.bakongPlatform,
            tokenPrefix: user.fcmToken
              ? `${user.fcmToken.substring(0, 30)}...`
              : 'NO TOKEN',
            tokenLength: user.fcmToken?.length || 0,
            fullError:
              process.env.NODE_ENV === 'development'
                ? error
                : 'Hidden in production',
          });
          if (mode === 'individual' && notificationId) {
            try {
              await this.notiRepo.delete({ id: notificationId });
              console.log(
                `🗑️ [sendFCM] Deleted notification record ${notificationId} due to FCM send error: ${errorMessage} (code: ${errorCode})`
              );
            } catch (deleteError) {
              console.error(
                `❌ [sendFCM] Failed to delete notification record ${notificationId}:`,
                deleteError
              );
            }
          }
          if (mode === 'individual') {
            failedUsers.push({
              accountId: user.accountId,
              error: errorMessage,
              errorCode: errorCode,
            });
          } else if (mode === 'shared') {
            sharedFailedCount++;
            sharedFailedUsers.push({
              accountId: user.accountId,
              error: errorMessage,
              errorCode: errorCode,
            });
          }
          const isInvalidTokenError =
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/invalid-argument' ||
            errorCode === 'messaging/authentication-error' ||
            errorCode === 'messaging/server-unavailable';
          if (isInvalidTokenError) {
            console.log(
              `⚠️ [sendFCM] Invalid token detected for user ${user.accountId} (error: ${errorCode})`
            );
            console.log(
              `📝 [sendFCM] Token format was valid but Firebase rejected it. Possible reasons:`
            );
            console.log(
              `   3. APNs certificate not configured (for iOS tokens)`
            );
            console.log(
              `📝 [sendFCM] User will be skipped in future sends until mobile app updates token via API`
            );
          } else {
            const mightBeInvalidToken =
              errorCode.includes('registration-token') ||
              errorCode.includes('invalid-registration') ||
              errorCode.includes('invalid-argument') ||
              errorCode.includes('invalid-token');
            if (mightBeInvalidToken) {
              console.warn(
                `⚠️ [sendFCM] FCM send failed for user ${user.accountId} - error code suggests invalid token but wasn't recognized (code: ${errorCode})`
              );
              console.warn(
                `   This might indicate: Token expired, invalidated, or belongs to different Firebase project`
              );
            } else {
              console.warn(
                `⚠️ [sendFCM] FCM send failed for user ${user.accountId} but error is NOT invalid token (code: ${errorCode})`
              );
              console.warn(
                `   This might indicate: Firebase configuration issue, network problem, or other FCM error`
              );
            }
          }
          continue;
        }
      }
      const totalSuccessful =
        mode === 'individual'
          ? successfulNotifications.length
          : sharedSuccessfulCount;
      const totalFailed =
        mode === 'individual' ? failedUsers.length : sharedFailedCount;
      console.log('📨 [sendFCM] Send process complete:', {
        successful: totalSuccessful,
        failed: totalFailed,
        total: fcmUsers.length,
        mode: mode,
      });
      const allFailedUsers =
        mode === 'individual' ? failedUsers : sharedFailedUsers;
      if (allFailedUsers.length > 0) {
        const failedAccountIds = allFailedUsers.map((u) => u.accountId);
        console.log(
          `❌ [sendFCM] FAILED USERS SUMMARY - ${allFailedUsers.length} user(s) failed:`
        );
        console.log(
          'Failed Account IDs:',
          JSON.stringify(failedAccountIds, null, 2)
        );
        allFailedUsers.forEach((failedUser, index) => {
          console.log(
            `  ${index + 1}. ${failedUser.accountId}: ${failedUser.error}${
              failedUser.errorCode ? ` (Code: ${failedUser.errorCode})` : ''
            }`
          );
        });
      }
      const result = InboxResponseDto.buildFCMResult(
        mode,
        successfulNotifications,
        failedUsers,
        fcmUsers,
        sharedNotificationId,
        sharedSuccessfulCount,
        sharedFailedCount,
        sharedFailedUsers
      );
      return {
        ...result,
        successfulSends: successfulSends,
      };
    } catch (error: any) {
      const allFailedUsers = validUsers.map((u) => ({
        accountId: u.accountId,
        error: error.message || 'Critical error in sendFCM',
      }));
      const errorResult = InboxResponseDto.buildFCMResult(
        mode,
        [],
        [],
        validUsers,
        undefined,
        0,
        validUsers.length,
        allFailedUsers
      );
      return {
        ...errorResult,
        successfulSends: [],
      };
    }
  }

  private async sendFCMPayloadToPlatform(
    user: BakongUser,
    template: Template,
    translation: TemplateTranslation,
    title: string,
    body: string,
    notificationIdStr: string,
    imageUrlString: string,
    mode: 'individual' | 'shared',
    req?: any
  ): Promise<string | null> {
    const templatePlatformsArray = ValidationHelper.parsePlatforms(
      template.platforms
    );
    const normalizedTemplatePlatforms = templatePlatformsArray
      .map((p) => ValidationHelper.normalizeEnum(p))
      .filter((p) => p === 'ALL' || p === 'IOS' || p === 'ANDROID');
    const targetsAllPlatforms = normalizedTemplatePlatforms.includes('ALL');
    const normalizedUserPlatform = user.platform
      ? ValidationHelper.normalizeEnum(user.platform)
      : null;
    if (!targetsAllPlatforms && normalizedUserPlatform) {
      const platformMatches = normalizedTemplatePlatforms.some(
        (p) => normalizedUserPlatform === p
      );
      if (!platformMatches) {
        console.warn(
          `⚠️ [sendFCMPayloadToPlatform] SKIPPING user ${
            user.accountId
          }: platform "${
            user.platform
          }" (normalized: "${normalizedUserPlatform}") does NOT match template platforms [${normalizedTemplatePlatforms.join(
            ', '
          )}]`
        );
        return null;
      }
    }
    const platform = ValidationHelper.isPlatform(user.platform);
    console.log('📱 [sendFCMPayloadToPlatform] Platform detection:', {
      userPlatform: user.platform,
      normalizedUserPlatform: normalizedUserPlatform,
      templatePlatforms: normalizedTemplatePlatforms,
      targetsAllPlatforms: targetsAllPlatforms,
      isIOS: platform.ios,
      isAndroid: platform.android,
      mode: mode,
    });
    const response: string | null = null;
    if (platform.ios) {
      console.log(
        '📱 [sendFCMPayloadToPlatform] Preparing iOS notification...'
      );
      const iosTitleMaxLength = 40; // Conservative limit for APNs alert title
      const iosBodyMaxLength = 100; // Conservative limit for APNs alert body
      const iosTitle =
        title && title.length > iosTitleMaxLength
          ? title.substring(0, iosTitleMaxLength - 3) + '...'
          : title || '';
      const iosBody =
        body && body.length > iosBodyMaxLength
          ? body.substring(0, iosBodyMaxLength - 3) + '...'
          : body || '';
      console.log('📱 [sendFCMPayloadToPlatform] iOS text truncation:', {
        originalTitleLength: title?.length || 0,
        truncatedTitleLength: iosTitle.length,
        originalBodyLength: body?.length || 0,
        truncatedBodyLength: iosBody.length,
        note: 'Full text still available in data payload for app to display',
      });
      const whatNews = InboxResponseDto.buildBaseNotificationData(
        template,
        translation,
        translation.language,
        imageUrlString,
        parseInt(notificationIdStr),
        undefined, // sendCount
        undefined, // baseUrl
        req // Pass req for version awareness
      );
      if (whatNews && typeof whatNews === 'object') {
        const MAX_CONTENT_LENGTH_FOR_IOS = 500; // Very conservative limit for Khmer/Unicode text
        const MAX_TITLE_LENGTH_FOR_IOS = 100; // Title also appears multiple times
        const originalContent = String((whatNews as any).content || '');
        const originalTitle = String((whatNews as any).title || '');
        if (originalContent.length > MAX_CONTENT_LENGTH_FOR_IOS) {
          console.warn(
            '⚠️ [sendFCMPayloadToPlatform] CRITICAL: Content exceeds iOS 4KB payload limit, truncating:',
            {
              originalContentLength: originalContent.length,
              truncatedLength: MAX_CONTENT_LENGTH_FOR_IOS,
              accountId: user.accountId,
              note: 'Full content available via API - mobile app can fetch separately if needed',
            }
          );
          (whatNews as any).content =
            originalContent.substring(0, MAX_CONTENT_LENGTH_FOR_IOS - 3) +
            '...';
        }
        if (originalTitle.length > MAX_TITLE_LENGTH_FOR_IOS) {
          console.warn(
            '⚠️ [sendFCMPayloadToPlatform] Title in data payload is very long, truncating:',
            {
              originalTitleLength: originalTitle.length,
              truncatedLength: MAX_TITLE_LENGTH_FOR_IOS,
              accountId: user.accountId,
            }
          );
          (whatNews as any).title =
            originalTitle.substring(0, MAX_TITLE_LENGTH_FOR_IOS - 3) + '...';
        }
      }
      let iosPayloadResponse =
        mode === 'individual'
          ? InboxResponseDto.buildIOSAlertPayload(
              user.fcmToken,
              iosTitle,
              iosBody,
              notificationIdStr,
              whatNews as unknown as Record<string, string | number>
            )
          : InboxResponseDto.buildIOSPayload(
              user.fcmToken,
              template.notificationType,
              iosTitle,
              iosBody,
              notificationIdStr,
              whatNews as unknown as Record<string, string | number>
            );
      try {
        const fcm = this.getFCM(user.bakongPlatform);
        if (!fcm) {
          console.error(
            '❌ [sendFCMPayloadToPlatform] FCM not available for iOS notification:',
            {
              accountId: user.accountId,
              userBakongPlatform: user.bakongPlatform,
              templateBakongPlatform: template.bakongPlatform,
              error:
                'Firebase Cloud Messaging is not initialized for this bakongPlatform',
            }
          );
          throw new Error(
            `Firebase Cloud Messaging is not initialized for bakongPlatform: ${
              user.bakongPlatform || 'DEFAULT'
            }. Please check Firebase configuration.`
          );
        }
        console.log('📱 [sendFCMPayloadToPlatform] Using FCM instance:', {
          accountId: user.accountId,
          userBakongPlatform: user.bakongPlatform,
          templateBakongPlatform: template.bakongPlatform,
          fcmAvailable: !!fcm,
          note:
            user.bakongPlatform !== template.bakongPlatform
              ? '⚠️ WARNING: User bakongPlatform differs from template bakongPlatform - this might cause issues'
              : '✅ User and template bakongPlatform match',
        });
        console.log('📱 [sendFCMPayloadToPlatform] iOS payload structure:', {
          token: user.fcmToken
            ? `${user.fcmToken.substring(0, 30)}...`
            : 'NO TOKEN',
          hasNotification: !!iosPayloadResponse.notification, // Root-level notification field (like Firebase Console)
          hasApns: !!iosPayloadResponse.apns,
          hasData: !!iosPayloadResponse.data,
          notificationTitle: iosPayloadResponse.notification?.title,
          notificationBody: iosPayloadResponse.notification?.body,
          apnsHeaders: iosPayloadResponse.apns?.headers,
          apsAlert: iosPayloadResponse.apns?.payload?.aps?.alert,
          apsSound: iosPayloadResponse.apns?.payload?.aps?.sound,
          apsBadge: iosPayloadResponse.apns?.payload?.aps?.badge,
          dataKeys: iosPayloadResponse.data
            ? Object.keys(iosPayloadResponse.data)
            : [],
        });
        const sanitizedIOSPayload = {
          ...iosPayloadResponse,
          token: user.fcmToken
            ? `${user.fcmToken.substring(0, 30)}...`
            : 'NO TOKEN',
        };
        console.log(
          '📱 [sendFCMPayloadToPlatform] Full iOS payload:',
          JSON.stringify(sanitizedIOSPayload, null, 2)
        );
        let payloadJsonString = JSON.stringify(iosPayloadResponse);
        let payloadSizeBytes = Buffer.byteLength(payloadJsonString, 'utf8');
        let payloadSizeChars = payloadJsonString.length;
        let currentContentLength = (whatNews as any)?.content?.length || 0;
        const currentTitleLength = (whatNews as any)?.title?.length || 0;
        let truncationAttempts = 0;
        const MAX_TRUNCATION_ATTEMPTS = 10;
        while (
          payloadSizeBytes >= 4096 &&
          truncationAttempts < MAX_TRUNCATION_ATTEMPTS
        ) {
          truncationAttempts++;
          console.warn(
            `⚠️ [sendFCMPayloadToPlatform] Payload exceeds 4KB (${(
              payloadSizeBytes / 1024
            ).toFixed(
              2
            )}KB), truncating further (attempt ${truncationAttempts})...`,
            {
              sizeBytes: payloadSizeBytes,
              sizeKB: (payloadSizeBytes / 1024).toFixed(2),
              currentContentLength,
              currentTitleLength,
              accountId: user.accountId,
            }
          );
          if (
            whatNews &&
            typeof whatNews === 'object' &&
            (whatNews as any).content
          ) {
            const newContentLength = Math.floor(currentContentLength * 0.8);
            const originalContent = String((whatNews as any).content || '');
            if (
              originalContent.length > newContentLength &&
              newContentLength > 50
            ) {
              (whatNews as any).content =
                originalContent.substring(0, newContentLength - 3) + '...';
              currentContentLength = newContentLength;
              iosPayloadResponse =
                mode === 'individual'
                  ? InboxResponseDto.buildIOSAlertPayload(
                      user.fcmToken,
                      iosTitle,
                      iosBody,
                      notificationIdStr,
                      whatNews as unknown as Record<string, string | number>
                    )
                  : InboxResponseDto.buildIOSPayload(
                      user.fcmToken,
                      template.notificationType,
                      iosTitle,
                      iosBody,
                      notificationIdStr,
                      whatNews as unknown as Record<string, string | number>
                    );
              payloadJsonString = JSON.stringify(iosPayloadResponse);
              payloadSizeBytes = Buffer.byteLength(payloadJsonString, 'utf8');
              payloadSizeChars = payloadJsonString.length;
            } else {
              break;
            }
          } else {
            break;
          }
        }
        const payloadSizeKB = (payloadSizeBytes / 1024).toFixed(2);
        console.log('📱 [sendFCMPayloadToPlatform] iOS payload size check:', {
          sizeBytes: payloadSizeBytes,
          sizeChars: payloadSizeChars,
          sizeKB: payloadSizeKB,
          isWithinLimit: payloadSizeBytes < 4096,
          accountId: user.accountId,
          contentLength: currentContentLength,
          titleLength: currentTitleLength,
          truncationAttempts,
          note: 'FCM checks UTF-8 byte size, not character count',
        });
        if (payloadSizeBytes >= 4096) {
          console.error(
            '❌ [sendFCMPayloadToPlatform] iOS payload STILL exceeds 4KB limit after truncation!',
            {
              sizeBytes: payloadSizeBytes,
              sizeChars: payloadSizeChars,
              sizeKB: payloadSizeKB,
              accountId: user.accountId,
              contentLength: currentContentLength,
              titleLength: currentTitleLength,
              truncationAttempts,
              warning:
                'Payload will be rejected by FCM - content too large even after truncation',
            }
          );
          throw new Error(
            `iOS payload exceeds 4KB limit (${payloadSizeKB}KB, ${payloadSizeBytes} bytes) for user ${user.accountId}. Content truncated ${truncationAttempts} times but still too large.`
          );
        }
        console.log(
          '📱 [sendFCMPayloadToPlatform] Sending iOS FCM message...',
          {
            token: user.fcmToken
              ? `${user.fcmToken.substring(0, 30)}...`
              : 'NO TOKEN',
            title: title?.substring(0, 50),
            body: body ? `${body.substring(0, 50)}...` : 'NO BODY',
            bakongPlatform: user.bakongPlatform || 'NULL',
            payloadSizeKB: payloadSizeKB,
          }
        );
        const sendResponse = await fcm.send(iosPayloadResponse);
        console.log('✅ [sendFCMPayloadToPlatform] iOS FCM send successful:', {
          response: sendResponse
            ? `${String(sendResponse).substring(0, 50)}...`
            : 'NO RESPONSE',
          fullResponse: sendResponse,
          messageId: sendResponse,
          bakongPlatform: user.bakongPlatform,
          accountId: user.accountId,
          tokenPrefix: user.fcmToken
            ? `${user.fcmToken.substring(0, 30)}...`
            : 'NO TOKEN',
        });
        console.log(
          '✅ [FCM SEND SUCCESS] iOS Notification sent successfully!'
        );
        console.log(
          'Token (first 50 chars):',
          user.fcmToken ? `${user.fcmToken.substring(0, 50)}...` : 'NO TOKEN'
        );
        console.log(
          '⚠️  IMPORTANT: If notification not received on device, check:'
        );
        console.log(
          '   5. App is properly configured to receive FCM notifications'
        );
        if (!sendResponse || typeof sendResponse !== 'string') {
          console.warn(
            '⚠️ [sendFCMPayloadToPlatform] Unexpected FCM response format:',
            typeof sendResponse
          );
        }
        return sendResponse;
      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        const errorCode = error?.code || error?.errorInfo?.code || 'N/A';
        console.error('❌ [sendFCMPayloadToPlatform] iOS FCM send failed:', {
          accountId: user.accountId,
          errorMessage: errorMessage,
          errorCode: errorCode,
          errorDetails: error?.details || 'N/A',
          fullError:
            process.env.NODE_ENV === 'development'
              ? error
              : 'Hidden in production',
        });
        const wrappedError: any = new Error(
          `iOS FCM send failed: ${errorMessage} (code: ${errorCode})`
        );
        wrappedError.code = errorCode !== 'N/A' ? errorCode : undefined; // Only set if we have a valid code
        wrappedError.originalError = error; // Keep reference to original error for deeper extraction
        wrappedError.firebaseErrorCode =
          errorCode !== 'N/A' ? errorCode : undefined; // Explicit Firebase code property
        throw wrappedError;
      }
    }
    if (platform.android) {
      console.log(
        '📱 [sendFCMPayloadToPlatform] Preparing Android notification...'
      );
      const categoryTypeName = template.categoryTypeEntity?.name;
      const safeCategoryType =
        categoryTypeName &&
        typeof categoryTypeName === 'string' &&
        categoryTypeName.trim() !== ''
          ? categoryTypeName
          : 'NEWS';
      console.log('📱 [sendFCMPayloadToPlatform] Android categoryType check:', {
        templateId: template.id,
        categoryTypeEntityExists: !!template.categoryTypeEntity,
        categoryTypeName: categoryTypeName,
        categoryTypeNameType: typeof categoryTypeName,
        safeCategoryType: safeCategoryType,
        finalCategoryType: String(safeCategoryType),
      });
      const MAX_CONTENT_LENGTH_FOR_ANDROID_INITIAL = 800; // Initial conservative limit for Android
      const MAX_TITLE_LENGTH_FOR_ANDROID = 200; // Title limit for Android
      let androidContent = String(translation.content || '');
      let androidTitle = String(title || '');
      if (androidContent.length > MAX_CONTENT_LENGTH_FOR_ANDROID_INITIAL) {
        console.warn(
          '⚠️ [sendFCMPayloadToPlatform] CRITICAL: Content exceeds Android 4KB payload limit, truncating:',
          {
            originalContentLength: androidContent.length,
            truncatedLength: MAX_CONTENT_LENGTH_FOR_ANDROID_INITIAL,
            accountId: user.accountId,
            note: 'Full content available via API - mobile app can fetch separately if needed',
          }
        );
        androidContent =
          androidContent.substring(
            0,
            MAX_CONTENT_LENGTH_FOR_ANDROID_INITIAL - 3
          ) + '...';
      }
      if (androidTitle.length > MAX_TITLE_LENGTH_FOR_ANDROID) {
        console.warn(
          '⚠️ [sendFCMPayloadToPlatform] Title exceeds Android limit, truncating:',
          {
            originalTitleLength: androidTitle.length,
            truncatedLength: MAX_TITLE_LENGTH_FOR_ANDROID,
            accountId: user.accountId,
          }
        );
        androidTitle =
          androidTitle.substring(0, MAX_TITLE_LENGTH_FOR_ANDROID - 3) + '...';
      }
      const extraData = {
        templateId: template.id,
        notificationType: String(template.notificationType),
        categoryType: String(safeCategoryType),
        language: String(translation.language),
        accountId: String(user.accountId),
        platform: String(user.platform || 'android'),
        imageUrl: imageUrlString || '',
        content: androidContent, // Use truncated content
        linkPreview: translation.linkPreview || '',
        createdDate: template.createdAt
          ? DateFormatter.formatDateByLanguage(
              template.createdAt instanceof Date
                ? template.createdAt
                : new Date(template.createdAt),
              translation.language
            )
          : DateFormatter.formatDateByLanguage(
              new Date(),
              translation.language
            ),
        notification_title: androidTitle, // Use truncated title
        notification_body: body,
      };
      let androidPayload = InboxResponseDto.buildAndroidPayload(
        user.fcmToken,
        androidTitle, // Use truncated title
        body,
        notificationIdStr,
        extraData as any
      );
      let androidPayloadJsonString = JSON.stringify(androidPayload);
      let androidPayloadSizeBytes = Buffer.byteLength(
        androidPayloadJsonString,
        'utf8'
      );
      let androidPayloadSizeChars = androidPayloadJsonString.length;
      let androidContentLength = String(extraData.content || '').length;
      const androidTitleLength = String(title || '').length;
      let androidTruncationAttempts = 0;
      const MAX_ANDROID_TRUNCATION_ATTEMPTS = 10;
      const MAX_ANDROID_PAYLOAD_BYTES = 4096; // FCM 4KB limit
      while (
        androidPayloadSizeBytes >= MAX_ANDROID_PAYLOAD_BYTES &&
        androidTruncationAttempts < MAX_ANDROID_TRUNCATION_ATTEMPTS
      ) {
        androidTruncationAttempts++;
        console.warn(
          `⚠️ [sendFCMPayloadToPlatform] Android payload exceeds 4KB (${(
            androidPayloadSizeBytes / 1024
          ).toFixed(
            2
          )}KB), truncating content (attempt ${androidTruncationAttempts})...`,
          {
            sizeBytes: androidPayloadSizeBytes,
            sizeKB: (androidPayloadSizeBytes / 1024).toFixed(2),
            currentContentLength: androidContentLength,
            currentTitleLength: androidTitleLength,
            accountId: user.accountId,
          }
        );
        const newContentLength = Math.floor(androidContentLength * 0.8);
        if (newContentLength > 50 && androidContentLength > newContentLength) {
          const originalContent = String(extraData.content || '');
          extraData.content =
            originalContent.substring(0, newContentLength - 3) + '...';
          androidContentLength = newContentLength;
          androidPayload = InboxResponseDto.buildAndroidPayload(
            user.fcmToken,
            title,
            body,
            notificationIdStr,
            extraData as any
          );
          androidPayloadJsonString = JSON.stringify(androidPayload);
          androidPayloadSizeBytes = Buffer.byteLength(
            androidPayloadJsonString,
            'utf8'
          );
          androidPayloadSizeChars = androidPayloadJsonString.length;
        } else {
          break;
        }
      }
      const androidPayloadSizeKB = (androidPayloadSizeBytes / 1024).toFixed(2);
      console.log('📱 [sendFCMPayloadToPlatform] Android payload size check:', {
        sizeBytes: androidPayloadSizeBytes,
        sizeChars: androidPayloadSizeChars,
        sizeKB: androidPayloadSizeKB,
        isWithinLimit: androidPayloadSizeBytes < MAX_ANDROID_PAYLOAD_BYTES,
        accountId: user.accountId,
        contentLength: androidContentLength,
        titleLength: androidTitleLength,
        truncationAttempts: androidTruncationAttempts,
        note: 'FCM checks UTF-8 byte size, not character count',
      });
      if (androidPayloadSizeBytes >= MAX_ANDROID_PAYLOAD_BYTES) {
        console.error(
          '❌ [sendFCMPayloadToPlatform] Android payload STILL exceeds 4KB limit after truncation!',
          {
            sizeBytes: androidPayloadSizeBytes,
            sizeChars: androidPayloadSizeChars,
            sizeKB: androidPayloadSizeKB,
            accountId: user.accountId,
            contentLength: androidContentLength,
            titleLength: androidTitleLength,
            truncationAttempts: androidTruncationAttempts,
            warning:
              'Payload will be rejected by FCM - need to truncate content further',
          }
        );
        throw new Error(
          `Android payload exceeds 4KB limit (${androidPayloadSizeKB}KB) for user ${user.accountId}. Content truncated ${androidTruncationAttempts} times but still too large.`
        );
      }
      const msg = androidPayload;
      console.log('📱 [sendFCMPayloadToPlatform] Android payload structure:', {
        token: user.fcmToken
          ? `${user.fcmToken.substring(0, 30)}...`
          : 'NO TOKEN',
        tokenLength: user.fcmToken?.length || 0,
        hasNotification: !!msg.notification,
        hasAndroid: !!msg.android,
        hasData: !!msg.data,
        notificationTitle: msg.notification?.title,
        notificationBody: msg.notification?.body,
        dataKeys: msg.data ? Object.keys(msg.data) : [],
        androidPriority: msg.android?.priority,
        androidTtl: msg.android?.ttl,
        androidCollapseKey: msg.android?.collapseKey,
        androidNotificationChannelId: msg.android?.notification?.channelId,
        androidNotificationSound: msg.android?.notification?.sound,
      });
      const sanitizedPayload = {
        ...msg,
        token: user.fcmToken
          ? `${user.fcmToken.substring(0, 30)}...`
          : 'NO TOKEN',
      };
      console.log(
        '📱 [sendFCMPayloadToPlatform] Full Android payload:',
        JSON.stringify(sanitizedPayload, null, 2)
      );
      try {
        const fcm = this.getFCM(user.bakongPlatform);
        if (!fcm) {
          console.error(
            '❌ [sendFCMPayloadToPlatform] FCM not available for Android notification:',
            {
              accountId: user.accountId,
              userBakongPlatform: user.bakongPlatform,
              templateBakongPlatform: template.bakongPlatform,
              error:
                'Firebase Cloud Messaging is not initialized for this bakongPlatform',
            }
          );
          throw new Error(
            `Firebase Cloud Messaging is not initialized for bakongPlatform: ${
              user.bakongPlatform || 'DEFAULT'
            }. Please check Firebase configuration.`
          );
        }
        console.log('📱 [sendFCMPayloadToPlatform] Using FCM instance:', {
          accountId: user.accountId,
          userBakongPlatform: user.bakongPlatform,
          templateBakongPlatform: template.bakongPlatform,
          fcmAvailable: !!fcm,
          note:
            user.bakongPlatform !== template.bakongPlatform
              ? '⚠️ WARNING: User bakongPlatform differs from template bakongPlatform - this might cause issues'
              : '✅ User and template bakongPlatform match',
        });
        console.log(
          '📱 [sendFCMPayloadToPlatform] Sending Android FCM message...',
          {
            token: user.fcmToken
              ? `${user.fcmToken.substring(0, 30)}...`
              : 'NO TOKEN',
            title: title?.substring(0, 50),
            body: body ? `${body.substring(0, 50)}...` : 'NO BODY',
            bakongPlatform: user.bakongPlatform || 'NULL',
            payloadType: 'notification+data',
            hasClickAction: !!msg.android?.notification?.clickAction,
            clickAction: msg.android?.notification?.clickAction || 'NONE',
          }
        );
        const sendResponse = await fcm.send(msg);
        console.log(
          '✅ [sendFCMPayloadToPlatform] Android FCM send successful:',
          {
            response: sendResponse
              ? `${String(sendResponse).substring(0, 50)}...`
              : 'NO RESPONSE',
            fullResponse: sendResponse,
            messageId: sendResponse,
            bakongPlatform: user.bakongPlatform,
            accountId: user.accountId,
            tokenPrefix: user.fcmToken
              ? `${user.fcmToken.substring(0, 30)}...`
              : 'NO TOKEN',
          }
        );
        console.log(
          'Token (first 50 chars):',
          user.fcmToken ? `${user.fcmToken.substring(0, 50)}...` : 'NO TOKEN'
        );
        if (!sendResponse || typeof sendResponse !== 'string') {
          console.warn(
            '⚠️ [sendFCMPayloadToPlatform] Unexpected FCM response format:',
            typeof sendResponse
          );
        }
        return sendResponse;
      } catch (error: any) {
        const errorMessage = error?.message || 'Unknown error';
        const errorCode = error?.code || error?.errorInfo?.code || 'N/A';
        console.error(
          '❌ [sendFCMPayloadToPlatform] Android FCM send failed:',
          {
            accountId: user.accountId,
            errorMessage: errorMessage,
            errorCode: errorCode,
            errorDetails: error?.details || 'N/A',
            fullError:
              process.env.NODE_ENV === 'development'
                ? error
                : 'Hidden in production',
          }
        );
        const wrappedError: any = new Error(
          `Android FCM send failed: ${errorMessage} (code: ${errorCode})`
        );
        wrappedError.code = errorCode !== 'N/A' ? errorCode : undefined; // Only set if we have a valid code
        wrappedError.originalError = error; // Keep reference to original error for deeper extraction
        wrappedError.firebaseErrorCode =
          errorCode !== 'N/A' ? errorCode : undefined; // Explicit Firebase code property
        throw wrappedError;
      }
    }
    if (!platform.ios && !platform.android) {
      console.warn('⚠️ [sendFCMPayloadToPlatform] Platform not recognized:', {
        userPlatform: user.platform,
        accountId: user.accountId,
        isIOS: platform.ios,
        isAndroid: platform.android,
      });
      console.warn(
        '⚠️ [sendFCMPayloadToPlatform] Skipping notification - platform must be IOS or ANDROID'
      );
      return null;
    }
    return response;
  }

  private async handleFlashNotification(
    template: Template,
    translation: TemplateTranslation,
    dto: SentNotificationDto,
    req?: any
  ) {
    const { language, templateId } = dto;
    const accountId =
      typeof dto.accountId === 'string' && dto.accountId.trim()
        ? dto.accountId.trim()
        : Array.isArray(dto.accountId) && dto.accountId.length > 0
        ? String(dto.accountId[0]).trim()
        : undefined;
    if (!accountId) {
      return BaseResponseDto.error({
        errorCode: ErrorCode.USER_NOT_FOUND,
        message: ResponseMessage.USER_NOT_FOUND,
        data: { accountId: 'No accountId provided for flash notification' },
      });
    }
    const user = await this.baseFunctionHelper.findUserByAccountId(accountId);
    const userBakongPlatform = user?.bakongPlatform;
    let selectedTemplate = template;
    let selectedTranslation = translation;
    if (templateId) {
      selectedTemplate = await this.templateRepo.findOne({
        where: {
          id: templateId,
          notificationType: NotificationType.FLASH_NOTIFICATION,
        },
        relations: ['translations', 'categoryTypeEntity'],
      });
      if (!selectedTemplate) {
        return BaseResponseDto.error({
          errorCode: ErrorCode.TEMPLATE_NOT_FOUND,
          message: ResponseMessage.TEMPLATE_NOT_FOUND,
          data: { templateId },
        });
      }
      if (!selectedTemplate.isSent) {
        return BaseResponseDto.error({
          errorCode: ErrorCode.TEMPLATE_NOT_FOUND,
          message:
            'Template is a draft and cannot be sent. Please publish it first.',
          data: { templateId, isDraft: true },
        });
      }
      if (
        userBakongPlatform &&
        selectedTemplate.bakongPlatform &&
        selectedTemplate.bakongPlatform !== userBakongPlatform
      ) {
        console.warn(
          `⚠️ [handleFlashNotification] Template ${templateId} bakongPlatform (${selectedTemplate.bakongPlatform}) doesn't match user's (${userBakongPlatform})`
        );
      }
      selectedTranslation = this.templateService.findBestTranslation(
        selectedTemplate,
        Language.KM
      );
      if (!selectedTranslation) {
        selectedTranslation = this.templateService.findBestTranslation(
          selectedTemplate,
          undefined
        );
        if (selectedTranslation) {
          console.warn(
            `⚠️ [handleFlashNotification] No Khmer translation found for template ${templateId}, using fallback (${selectedTranslation.language})`
          );
        }
      }
    } else {
      const bestTemplate = await this.templateService.findBestTemplateForUser(
        accountId,
        language,
        this.notiRepo,
        userBakongPlatform // Pass user's bakongPlatform
      );
      if (!bestTemplate) {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const allTemplatesWhere: any = {
          notificationType: NotificationType.FLASH_NOTIFICATION,
          isSent: true,
        };
        if (userBakongPlatform) {
          allTemplatesWhere.bakongPlatform = userBakongPlatform;
        }
        const allAvailableTemplates = await this.templateRepo.find({
          where: allTemplatesWhere,
          select: ['id'],
        });
        const userNotifications = await this.notiRepo.find({
          where: { accountId },
          select: ['templateId', 'createdAt'],
        });
        const todayNotifications = userNotifications.filter((notif) => {
          const createdAt = new Date(notif.createdAt);
          return createdAt >= last24Hours && createdAt <= now;
        });
        const templateCounts = todayNotifications.reduce((acc, notif) => {
          if (notif.templateId) {
            acc[notif.templateId] = (acc[notif.templateId] || 0) + 1;
          }
          return acc;
        }, {} as Record<number, number>);
        const templatesAtLimit = Object.entries(templateCounts)
          .filter(([_, count]) => count >= 2)
          .map(([templateId]) => parseInt(templateId));
        if (
          allAvailableTemplates.length > 0 &&
          templatesAtLimit.length === allAvailableTemplates.length &&
          allAvailableTemplates.every((t) => templatesAtLimit.includes(t.id))
        ) {
          console.warn(
            `⚠️ [handleFlashNotification] All ${allAvailableTemplates.length} templates have reached their limits for user ${accountId}`
          );
          return BaseResponseDto.error({
            errorCode: ErrorCode.FLASH_LIMIT_REACHED_IN_TODAY,
            message: ResponseMessage.FLASH_LIMIT_REACHED_IN_TODAY,
            data: {
              message:
                'You have reached the limit for flash notifications. All available templates have reached their daily or maximum day limits. Please try again later.',
              templatesAtLimit: templatesAtLimit,
              totalTemplates: allAvailableTemplates.length,
            },
          });
        }
        return BaseResponseDto.error({
          errorCode: ErrorCode.NO_FLASH_NOTIFICATION_TEMPLATE_AVAILABLE,
          message: ResponseMessage.NO_FLASH_NOTIFICATION_TEMPLATE_AVAILABLE,
          data: {},
        });
      }
      selectedTemplate = bestTemplate.template;
      selectedTranslation = bestTemplate.translation;
      console.log(
        `📤 [handleFlashNotification] Found template ${
          selectedTemplate.id
        } for user ${accountId} with bakongPlatform: ${
          selectedTemplate.bakongPlatform || 'NULL'
        }`
      );
    }
    if (!selectedTranslation) {
      return BaseResponseDto.error({
        errorCode: ErrorCode.NO_FLASH_NOTIFICATION_TEMPLATE_AVAILABLE,
        message: ResponseMessage.NO_FLASH_NOTIFICATION_TEMPLATE_AVAILABLE,
      });
    }
    const showPerDay = selectedTemplate.showPerDay ?? 1;
    const maxDayShowing = selectedTemplate.maxDayShowing ?? 1;
    console.log(
      `📊 [handleFlashNotification] Template ${selectedTemplate.id} limits: showPerDay=${showPerDay}, maxDayShowing=${maxDayShowing}`
    );
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );
    const todayCount = await this.notiRepo.count({
      where: {
        accountId,
        templateId: selectedTemplate.id,
        createdAt: Between(todayStart, todayEnd),
      },
    });
    console.log(
      `📊 [handleFlashNotification] Template ${selectedTemplate.id} has been sent ${todayCount} times to user ${accountId} today (limit: ${showPerDay} per day)`
    );
    if (todayCount >= showPerDay) {
      console.warn(
        `⚠️ [handleFlashNotification] DAILY LIMIT REACHED: User ${accountId} has already received template ${selectedTemplate.id} ${todayCount} times today (limit: ${showPerDay} per day)`
      );
      return BaseResponseDto.error({
        errorCode: ErrorCode.FLASH_LIMIT_REACHED_IN_TODAY,
        message: ResponseMessage.FLASH_LIMIT_REACHED_IN_TODAY,
        data: {
          templateId: selectedTemplate.id,
          templateTitle: selectedTranslation?.title || 'Unknown',
          sendCount: todayCount,
          limit: showPerDay,
          message: `You have already received this notification ${todayCount} time(s) today. Please try again tomorrow.`,
        },
      });
    }
    const allNotifications = await this.notiRepo.find({
      where: {
        accountId,
        templateId: selectedTemplate.id,
      },
      select: ['createdAt'],
    });
    const distinctDays = new Set<string>();
    allNotifications.forEach((notif) => {
      const date = new Date(notif.createdAt);
      const dayKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      distinctDays.add(dayKey);
    });
    const daysCount = distinctDays.size;
    console.log(
      `📊 [handleFlashNotification] Template ${selectedTemplate.id} has been shown to user ${accountId} for ${daysCount} distinct day(s) (limit: ${maxDayShowing} days)`
    );
    if (daysCount >= maxDayShowing) {
      console.warn(
        `⚠️ [handleFlashNotification] MAX DAYS LIMIT REACHED: User ${accountId} has already seen template ${selectedTemplate.id} for ${daysCount} days (limit: ${maxDayShowing} days)`
      );
      return BaseResponseDto.error({
        errorCode: ErrorCode.FLASH_LIMIT_REACHED_IN_TODAY,
        message: ResponseMessage.FLASH_LIMIT_REACHED_IN_TODAY,
        data: {
          templateId: selectedTemplate.id,
          templateTitle: selectedTranslation?.title || 'Unknown',
          daysCount: daysCount,
          limit: maxDayShowing,
          message: `This notification has already been shown to you for ${daysCount} day(s). The maximum limit of ${maxDayShowing} day(s) has been reached.`,
        },
      });
    }
    const newSendCount = todayCount + 1;
    console.log(
      `✅ [handleFlashNotification] Proceeding to send template ${
        selectedTemplate.id
      } (will be send #${newSendCount} for this user today, day ${
        daysCount + 1
      } of ${maxDayShowing})`
    );
    const saved = await this.storeNotification({
      accountId,
      templateId: selectedTemplate.id,
      fcmToken: user?.fcmToken,
      sendCount: newSendCount,
      firebaseMessageId: 0,
      language: selectedTranslation?.language,
    });
    await this.templateService.markAsPublished(selectedTemplate.id, req?.user);
    const imageUrl = selectedTranslation?.imageId
      ? this.imageService.buildImageUrl(selectedTranslation.imageId, req)
      : '';
    const baseUrl = this.baseFunctionHelper
      ? this.baseFunctionHelper.getBaseUrl(req)
      : 'http://localhost:4005';
    const isV2 =
      (req as any)?.version === '2' ||
      req?.url?.includes('/v2/') ||
      req?.originalUrl?.includes('/v2/');
    const categoryIcon =
      isV2 && selectedTemplate?.categoryTypeId
        ? InboxResponseDto.buildCategoryIconUrl(
            baseUrl,
            selectedTemplate.categoryTypeId
          )
        : undefined;
    const whatNews = InboxResponseDto.buildSendApiNotificationData(
      selectedTemplate,
      selectedTranslation,
      language as Language,
      typeof imageUrl === 'string' ? imageUrl : '',
      saved.id,
      saved.sendCount,
      baseUrl,
      req,
      categoryIcon
    );
    return BaseResponseDto.success({
      data: { whatnews: whatNews },
      message: ResponseMessage.FLASH_NOTIFICATION_POPUP_SUCCESS,
    });
  }

  async getNotificationCenter(dto: NotificationInboxDto, req?: any) {
    try {
      const {
        accountId,
        fcmToken,
        participantCode,
        platform,
        language,
        page,
        size,
        bakongPlatform,
      } = dto;
      const isSyncFlow =
        page === null ||
        page === undefined ||
        size === null ||
        size === undefined;
      console.log('📥 [getNotificationCenter] /inbox API called with:', {
        accountId,
        flow: isSyncFlow ? 'SYNC_DATA' : 'NOTIFICATION_CENTER',
        page: page ?? 'null',
        size: size ?? 'null',
        fcmToken: fcmToken
          ? `${fcmToken.substring(0, 30)}...`
          : fcmToken === ''
          ? 'EMPTY (explicitly cleared)'
          : 'NOT PROVIDED',
        platform: platform || 'N/A',
        language: language || 'N/A',
        bakongPlatform: bakongPlatform || 'N/A',
      });
      if (!bakongPlatform) {
        return BaseResponseDto.error({
          errorCode: ErrorCode.FLASH_NOTIFICATION_POPUP_FAILED,
          message:
            'bakongPlatform is required. Must be one of: BAKONG, BAKONG_JUNIOR, BAKONG_TOURIST',
          data: { accountId },
        });
      }
      const existingUser = await this.baseFunctionHelper.findUserByAccountId(
        accountId
      );
      if (existingUser) {
        console.log(
          `📋 [getNotificationCenter] Existing user found: ${accountId}, current fcmToken: ${
            existingUser.fcmToken
              ? `${existingUser.fcmToken.substring(0, 30)}...`
              : 'EMPTY'
          }`
        );
      } else {
        console.log(`📋 [getNotificationCenter] New user: ${accountId}`);
      }
      console.log(`🔄 [getNotificationCenter] Preparing to sync user data:`, {
        accountId,
        fcmTokenProvided: fcmToken !== undefined,
        fcmTokenValue: fcmToken
          ? `${fcmToken.substring(0, 30)}... (length: ${fcmToken.length})`
          : fcmToken === ''
          ? 'EMPTY STRING'
          : 'UNDEFINED',
        fcmTokenType: typeof fcmToken,
      });
      console.log(`🔄 [getNotificationCenter] Calling updateUserData with:`, {
        accountId,
        fcmToken: fcmToken
          ? `${fcmToken.substring(0, 30)}... (length: ${
              fcmToken.length
            }, type: ${typeof fcmToken})`
          : fcmToken === ''
          ? 'EMPTY STRING'
          : 'UNDEFINED',
        participantCode: participantCode || 'NOT PROVIDED',
        platform: platform || 'NOT PROVIDED',
        language: language || 'NOT PROVIDED',
        bakongPlatform: bakongPlatform || 'NOT PROVIDED',
      });
      const syncData: any = {
        accountId,
      };
      if (fcmToken !== undefined && fcmToken !== null) {
        syncData.fcmToken = fcmToken;
      }
      if (bakongPlatform !== undefined && bakongPlatform !== null) {
        syncData.bakongPlatform = bakongPlatform;
      }
      if (
        participantCode !== undefined &&
        participantCode !== null &&
        participantCode !== ''
      ) {
        syncData.participantCode = participantCode;
      }
      if (platform !== undefined && platform !== null) {
        syncData.platform = platform;
      }
      if (language !== undefined && language !== null) {
        syncData.language = language;
      }
      const syncResult = await this.baseFunctionHelper.updateUserData(syncData);
      if ('isNewUser' in syncResult) {
        const result = syncResult as any;
        console.log(
          `✅ [getNotificationCenter] User sync complete: ${accountId}, isNewUser: ${
            result.isNewUser
          }, savedUser fcmToken: ${
            result.savedUser?.fcmToken
              ? `${result.savedUser.fcmToken.substring(0, 30)}...`
              : 'EMPTY'
          }`
        );
      } else {
        console.log(
          `✅ [getNotificationCenter] All users sync complete: ${
            (syncResult as any).updatedCount
          } users updated`
        );
      }
      const user = await this.baseFunctionHelper.findUserByAccountId(accountId);
      console.log(`🔍 [getNotificationCenter] Re-fetched user after sync:`, {
        accountId,
        found: !!user,
        fcmToken: user?.fcmToken
          ? `${user.fcmToken.substring(0, 30)}... (length: ${
              user.fcmToken.length
            })`
          : 'EMPTY',
        bakongPlatform: user?.bakongPlatform || 'NULL',
        updatedAt: user?.updatedAt,
      });
      if (!user) {
        return BaseResponseDto.error({
          errorCode: ErrorCode.USER_NOT_FOUND,
          message: ResponseMessage.USER_NOT_FOUND,
          data: { accountId },
        });
      }
      const userPlatform = user.bakongPlatform;
      let effectiveLanguage: Language =
        (user.language as Language) || (language as Language) || Language.EN;
      try {
        if (user.bakongPlatform === BakongApp.BAKONG_TOURIST) {
          effectiveLanguage = Language.EN;
          console.log(
            `🔒 [getNotificationCenter] Forcing effective language to EN for BAKONG_TOURIST user ${accountId}`
          );
        }
      } catch (e) {}
      if (isSyncFlow) {
        const isNewUser =
          'isNewUser' in syncResult ? (syncResult as any).isNewUser : false;
        const dataUpdated =
          'isNewUser' in syncResult && 'dataUpdated' in syncResult
            ? (syncResult as any).dataUpdated
            : true; // Default to true if not available (shouldn't happen for single user sync)
        console.log(
          `✅ [getNotificationCenter] Sync flow complete for ${accountId}, isNewUser: ${isNewUser}, dataUpdated: ${dataUpdated}`
        );
        const syncedUser = await this.baseFunctionHelper.findUserByAccountId(
          accountId
        );
        const syncStatus = syncedUser?.syncStatus || null;
        return InboxResponseDto.getSyncResponse(
          accountId,
          userPlatform,
          dataUpdated,
          syncStatus
        );
      }
      const { skip, take } = PaginationUtils.normalizePagination(
        page || 1,
        size || 10
      );
      const queryBuilder = this.notiRepo
        .createQueryBuilder('notification')
        .leftJoinAndSelect('notification.template', 'template')
        .leftJoinAndSelect('template.translations', 'translations')
        .leftJoinAndSelect('template.categoryTypeEntity', 'categoryTypeEntity')
        .where('notification.accountId = :accountId', {
          accountId: accountId.trim(),
        })
        .orderBy('notification.createdAt', 'DESC')
        .skip(skip)
        .take(take);
      const [notifications, totalCount] = await queryBuilder.getManyAndCount();
      const filteredNotifications = [];
      for (const notification of notifications) {
        if (notification.templateId && notification.template) {
          if (!notification.template.translations) {
            notification.template.translations = [];
          }
          if (
            !notification.template.categoryTypeEntity &&
            notification.template.categoryTypeId
          ) {
            console.warn(
              `⚠️ [getNotificationCenter] Template ${notification.templateId} has categoryTypeId ${notification.template.categoryTypeId} but categoryTypeEntity is null`
            );
            if (notification.template.categoryTypeId) {
              const categoryType = await this.templateRepo.manager.findOne(
                CategoryType,
                {
                  where: { id: notification.template.categoryTypeId },
                }
              );
              if (categoryType) {
                notification.template.categoryTypeEntity = categoryType;
              } else {
                console.error(
                  `❌ [getNotificationCenter] CategoryType with id ${notification.template.categoryTypeId} not found in database`
                );
              }
            }
          }
          try {
            const tmpl = notification.template as any;
            if (tmpl && tmpl.bakongPlatform === BakongApp.BAKONG_TOURIST) {
              const hasEN =
                Array.isArray(tmpl.translations) &&
                tmpl.translations.some((t: any) => t.language === 'EN');
              if (
                !hasEN &&
                Array.isArray(tmpl.translations) &&
                tmpl.translations.length > 0
              ) {
                tmpl.translations.forEach((t: any) => {
                  t.language = String(Language.EN);
                });
                console.log(
                  `🔄 [getNotificationCenter] Temporarily marking translations as EN for tourist template ${tmpl.id}`
                );
              }
            }
          } catch (e) {}
          try {
            if (
              notification &&
              notification.template &&
              notification.template.bakongPlatform === BakongApp.BAKONG_TOURIST
            ) {
              if (
                !notification.language ||
                String(notification.language) !== String(Language.EN)
              ) {
                (notification as any).language = String(Language.EN);
                console.log(
                  `🔒 [getNotificationCenter] Temporarily setting notification.language -> EN for notification ${notification.id}`
                );
              }
            }
          } catch (e) {}
          if (
            notification.template &&
            (!notification.template.bakongPlatform ||
              notification.template.bakongPlatform === userPlatform)
          ) {
            filteredNotifications.push(notification);
          }
        } else if (!notification.templateId) {
          filteredNotifications.push(notification);
        } else {
          console.error(
            `❌ [getNotificationCenter] Notification ${notification.id} has templateId ${notification.templateId} but template not found in database. Skipping to prevent null categoryType.`
          );
        }
      }
      const isNewUser =
        'isNewUser' in syncResult ? (syncResult as any).isNewUser : false;
      const filteredCount = filteredNotifications.length;
      return InboxResponseDto.getNotificationCenterResponse(
        filteredNotifications.map(
          (notif) =>
            new InboxResponseDto(
              notif as Notification,
              effectiveLanguage,
              this.baseFunctionHelper.getBaseUrl(req),
              this.templateService,
              this.imageService,
              req
            )
        ),
        PaginationUtils.generateResponseMessage(
          filteredNotifications,
          filteredCount,
          page,
          size,
          PaginationUtils.calculatePaginationMeta(
            page,
            size,
            filteredCount,
            filteredNotifications.length
          ).pageCount,
          isNewUser
        ),
        PaginationUtils.calculatePaginationMeta(
          page,
          size,
          filteredCount,
          filteredNotifications.length
        ),
        userPlatform
      );
    } catch (error) {
      const errorMessage =
        (error as any).message || ResponseMessage.INTERNAL_SERVER_ERROR;
      console.error(
        `❌ [getNotificationCenter] Error for ${dto.accountId}:`,
        errorMessage
      );
      return BaseResponseDto.error({
        errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
        message: ResponseMessage.INTERNAL_SERVER_ERROR,
        data: {
          accountId: dto.accountId,
          error: errorMessage,
        },
      });
    }
  }

  private async storeNotification(params: {
    accountId: string;
    templateId: number;
    fcmToken?: string;
    sendCount?: number;
    firebaseMessageId?: number;
    language?: string;
  }): Promise<Notification> {
    const entity = this.notiRepo.create({
      accountId: params.accountId,
      templateId: params.templateId,
      fcmToken: params.fcmToken ?? '',
      sendCount: params.sendCount ?? 1,
      firebaseMessageId: params.firebaseMessageId ?? 0,
      language: params.language,
    });
    return this.notiRepo.save(entity);
  }

  private async updateNotificationRecord(
    user: BakongUser,
    template: Template,
    notificationId: number,
    response: string,
    mode: 'individual' | 'shared'
  ): Promise<void> {
    const firebaseMessageId =
      ValidationHelper.validateFirebaseMessageId(response);
    if (mode === 'individual') {
      try {
        await this.notiRepo.update(
          { id: notificationId },
          { firebaseMessageId }
        );
        return;
      } catch (error) {
        throw error;
      }
    }
    try {
      if (notificationId > 0) {
        const notification = await this.notiRepo.findOne({
          where: { id: notificationId, accountId: user.accountId },
        });
        if (notification) {
          await this.notiRepo.update(
            { id: notificationId },
            { firebaseMessageId }
          );
          return;
        }
      }
      const latest = await this.notiRepo
        .createQueryBuilder('notification')
        .select('notification.id')
        .where('notification.accountId = :accountId', {
          accountId: user.accountId,
        })
        .andWhere('notification.templateId = :templateId', {
          templateId: template.id,
        })
        .andWhere('notification.firebaseMessageId = 0')
        .orderBy('notification.createdAt', 'DESC')
        .getOne();
      if (latest) {
        await this.notiRepo.update({ id: latest.id }, { firebaseMessageId });
        return;
      }
      const fallbackNotification = await this.notiRepo
        .createQueryBuilder('notification')
        .select('notification.id')
        .where('notification.accountId = :accountId', {
          accountId: user.accountId,
        })
        .orderBy('notification.createdAt', 'DESC')
        .getOne();
      if (fallbackNotification) {
        await this.notiRepo.update(
          { id: fallbackNotification.id },
          { firebaseMessageId }
        );
        return;
      }
    } catch (error) {}
  }

  async deleteNotificationsByTemplateId(templateId: number): Promise<void> {
    try {
      console.log(
        `Deleting all notification records for template ID: ${templateId}`
      );
        const result = await this.notiRepo.delete({ templateId });
      console.log(
        `Deleted ${
          result.affected || 0
        } notification records for template ${templateId}`
      );
    } catch (error) {
      console.error(
        `Error deleting notification records for template ${templateId}:`,
        error
      );
      throw error;
    }
  }

  async updateNotificationTemplateId(
    oldTemplateId: number,
    newTemplateId: number
  ): Promise<void> {
    try {
      console.log(
        `Updating notification records: templateId ${oldTemplateId} -> ${newTemplateId}`
      );
      const result = await this.notiRepo.update(
        { templateId: oldTemplateId },
        { templateId: newTemplateId }
      );
      console.log(
        `Updated ${
          result.affected || 0
        } notification records from template ${oldTemplateId} to ${newTemplateId}`
      );
    } catch (error) {
      console.error(
        `Error updating notification records from template ${oldTemplateId} to ${newTemplateId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Infer bakongPlatform from participantCode or accountId
   * Priority: participantCode > accountId domain
   */
  private inferBakongPlatform(
    participantCode?: string,
    accountId?: string
  ): BakongApp | undefined {
    if (participantCode) {
      const normalized = participantCode.toUpperCase();
      if (normalized.startsWith('BKRT')) {
        return BakongApp.BAKONG;
      }
      if (normalized.startsWith('BKJR')) {
        return BakongApp.BAKONG_JUNIOR;
      }
      if (normalized.startsWith('TOUR')) {
        return BakongApp.BAKONG_TOURIST;
      }
    }
    if (accountId) {
      const normalized = accountId.toLowerCase();
      if (normalized.includes('@bkrt')) {
        return BakongApp.BAKONG;
      }
      if (normalized.includes('@bkjr')) {
        return BakongApp.BAKONG_JUNIOR;
      }
      if (normalized.includes('@tour')) {
        return BakongApp.BAKONG_TOURIST;
      }
    }
    return undefined;
  }
}
