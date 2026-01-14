import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { BakongUser } from 'src/entities/bakong-user.entity'
import { Notification } from 'src/entities/notification.entity'
import { Repository, Between, In } from 'typeorm'
import { Messaging } from 'firebase-admin/messaging'
import { Template } from 'src/entities/template.entity'
import { ValidationHelper } from 'src/common/util/validation.helper'
import { FirebaseManager } from 'src/common/services/firebase-manager.service'
import { PaginationUtils, Platform } from '@bakong/shared'
import { BaseResponseDto } from '../../common/base-response.dto'
import { TemplateService } from '../template/template.service'
import { ImageService } from '../image/image.service'
import { DateFormatter } from '@bakong/shared'
import { ResponseMessage, ErrorCode, BakongApp } from '@bakong/shared'
import { Language, NotificationType } from '@bakong/shared'
import { NotificationV2 } from '@/entities/notification.v2.entity'
import { TemplateV2 } from '@/entities/template.v2.entity'
import { BaseFunctionHelperV2 } from '@/common/util/base-function.v2.helper'
import { TemplateServiceV2 } from '../template-v2/template.v2.service'
import SentNotificationDtoV2 from './dto/send-notification.v2.dto'
import { InboxResponseDtoV2 } from './dto/inbox-response.v2.dto'
import { NotificationInboxDtoV2 } from './dto/notification-inbox.v2.dto'
import { TemplateTranslationV2 } from '@/entities/template-translation.v2.entity'

@Injectable()
export class NotificationServiceV2 {
  constructor(
    @InjectRepository(NotificationV2)
    private readonly notiRepo: Repository<NotificationV2>,
    @InjectRepository(BakongUser)
    private readonly bkUserRepo: Repository<BakongUser>,
    @InjectRepository(TemplateV2)
    private readonly templateRepo: Repository<TemplateV2>,
    private readonly templateService: TemplateServiceV2,
    private readonly imageService: ImageService,
    private readonly baseFunctionHelper: BaseFunctionHelperV2,
  ) { }

  async testFCMToken(
    token: string,
    bakongPlatform?: BakongApp | string | null,
  ): Promise<{
    isValid: boolean
    formatValid: boolean
    firebaseValid: boolean
    error?: string
    errorCode?: string
    messageId?: string
  }> {
    console.log('🧪 [testFCMToken] Starting token test...')
    console.log('🧪 [testFCMToken] Token:', token ? `${token.substring(0, 30)}...` : 'NO TOKEN')
    console.log('🧪 [testFCMToken] Platform:', bakongPlatform || 'DEFAULT')

    // Step 1: Format validation
    const formatValid = ValidationHelper.isValidFCMTokenFormat(token)
    console.log('🧪 [testFCMToken] Format validation:', formatValid ? '✅ PASS' : '❌ FAIL')

    if (!formatValid) {
      return {
        isValid: false,
        formatValid: false,
        firebaseValid: false,
        error: 'Token format is invalid',
        errorCode: 'INVALID_FORMAT',
      }
    }

    // Step 2: Get FCM instance
    const fcm = this.getFCM(bakongPlatform)
    if (!fcm) {
      return {
        isValid: false,
        formatValid: true,
        firebaseValid: false,
        error: 'Firebase FCM is not initialized',
        errorCode: 'FCM_NOT_INITIALIZED',
      }
    }

    // Step 3: Try to send a test notification
    // This will fail if token is invalid
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
    }

    try {
      console.log('🧪 [testFCMToken] Attempting to send test notification...')
      const messageId = await fcm.send(testMessage)
      console.log('✅ [testFCMToken] Token is VALID - notification sent successfully!')
      console.log('✅ [testFCMToken] Message ID:', messageId)

      return {
        isValid: true,
        formatValid: true,
        firebaseValid: true,
        messageId: String(messageId),
      }
    } catch (error: any) {
      const errorCode = error.code || 'UNKNOWN_ERROR'
      const errorMessage = error.message || 'Unknown error'

      console.error('❌ [testFCMToken] Token is INVALID:', {
        errorCode,
        errorMessage,
      })

      // Check for specific invalid token errors
      const isInvalidToken =
        errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token' ||
        errorCode === 'messaging/invalid-argument'

      return {
        isValid: false,
        formatValid: true,
        firebaseValid: !isInvalidToken,
        error: errorMessage,
        errorCode: errorCode,
      }
    }
  }

  private getFCM(bakongPlatform?: string | null): Messaging | null {
    const fcm = FirebaseManager.getMessaging(bakongPlatform)
    if (fcm) {
      const appName = bakongPlatform ? FirebaseManager.getAppName(bakongPlatform) : 'DEFAULT'
      const serviceAccountPath = bakongPlatform
        ? FirebaseManager.getServiceAccountPath(bakongPlatform)
        : null
      console.log(
        `🔥 [getFCM] Using Firebase app: ${appName} for platform: ${bakongPlatform || 'DEFAULT'}`,
      )
      console.log(`🔥 [getFCM] Service account path: ${serviceAccountPath || 'Using default'}`)

      // Try to read and log project_id from service account
      if (serviceAccountPath && require('fs').existsSync(serviceAccountPath)) {
        try {
          const fs = require('fs')
          const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
          console.log(
            `🔥 [getFCM] Firebase Project ID: ${serviceAccount.project_id || 'NOT FOUND'}`,
          )
          console.log(
            `🔥 [getFCM] Service Account Email: ${serviceAccount.client_email || 'NOT FOUND'}`,
          )
        } catch (e: any) {
          console.warn(`⚠️ [getFCM] Could not read service account file: ${e.message}`)
        }
      }
    } else {
      console.error(
        `❌ [getFCM] No FCM instance available for platform: ${bakongPlatform || 'DEFAULT'}`,
      )
    }
    return fcm
  }

  async sendWithTemplate(
    template: Template | TemplateV2,
    req?: any,
  ): Promise<{
    successfulCount: number
    failedCount: number
    failedUsers?: string[]
    failedDueToInvalidTokens?: boolean
  }> {
    console.log('📤 [sendWithTemplate] ========== STARTING SEND PROCESS ==========')
    console.log('📤 [sendWithTemplate] Template ID:', template.id)
    console.log('📤 [sendWithTemplate] Template bakongPlatform:', template.bakongPlatform, `(type: ${typeof template.bakongPlatform})`)
    console.log('📤 [sendWithTemplate] Template created at:', template.createdAt)
    console.log('📤 [sendWithTemplate] Template has translations:', template.translations?.length || 0)
    if (template.translations && template.translations.length > 0) {
      template.translations.forEach((t, idx) => {
        console.log(`📤 [sendWithTemplate] Translation ${idx + 1}:`, {
          language: t.language,
          titleLength: t.title?.length || 0,
          contentLength: t.content?.length || 0,
          titlePreview: t.title ? `${t.title.substring(0, 50)}...` : 'NO TITLE',
        })
      })
    }

    if (!template.translations?.length) {
      console.warn('⚠️ [sendWithTemplate] No translations found for template:', template.id)
      return { successfulCount: 0, failedCount: 0, failedUsers: [] }
    }

    // Parse platforms using shared helper function
    const platformsArray = ValidationHelper.parsePlatforms(template.platforms)

    console.log('📤 [sendWithTemplate] Parsed platforms:', {
      raw: template.platforms,
      parsed: platformsArray,
      type: typeof template.platforms,
      isArray: Array.isArray(template.platforms),
    })

    // Normalize platforms and ensure they're valid Platform enum values
    const normalizedPlatforms = platformsArray
      .map((p) => ValidationHelper.normalizeEnum(p))
      .filter((p) => p === 'ALL' || p === 'IOS' || p === 'ANDROID') // Only allow valid platform values

    if (normalizedPlatforms.length === 0) {
      console.warn('⚠️ [sendWithTemplate] No valid platforms found, defaulting to ALL')
      normalizedPlatforms.push('ALL')
    }

    console.log('📤 [sendWithTemplate] Target platforms:', {
      raw: template.platforms,
      parsed: platformsArray,
      normalized: normalizedPlatforms,
    })

    // Sync and normalize all users before checking availability
    // This cleans up invalid tokens, normalizes platform/language values
    // Note: This doesn't fetch NEW data from external sources - it only normalizes existing data
    // New user data comes from mobile apps when they call /send or /inbox APIs
    console.log('📤 [sendWithTemplate] Syncing and normalizing all users...')
    const syncResult = await this.baseFunctionHelper.syncAllUsers()
    console.log('📤 [sendWithTemplate] User sync complete:', {
      totalUsers: syncResult.totalCount,
      updatedUsers: syncResult.updatedCount,
      invalidTokensCleaned: syncResult.invalidTokens,
      updatedUserIds: syncResult.updatedIds?.slice(0, 10), // Log first 10 for debugging
    })

    // Query users from database again AFTER sync to ensure we have latest data
    // Use QueryBuilder to ensure fresh data (no caching)
    console.log('📤 [sendWithTemplate] Querying users from database again after sync (fresh query)...')
    let users = await this.bkUserRepo
      .createQueryBuilder('user')
      .getMany()
    console.log('📤 [sendWithTemplate] Total users fetched from database:', users.length)

    // DEBUG: Log bakongPlatform values from database to check for NULL or mismatches
    const bakongPlatformDebug: Record<string, number> = {}
    const usersWithNullPlatform: string[] = []
    users.forEach((user) => {
      const platform = user.bakongPlatform || 'NULL'
      bakongPlatformDebug[platform] = (bakongPlatformDebug[platform] || 0) + 1
      if (!user.bakongPlatform) {
        usersWithNullPlatform.push(user.accountId)
      }
    })
    console.log('📤 [sendWithTemplate] DEBUG - BakongPlatform values from database:', bakongPlatformDebug)
    if (usersWithNullPlatform.length > 0) {
      console.warn('⚠️ [sendWithTemplate] DEBUG - Users with NULL bakongPlatform:', usersWithNullPlatform.slice(0, 10))
    }

    // Log specific users that were updated during sync for debugging
    if (syncResult.updatedIds && syncResult.updatedIds.length > 0) {
      const updatedUsers = users.filter((u) => syncResult.updatedIds.includes(u.accountId))
      console.log('📤 [sendWithTemplate] Users that were updated during sync:', {
        count: updatedUsers.length,
        accountIds: updatedUsers.map((u) => u.accountId).slice(0, 10),
        // Log token status for updated users
        tokenStatus: updatedUsers.slice(0, 5).map((u) => ({
          accountId: u.accountId,
          hasToken: !!u.fcmToken?.trim(),
          tokenLength: u.fcmToken?.length || 0,
        })),
      })
    }

    // Filter by bakongPlatform if template has it
    if (template.bakongPlatform) {
      const beforeCount = users.length

      // Log bakongPlatform distribution BEFORE filtering for debugging
      const bakongPlatformBreakdown: Record<string, number> = {}
      const allUsersBeforeFilter = [...users] // Save copy before filtering
      const usersWithTokensBeforeFilter: Array<{ accountId: string; bakongPlatform: string | null; fcmToken: string }> = []

      users.forEach((user) => {
        const platform = user.bakongPlatform || 'NULL'
        bakongPlatformBreakdown[platform] = (bakongPlatformBreakdown[platform] || 0) + 1
        if (user.fcmToken?.trim()) {
          usersWithTokensBeforeFilter.push({
            accountId: user.accountId,
            bakongPlatform: user.bakongPlatform || null,
            fcmToken: user.fcmToken.substring(0, 30) + '...',
          })
        }
      })

      console.log('📤 [sendWithTemplate] ========== BAKONGPLATFORM FILTERING DEBUG ==========')
      console.log('📤 [sendWithTemplate] BakongPlatform distribution BEFORE filtering:', bakongPlatformBreakdown)
      console.log('📤 [sendWithTemplate] Template bakongPlatform:', template.bakongPlatform, `(type: ${typeof template.bakongPlatform})`)
      console.log('📤 [sendWithTemplate] Users with tokens BEFORE filtering:', usersWithTokensBeforeFilter.length)
      if (usersWithTokensBeforeFilter.length > 0) {
        console.log('📤 [sendWithTemplate] Sample users with tokens:', usersWithTokensBeforeFilter.slice(0, 5))
      }

      // Filter users by bakongPlatform (exact match)
      // Normalize both values to ensure consistent comparison (handle string vs enum)
      const templateBakongPlatform = String(template.bakongPlatform).toUpperCase()
      const filteredOutUsers: Array<{ accountId: string; userPlatform: string | null; templatePlatform: string; hasToken: boolean }> = []

      const filteredUsers = users.filter((user) => {
        // Normalize user bakongPlatform for comparison
        const userBakongPlatform = user.bakongPlatform ? String(user.bakongPlatform).toUpperCase() : null
        const matches = userBakongPlatform === templateBakongPlatform

        if (!matches) {
          filteredOutUsers.push({
            accountId: user.accountId,
            userPlatform: user.bakongPlatform || null,
            templatePlatform: template.bakongPlatform,
            hasToken: !!user.fcmToken?.trim(),
          })
        }
        return matches
      })
      users = filteredUsers

      console.log(
        `📤 [sendWithTemplate] Filtered by bakongPlatform (${template.bakongPlatform}): ${beforeCount} → ${users.length} users`,
      )

      // Log users that were filtered out
      if (filteredOutUsers.length > 0) {
        console.log('📤 [sendWithTemplate] Users filtered out due to bakongPlatform mismatch:', filteredOutUsers.length)
        const filteredOutWithTokens = filteredOutUsers.filter((u) => u.hasToken)
        if (filteredOutWithTokens.length > 0) {
          console.warn(
            `⚠️ [sendWithTemplate] ${filteredOutWithTokens.length} user(s) with tokens were filtered out due to bakongPlatform mismatch:`,
            filteredOutWithTokens.slice(0, 10),
          )
        }
      }
      console.log('📤 [sendWithTemplate] ====================================================')

      // Check if no users found for this bakongPlatform
      if (users.length === 0) {
        const platformName =
          template.bakongPlatform === 'BAKONG_TOURIST'
            ? 'Bakong Tourist'
            : template.bakongPlatform === 'BAKONG_JUNIOR'
              ? 'Bakong Junior'
              : 'Bakong'
        throw new Error(
          `No users found for ${platformName} app. Please ensure there are registered users for this platform before sending notifications.`,
        )
      }
    }

    const targetsAllPlatforms = normalizedPlatforms.includes('ALL')
    console.log('📤 [sendWithTemplate] Targeting ALL platforms?', targetsAllPlatforms)

    if (targetsAllPlatforms) {
      console.log(
        '📤 [sendWithTemplate] ✅ "ALL" detected - will send to iOS, Android, and any platform',
      )
    } else {
      console.log('📤 [sendWithTemplate] Targeting specific platforms:', normalizedPlatforms)
    }

    // Log user platforms before filtering for debugging
    const userPlatformBreakdown: Record<string, number> = {}
    users.forEach((user) => {
      const platform = user.platform || 'NULL'
      const normalizedUserPlatform = user.platform
        ? ValidationHelper.normalizeEnum(user.platform)
        : 'NULL'
      const key = `${platform} (normalized: ${normalizedUserPlatform})`
      userPlatformBreakdown[key] = (userPlatformBreakdown[key] || 0) + 1
    })
    console.log('📤 [sendWithTemplate] User platforms BEFORE filtering:', userPlatformBreakdown)

    const matchingUsers = users.filter((user) => {
      if (!user.platform) {
        console.log(`📤 [sendWithTemplate] Filtering out user ${user.accountId}: no platform set`)
        return false
      }
      if (targetsAllPlatforms) {
        return true
      }
      const normalizedUserPlatform = ValidationHelper.normalizeEnum(user.platform)
      const matches = normalizedPlatforms.some((p) => normalizedUserPlatform === p)
      if (!matches) {
        console.log(
          `📤 [sendWithTemplate] Filtering out user ${user.accountId}: platform "${user.platform
          }" (normalized: "${normalizedUserPlatform}") not in target platforms [${normalizedPlatforms.join(
            ', ',
          )}]`,
        )
      }
      return matches
    })

    // Log platform breakdown for debugging
    if (matchingUsers.length > 0) {
      const platformBreakdown: Record<string, number> = {}
      matchingUsers.forEach((user) => {
        const platform = user.platform || 'NULL'
        const normalizedPlatform = user.platform
          ? ValidationHelper.normalizeEnum(user.platform)
          : 'NULL'
        const key = `${platform} (normalized: ${normalizedPlatform})`
        platformBreakdown[key] = (platformBreakdown[key] || 0) + 1
      })
      console.log('📤 [sendWithTemplate] Platform breakdown AFTER filtering:', platformBreakdown)
    } else {
      console.log('📤 [sendWithTemplate] No users match platform filter')
    }

    console.log('📤 [sendWithTemplate] Users matching platform filter:', matchingUsers.length)

    if (!matchingUsers.length) {
      console.warn('⚠️ [sendWithTemplate] No users match the platform filter')
      console.warn(
        `⚠️ [sendWithTemplate] Template platform requirement: ${normalizedPlatforms.join(', ')}`,
      )
      console.warn(
        `⚠️ [sendWithTemplate] Total users checked: ${users.length}, Users filtered out: ${users.length - matchingUsers.length
        }`,
      )
      console.warn('⚠️ [sendWithTemplate] Template will be kept as draft - no matching users found')
      return { successfulCount: 0, failedCount: 0, failedUsers: [] }
    }

    const defaultTranslation = this.templateService.findBestTranslation(template as TemplateV2, Language.EN)
    if (!defaultTranslation) {
      console.warn('⚠️ [sendWithTemplate] No default translation found')
      return { successfulCount: 0, failedCount: 0, failedUsers: [] }
    }

    // Track users with empty/invalid tokens BEFORE filtering
    const usersWithoutTokens = matchingUsers.filter((user) => !user.fcmToken?.trim())
    const usersWithEmptyTokens = usersWithoutTokens.map((user) => ({
      accountId: user.accountId,
      error: 'FCM token is empty or missing',
      errorCode: 'messaging/invalid-registration-token',
    }))

    console.log('📤 [sendWithTemplate] Users without FCM tokens:', usersWithoutTokens.length)
    if (usersWithoutTokens.length > 0) {
      console.log(
        '📤 [sendWithTemplate] Users with empty tokens:',
        usersWithoutTokens.map((u) => u.accountId),
      )
    }

    const usersWithTokens = matchingUsers.filter((user) => user.fcmToken?.trim())
    console.log('📤 [sendWithTemplate] Users with FCM tokens:', usersWithTokens.length)

    // Log specific users for debugging inconsistent sends
    if (usersWithTokens.length > 0) {
      const userDetails = usersWithTokens.map((u) => ({
        accountId: u.accountId,
        platform: u.platform,
        tokenLength: u.fcmToken?.length || 0,
        tokenPrefix: u.fcmToken ? `${u.fcmToken.substring(0, 30)}...` : 'NO TOKEN',
        bakongPlatform: u.bakongPlatform,
      }))
      console.log('📤 [sendWithTemplate] Users with tokens (for debugging):', userDetails.slice(0, 10))
    }

    // Get FCM instance for template's bakongPlatform
    const fcm = this.getFCM(template.bakongPlatform)
    if (!fcm) {
      console.error(
        '❌ [sendWithTemplate] Firebase FCM is not initialized. Cannot send notifications.',
      )
      // Return users with empty tokens as failed
      return {
        successfulCount: 0,
        failedCount: usersWithoutTokens.length,
        failedUsers: usersWithoutTokens.map((u) => u.accountId),
        failedDueToInvalidTokens: usersWithoutTokens.length > 0,
      }
    }

    console.log('📤 [sendWithTemplate] Preparing to send notifications...')
    console.log('📤 [sendWithTemplate] Strategy: Try all format-valid tokens - Firebase will validate during actual send')

    // Skip pre-validation - it's unreliable and slows things down
    // Firebase will reject invalid tokens during actual send, which is more reliable
    // This ensures both old and new templates get the same treatment

    // Filter users with valid token format only
    // CRITICAL: Always try sending to ALL format-valid tokens
    // This ensures old notifications and new notifications both get attempted
    const formatValidUsers = usersWithTokens.filter(
      (user) => user.fcmToken &&
        user.fcmToken.length > 50 &&
        ValidationHelper.isValidFCMTokenFormat(user.fcmToken)
    )

    console.log('📤 [sendWithTemplate] Users with valid token format:', formatValidUsers.length)
    console.log('📤 [sendWithTemplate] Will attempt to send to ALL format-valid tokens (skipping pre-validation for better reliability)')

    // Track users filtered out due to invalid format (too short or wrong format)
    const usersWithInvalidFormat = usersWithTokens.filter(
      (user) => !formatValidUsers.some((vu) => vu.accountId === user.accountId),
    )
    const invalidFormatUsers = usersWithInvalidFormat.map((user) => ({
      accountId: user.accountId,
      error: 'FCM token format is invalid',
      errorCode: 'messaging/invalid-registration-token',
    }))

    console.log(
      '📤 [sendWithTemplate] Users filtered out due to invalid token format:',
      invalidFormatUsers.length,
    )
    if (invalidFormatUsers.length > 0) {
      console.log(
        '📤 [sendWithTemplate] Users with invalid format:',
        invalidFormatUsers.map((u) => u.accountId),
      )
    }

    // ALWAYS try all format-valid tokens - no pre-validation filtering
    // This ensures both old and new templates get the same treatment
    // Firebase will reject invalid tokens during actual send, which is more reliable than pre-validation
    const usersToSend = formatValidUsers

    console.log('📤 [sendWithTemplate] Sending strategy:', {
      formatValid: formatValidUsers.length,
      willSendTo: usersToSend.length,
      note: 'Trying all format-valid tokens - Firebase will reject invalid ones during actual send',
    })

    // Log token prefixes for debugging
    if (usersToSend.length > 0) {
      console.log(
        '📤 [sendWithTemplate] Users that will receive notification:',
        usersToSend.map((u) => ({
          accountId: u.accountId,
          tokenPrefix: u.fcmToken ? `${u.fcmToken.substring(0, 30)}...` : 'NO TOKEN',
          platform: u.platform,
        })),
      )
    }

    if (!usersToSend.length) {
      console.warn('⚠️ [sendWithTemplate] No users available to send to')
      // Return all users with invalid tokens as failed
      const allInvalidUsers = [...usersWithEmptyTokens, ...invalidFormatUsers]
      return {
        successfulCount: 0,
        failedCount: allInvalidUsers.length,
        failedUsers: allInvalidUsers.map((u) => u.accountId),
        failedDueToInvalidTokens: allInvalidUsers.length > 0,
      }
    }

    console.log(`📤 [sendWithTemplate] Attempting to send FCM notifications to ${usersToSend.length} users (all format-valid tokens)...`)
    const result = (await this.sendFCM(
      template as TemplateV2,
      defaultTranslation,
      usersToSend,
      req,
      'individual',
    )) as {
      notificationId: number | null
      successfulCount: number
      failedCount: number
      failedUsers?: string[]
    }

    // Combine users filtered out BEFORE sending (empty/invalid format) with users that failed DURING sending
    const allFailedUsers = [
      ...usersWithEmptyTokens.map((u) => u.accountId),
      ...invalidFormatUsers.map((u) => u.accountId),
      ...(result.failedUsers || []),
    ]

    const totalFailedCount =
      usersWithoutTokens.length + invalidFormatUsers.length + result.failedCount

    // Check if failures are due to invalid tokens (empty, invalid format, or FCM errors)
    // A failure is due to invalid tokens if:
    // 1. Users have empty tokens (filtered before sending) - these are invalid tokens
    // 2. Users have invalid token format (filtered before sending) - these are invalid tokens  
    // 3. FCM send failed due to invalid token errors (during actual send) - check result flag from buildFCMResult
    // Note: buildFCMResult checks error codes to determine if failures are due to invalid tokens
    const hasInvalidTokens =
      usersWithoutTokens.length > 0 ||
      invalidFormatUsers.length > 0 ||

    console.log('✅ [sendWithTemplate] Notification send complete:', {
      successfulCount: result.successfulCount,
      failedCount: totalFailedCount,
      failedUsers: allFailedUsers.length,
      failedDueToEmptyTokens: usersWithoutTokens.length,
      failedDueToInvalidFormat: invalidFormatUsers.length,
      failedDuringSend: result.failedCount,
      totalUsers: matchingUsers.length,
      formatValidUsersAttempted: formatValidUsers.length,
      note: 'Attempted to send to ALL format-valid tokens (no pre-validation filtering)',
    })

    return {
      successfulCount: result.successfulCount,
      failedCount: totalFailedCount,
      failedUsers: allFailedUsers
    }
  }

  async sendNow(dto: SentNotificationDtoV2, req?: any): Promise<BaseResponseDto> {
    const fail = (message: string, errorCode: number, data?: any) =>
      BaseResponseDto.error({
        errorCode,
        message,
        data: data ?? { notification: {} },
      })

    try {
      // 1) language
      const langVal = dto.language ? ValidationHelper.validateLanguage(String(dto.language)) : null
      const language: Language = langVal?.isValid ? (langVal.normalizedValue as Language) : Language.KM

      // 2) accountId list normalize
      const accountIdList: string[] | undefined = Array.isArray(dto.accountId)
        ? dto.accountId.map((x: any) => String(x).trim()).filter(Boolean)
        : typeof dto.accountId === 'string' && dto.accountId.trim()
          ? [dto.accountId.trim()]
          : undefined

      const hasAccountFilter = !!accountIdList?.length
      const isSingleAccount = hasAccountFilter && accountIdList!.length === 1

      // 3) FLASH rule (keep old)
      if (dto.notificationType === NotificationType.FLASH_NOTIFICATION && hasAccountFilter && !isSingleAccount) {
        return fail(
          'FLASH_NOTIFICATION supports only 1 accountId. Please send with a single accountId.',
          ErrorCode.VALIDATION_FAILED,
        )
      }

      // 4) find template (templateId optional)
      let template: TemplateV2 | null = null

      if (dto.templateId) {
        template = await this.templateRepo.findOne({
          where: { id: Number(dto.templateId) },
          relations: ['translations', 'categoryTypeEntity'],
        })
      } else {
        const found = await this.templateService.findNotificationTemplate(dto)
        template = found?.template ?? null

        if (template?.id) {
          template = await this.templateRepo.findOne({
            where: { id: template.id },
            relations: ['translations', 'categoryTypeEntity'],
          })
        }
      }

      if (!template) {
        return fail(ResponseMessage.TEMPLATE_NOT_FOUND, ErrorCode.RECORD_NOT_FOUND)
      }

      // 5) pick translation
      const translations = template.translations || []
      const translation =
        translations.find((t) => String(t.language).toUpperCase() === String(language).toUpperCase()) ||
        translations.find((t) => String(t.language).toUpperCase() === 'EN') ||
        translations[0]

      if (!translation) {
        return fail('Template translation not found', ErrorCode.RECORD_NOT_FOUND)
      }

      // 6) FLASH flow keep old
      if (dto.notificationType === NotificationType.FLASH_NOTIFICATION && isSingleAccount) {
        return await this.handleFlashNotification(template, translation, dto, req)
      }

      // ✅ 7) Resolve bakongPlatform (never null)
      const effectiveBakongPlatform: BakongApp =
        (dto as any)?.bakongPlatform ||
        (template as any)?.bakongPlatform ||
        BakongApp.BAKONG

      // // 8) load users
      // let users = await this.bkUserRepo.find()
      

      // // filter by platform
      // users = users.filter((u) => u.bakongPlatform === effectiveBakongPlatform)
      // if (!users.length) {
      //   return BaseResponseDto.error({
      //     errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
      //     message: ResponseMessage.NO_USERS_FOR_BAKONG_PLATFORM,
      //     data: { bakongPlatform: effectiveBakongPlatform },
      //   })
      // }

      // // 9) NEW accountId filter (generic invalid error)
      // if (hasAccountFilter) {
      //   const allow = new Set(accountIdList!)
      //   const matchedUsers = users.filter((u) => allow.has(String(u.accountId || '').trim()))

      //   const matchedIds = new Set(matchedUsers.map((u) => String(u.accountId || '').trim()))
      //   const missingIds = accountIdList!.filter((id) => !matchedIds.has(id))

      //   const noTokenIds = matchedUsers
      //     .filter((u) => !u.fcmToken || String(u.fcmToken).trim() === '')
      //     .map((u) => String(u.accountId || '').trim())

      //   const usersInvaild = Array.from(new Set([...missingIds, ...noTokenIds])).filter(Boolean)

      //   if (usersInvaild.length > 0) {
      //     return fail('Users are invaild data', ErrorCode.VALIDATION_FAILED, {
      //       usersInvaild,
      //     })
      //   }

      //   users = matchedUsers
      // }

      // // skip missing token in normal mode, but safe anyway
      // users = users.filter((u) => u.fcmToken && String(u.fcmToken).trim() !== '')
      // if (!users.length) {
      //   return fail('No users to send (no valid token)', ErrorCode.RECORD_NOT_FOUND)
      // }

      // 10) imageUrl (FIX: fallback to template.imageId)
      const imageId =
        (translation as any)?.imageId ??
        (template as any)?.imageId ??
        null

      const imageUrl = imageId ? this.imageService.buildImageUrl(imageId, req) : ''
      const imageUrlString = typeof imageUrl === 'string' ? imageUrl : ''

      // // 11) send
      // const sendResult =
      //   (await this.sendFCM(template, translation, users, req, 'individual')) || {
      //     notificationId: 0,
      //     successfulCount: 0,
      //     failedCount: 0,
      //     failedUsers: [],
      //     failedDueToInvalidTokens: false,
      //   }

      // const notificationId = Number((sendResult as any).notificationId || 0)
      // const successfulCount = Number((sendResult as any).successfulCount || 0)

      // // 12) publish
      // await this.templateService.markAsPublished(template.id, req?.user)

            // 8) Load users (with Test Mode support)
            const templateAccountIds = Array.isArray((template as any).accountIds)
            ? (template as any).accountIds
            : []
    
          const cleanedTemplateAccountIds = [...new Set(
            templateAccountIds.map((x: any) => String(x || '').trim()).filter(Boolean),
          )]
    
    
          // If DTO provides accountId filter, it has priority (manual target send).
          const targetIdsFromDto: string[] | null = hasAccountFilter ? accountIdList! : null
    
          // Determine final targeting mode:
          // - If dto.accountId provided: STRICT mode (existing behavior)
          // - Else if template has accountIds: TEST mode (PARTIAL allowed)
          // - Else: ALL users mode
          const isStrictDtoMode = !!targetIdsFromDto?.length
    
          // Query users by platform first
          let users = await this.bkUserRepo
            .createQueryBuilder('user')
            .where('user.bakongPlatform = :bp', { bp: effectiveBakongPlatform })
            .getMany()
    
          if (!users.length) {
            return BaseResponseDto.error({
              errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
              message: ResponseMessage.NO_USERS_FOR_BAKONG_PLATFORM,
              data: { bakongPlatform: effectiveBakongPlatform },
            })
          }
    
          // -------------------------
          // 9) Target filtering logic
          // -------------------------
    
          // Collect failed users list (for UI message)
          let preFailedUsers: string[] = []
    
          if (isStrictDtoMode) {
            // ✅ Keep your existing strict behavior: ANY invalid => fail
            const allow = new Set(targetIdsFromDto!)
            const matchedUsers = users.filter((u) => allow.has(String(u.accountId || '').trim()))
    
            const matchedIds = new Set(matchedUsers.map((u) => String(u.accountId || '').trim()))
            const missingIds = targetIdsFromDto!.filter((id) => !matchedIds.has(id))
    
            const noTokenIds = matchedUsers
              .filter((u) => !u.fcmToken || String(u.fcmToken).trim() === '')
              .map((u) => String(u.accountId || '').trim())
    
            const usersInvaild = Array.from(new Set([...missingIds, ...noTokenIds])).filter(Boolean)
    
            if (usersInvaild.length > 0) {
              return fail('Users are invaild data', ErrorCode.VALIDATION_FAILED, { usersInvaild })
            }
    
            users = matchedUsers
          } else if (cleanedTemplateAccountIds.length > 0) {
            // ✅ TEST MODE: send only to template.accountIds (partial allowed)
          
            const allow = new Set(cleanedTemplateAccountIds)
          
            const matchedUsers = users.filter((u) => allow.has(String(u.accountId || '').trim()))
            const matchedIds = new Set(matchedUsers.map((u) => String(u.accountId || '').trim()))
          
            const missingIds = cleanedTemplateAccountIds.filter((id: string) => !matchedIds.has(id))
          
            const noTokenIds = matchedUsers
            .filter((u) => !u.fcmToken || String(u.fcmToken).trim() === '')
              .map((u) => String(u.accountId || '').trim())
          
            // ✅ record invalid but do NOT hard-fail
            const preFailedUsers: string[] = Array.from(new Set([...missingIds, ...noTokenIds])).filter(Boolean) as string[]
          
            // ✅ only send to matched users WITH token
            users = matchedUsers.filter((u) => u.fcmToken && String(u.fcmToken).trim() !== '')
          
            // ✅ if nobody valid => keep draft and do NOT publish
            if (!users.length) {
              return BaseResponseDto.success({
                message: 'No valid users in test account list. Saved as draft.',
                data: {
                  notificationId: 0,
                  successfulCount: 0,
                  failedCount: preFailedUsers.length,
                  failedUsers: preFailedUsers,
                  savedAsDraftNoUsers: true,
                },
              })
            }
          }
  
          // 10) imageUrl (keep your existing code below)
    
          // 11) send
          const sendResult =
            (await this.sendFCM(template, translation, users, req, 'individual')) || {
              notificationId: 0,
              successfulCount: 0,
              failedCount: 0,
              failedUsers: [],
              failedDueToInvalidTokens: false,
            }
    
          const notificationId = Number((sendResult as any).notificationId || 0)
          const successfulCount = Number((sendResult as any).successfulCount || 0)
          const baseFailedUsers = Array.isArray((sendResult as any).failedUsers)
            ? (sendResult as any).failedUsers
            : []
    
          const mergedFailedUsers = Array.from(new Set([...preFailedUsers, ...baseFailedUsers])).filter(Boolean)
          const mergedFailedCount =
            Number((sendResult as any).failedCount || 0) + preFailedUsers.length
    
          // 12) publish ONLY if at least 1 user received
          if (successfulCount > 0) {
            await this.templateService.markAsPublished(template.id, req?.user)
          } else {
            // ✅ keep as draft
            console.warn('⚠️ sendNow: successfulCount=0 => keep draft, do not mark as published')
          }
    
          // ✅ IMPORTANT: from here, use mergedFailedUsers / mergedFailedCount for response
                // ✅ 13) Build response + FORCE fields for ALL types
            const baseUrl = this.baseFunctionHelper
            ? this.baseFunctionHelper.getBaseUrl(req)
            : 'http://localhost:4005'

          const categoryIcon =
            (template as any)?.categoryTypeId
              ? `${baseUrl}/api/v1/category-type/${(template as any).categoryTypeId}/icon`
              : undefined

          // ✅ USE mergedFailedUsers (includes invalid test ids)
          const whatnews = InboxResponseDtoV2.buildSendApiNotificationData(
            template,
            translation,
            language,
            imageUrlString,
            notificationId,
            successfulCount,
            baseUrl,
            req,
            categoryIcon,
            mergedFailedUsers,
          )

          // ✅ Always same response shape
          ;(whatnews as any).bakongPlatform = effectiveBakongPlatform
          ;(whatnews as any).categoryType =
            (whatnews as any).categoryType ||
            InboxResponseDtoV2.getCategoryDisplayName((template as any)?.categoryTypeEntity, language) ||
            'Other'

          const notificationName = BaseFunctionHelperV2.formatNotificationType(String(template.notificationType))
          return BaseResponseDto.success({
            message: `Send ${notificationName} to users successfully`,
            data: {
              whatnews,
              successfulCount,
              failedCount: mergedFailedCount,
              failedUsers: mergedFailedUsers,
            },
          })
    } catch (error: any) {
      return BaseResponseDto.error({
        errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
        message: error?.message || ResponseMessage.INTERNAL_SERVER_ERROR,
        data: { notification: {} },
      })
    }
  }

  private async sendFCM(
    template: TemplateV2,
    translation: TemplateTranslationV2,
    validUsers: BakongUser[],
    req?: any,
    mode: 'individual' | 'shared' = 'individual',
    sharedNotificationId?: number,
  ): Promise<{
    notificationId: number | null
    successfulCount: number
    failedCount: number
    failedUsers?: string[]
    failedDueToInvalidTokens?: boolean
  } | void> {
    console.log('📨 [sendFCM] Starting FCM send process:', {
      templateId: template.id,
      validUsersCount: validUsers.length,
      mode: mode,
    })

    try {
      const successfulNotifications: Array<{ id: number }> = []
      const failedUsers: Array<{ accountId: string; error: string; errorCode?: string }> = []
      let sharedSuccessfulCount = 0
      let sharedFailedCount = 0
      const sharedFailedUsers: Array<{ accountId: string; error: string; errorCode?: string }> = []

      const defaultTranslation = translation
      const defaultImageId =
        (defaultTranslation as any)?.imageId ?? (template as any)?.imageId ?? null

      const defaultImageUrl = defaultImageId
        ? this.imageService.buildImageUrl(defaultImageId, req)
        : ''

      const defaultImageUrlString = typeof defaultImageUrl === 'string' ? defaultImageUrl : ''

      const defaultTitle = this.baseFunctionHelper.truncateText(
        'title',
        defaultTranslation.title || '',
      )
      const defaultBody = this.baseFunctionHelper.truncateText(
        'content',
        defaultTranslation.content || '',
      )


      console.log('📨 [sendFCM] Notification details:', {
        title: defaultTitle,
        bodyLength: defaultBody?.length || 0,
        hasImage: !!defaultImageUrlString,
      })

      const fcmUsers = this.baseFunctionHelper.filterValidFCMUsers(validUsers, mode)
      console.log('📨 [sendFCM] Filtered FCM users:', fcmUsers.length)

      // SORTING: Sort users by accountId descending to match V1 behavior 
      // (ensures tny_ttny@bkrt is processed before android_theany1)
      if (mode === 'shared') {
        fcmUsers.sort((a, b) => (b.accountId || '').localeCompare(a.accountId || ''))
      }

      const sentTokens = new Set<string>()

      for (const user of fcmUsers) {
        let notificationId: number | null = null
        try {
          const userLanguage = user.language
            ? ValidationHelper.validateLanguage(String(user.language))
            : null
          const preferredLanguage = userLanguage?.isValid
            ? (userLanguage.normalizedValue as Language)
            : undefined
          const selectedTranslation =
            this.templateService.findBestTranslation(template, preferredLanguage) ||
            defaultTranslation
          const title = this.baseFunctionHelper.truncateText(
            'title',
            selectedTranslation.title || '',
          )
          const body = this.baseFunctionHelper.truncateText(
            'content',
            selectedTranslation.content || '',
          )


          const selectedImageId =
            (selectedTranslation as any)?.imageId ?? (template as any)?.imageId ?? null

          const imageUrl = selectedImageId
            ? this.imageService.buildImageUrl(selectedImageId, req)
            : ''
          const imageUrlString = typeof imageUrl === 'string' ? imageUrl : ''

          const token = user.fcmToken?.trim()

          // DEDUPLICATION: Check if this token has already received a notification in this batch
          if (token && sentTokens.has(token)) {
            console.log(`⏭️ [sendFCM] Skipping user ${user.accountId}: duplicate token (already targeted)`)
            sharedFailedCount++
            sharedFailedUsers.push({
              accountId: user.accountId,
              error: 'Duplicate FCM token - skipped to avoid device spam',
              errorCode: 'DUPLICATE_TOKEN',
            })
            continue
          }

          console.log('📨 [sendFCM] Sending to user:', {
            accountId: user.accountId,
            platform: user.platform,
            normalizedPlatform: ValidationHelper.normalizeEnum(user.platform),
            fcmToken: user.fcmToken ? `${user.fcmToken.substring(0, 30)}...` : 'NO TOKEN',
          })

          // For individual mode, we need to create notification record first to get ID for payload
          // But we'll delete it if FCM send fails
          if (mode === 'individual') {
            const saved = await this.storeNotification({
              accountId: user.accountId,
              templateId: template.id,
              fcmToken: user.fcmToken,
              sendCount: 1,
              firebaseMessageId: 0,
            })
            notificationId = saved.id
            console.log('📨 [sendFCM] Created notification record (temporary):', notificationId)
          } else {
            notificationId = sharedNotificationId ?? 0
          }

          const notificationIdStr = String(notificationId)

          // FLASH_NOTIFICATION now sends FCM push like other notification types
          // Mobile app will display it differently (as popup/flash screen)
          // No need to skip - send FCM push for all notification types

          console.log('📨 [sendFCM] Calling sendFCMPayloadToPlatform for user:', user.accountId)
          const response = await this.sendFCMPayloadToPlatform(
            user,
            template,
            selectedTranslation,
            title,
            body,
            notificationIdStr,
            imageUrlString,
            mode,
            req,
          )

          console.log('📨 [sendFCM] Response from sendFCMPayloadToPlatform:', {
            accountId: user.accountId,
            hasResponse: !!response,
            responseType: typeof response,
            responseValue: response ? `${String(response).substring(0, 50)}...` : 'NULL',
            userPlatform: user.platform,
            userBakongPlatform: user.bakongPlatform,
            templatePlatforms: template.platforms,
            templateBakongPlatform: template.bakongPlatform,
          })

          if (response) {
            const responseString =
              typeof response === 'string' ? response : JSON.stringify(response)
            await this.updateNotificationRecord(
              user,
              template,
              notificationId!,
              responseString,
              mode,
            )
            console.log('✅ [sendFCM] Successfully sent to user:', user.accountId)

            // Mark token as sent for deduplication
            if (mode === 'shared' && token) {
              sentTokens.add(token)
            }

            if (mode === 'individual') {
              successfulNotifications.push({ id: notificationId! })
            } else if (mode === 'shared') {
              sharedSuccessfulCount++
            }
          } else {
            console.warn('⚠️ [sendFCM] No response from FCM for user:', user.accountId)
            // Delete notification record if it was created but FCM send failed
            if (mode === 'individual' && notificationId) {
              try {
                await this.notiRepo.delete({ id: notificationId })
                console.log(
                  `🗑️ [sendFCM] Deleted notification record ${notificationId} due to failed FCM send`,
                )
              } catch (deleteError) {
                console.error(
                  `❌ [sendFCM] Failed to delete notification record ${notificationId}:`,
                  deleteError,
                )
              }
            }
            // Count as failed for BOTH individual and shared modes
            if (mode === 'individual') {
              failedUsers.push({
                accountId: user.accountId,
                error: 'No response from FCM (platform mismatch or unrecognized platform)',
                errorCode: 'NO_RESPONSE',
              })
            } else if (mode === 'shared') {
              sharedFailedCount++
              sharedFailedUsers.push({
                accountId: user.accountId,
                error: 'No response from FCM (platform mismatch or unrecognized platform)',
              })
            }
          }
        } catch (error: any) {
          // Extract Firebase error code from wrapped error or original error
          // Check multiple possible locations for the error code
          const errorCode =
          error?.firebaseErrorCode ||
          error?.code ||
          error?.originalError?.code ||
          error?.originalError?.errorInfo?.code ||
          error?.message?.match(/\(code: ([^)]+)\)/)?.[1] ||
            'UNKNOWN_ERROR'

          const errorMessage = error?.message || 'Unknown error'

          console.error('❌ [sendFCM] Failed to send to user:', {
            accountId: user.accountId,
            errorMessage: errorMessage,
            errorCode: errorCode,
            errorDetails: error?.details || error?.originalError?.details || 'N/A',
            userPlatform: user.platform,
            userBakongPlatform: user.bakongPlatform,
            templatePlatforms: template.platforms,
            templateBakongPlatform: template.bakongPlatform,
            tokenPrefix: user.fcmToken ? `${user.fcmToken.substring(0, 30)}...` : 'NO TOKEN',
            tokenLength: user.fcmToken?.length || 0,
            fullError: process.env.NODE_ENV === 'development' ? error : 'Hidden in production',
          })

          // Delete notification record if it was created but FCM send failed
          if (mode === 'individual' && notificationId) {
            try {
              await this.notiRepo.delete({ id: notificationId })
              console.log(
                `🗑️ [sendFCM] Deleted notification record ${notificationId} due to FCM send error: ${errorMessage} (code: ${errorCode})`,
              )
            } catch (deleteError) {
              console.error(
                `❌ [sendFCM] Failed to delete notification record ${notificationId}:`,
                deleteError,
              )
            }
          }

          if (mode === 'individual') {
            failedUsers.push({
              accountId: user.accountId,
              error: errorMessage,
              errorCode: errorCode,
            })
          } else if (mode === 'shared') {
            sharedFailedCount++
            sharedFailedUsers.push({
              accountId: user.accountId,
              error: errorMessage,
              errorCode: errorCode,
            })
          }

          // Check if error is due to invalid token
          // STRATEGY: Keep token that fails FCM sends (don't clear immediately)
          // Reasons:
          // 1. Token might become valid again (rare but possible)
          // 2. Mobile app can update it when they call API
          // 3. Preserves historical data for tracking/debugging
          // 4. Users with invalid tokens are already filtered out before sending (line 321: filter by fcmToken?.trim())
          // 5. Prevents data loss - mobile app will sync new token when they call API
          const isInvalidTokenError =
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/invalid-argument' ||
            errorCode === 'messaging/authentication-error' ||
            errorCode === 'messaging/server-unavailable'

          if (isInvalidTokenError) {
            console.log(
              `⚠️ [sendFCM] Invalid token detected for user ${user.accountId} (error: ${errorCode})`,
            )
            console.log(
              `📝 [sendFCM] Token format was valid but Firebase rejected it. Possible reasons:`,
            )
            console.log(
              `   1. Token expired or invalidated by Firebase`,
            )
            console.log(
              `   2. Token belongs to different Firebase project`,
            )
            console.log(
              `   3. APNs certificate not configured (for iOS tokens)`,
            )
            console.log(
              `   4. Device uninstalled app or token revoked`,
            )
            console.log(
              `📝 [sendFCM] User will be skipped in future sends until mobile app updates token via API`,
            )
            // NOTE: We keep the token because:
            // - Users are filtered by fcmToken?.trim() before sending, so invalid tokens won't cause repeated failures
            // - Mobile app can update token when they call /send or /inbox
            // - Preserves data for debugging and tracking
            // - Only obviously invalid tokens (too short/wrong format) are cleared in syncAllUsers()
          } else {
            // Check if error code is actually an invalid token error but wasn't caught above
            // This can happen if error code extraction failed
            const mightBeInvalidToken =
              errorCode.includes('registration-token') ||
              errorCode.includes('invalid-registration') ||
              errorCode.includes('invalid-argument') ||
              errorCode.includes('invalid-token')

            if (mightBeInvalidToken) {
              console.warn(
                `⚠️ [sendFCM] FCM send failed for user ${user.accountId} - error code suggests invalid token but wasn't recognized (code: ${errorCode})`,
              )
              console.warn(
                `   This might indicate: Token expired, invalidated, or belongs to different Firebase project`,
              )
            } else {
              console.warn(
                `⚠️ [sendFCM] FCM send failed for user ${user.accountId} but error is NOT invalid token (code: ${errorCode})`,
              )
              console.warn(
                `   This might indicate: Firebase configuration issue, network problem, or other FCM error`,
              )
            }
          }

          // Continue to next user instead of throwing - don't stop sending to other users
          continue
        }
      }

      const totalSuccessful =
        mode === 'individual' ? successfulNotifications.length : sharedSuccessfulCount
      const totalFailed = mode === 'individual' ? failedUsers.length : sharedFailedCount

      console.log('📨 [sendFCM] Send process complete:', {
        successful: totalSuccessful,
        failed: totalFailed,
        total: fcmUsers.length,
        mode: mode,
      })

      // Log failed users summary if any - Make it very visible in Docker logs
      const allFailedUsers = mode === 'individual' ? failedUsers : sharedFailedUsers
      if (allFailedUsers.length > 0) {
        const failedAccountIds = allFailedUsers.map((u) => u.accountId)
        console.log('')
        console.log('='.repeat(80))
        console.log(`❌ [sendFCM] FAILED USERS SUMMARY - ${allFailedUsers.length} user(s) failed:`)
        console.log('='.repeat(80))
        console.log('Failed Account IDs:', JSON.stringify(failedAccountIds, null, 2))
        console.log('')
        console.log('Detailed Error Information:')
        allFailedUsers.forEach((failedUser, index) => {
          console.log(
            `  ${index + 1}. ${failedUser.accountId}: ${failedUser.error}${failedUser.errorCode ? ` (Code: ${failedUser.errorCode})` : ''
            }`,
          )
        })
        console.log('='.repeat(80))
        console.log('')
      }

      return InboxResponseDtoV2.buildFCMResult(
        mode,
        successfulNotifications,
        failedUsers,
        fcmUsers,
        sharedNotificationId,
        sharedSuccessfulCount,
        sharedFailedCount,
        sharedFailedUsers,
      )
    } catch (error: any) {
      console.error('❌ [sendFCM] Critical error in sendFCM:', error.message)
      const allFailedUsers = validUsers.map((u) => ({
        accountId: u.accountId,
        error: error.message || 'Critical error in sendFCM',
      }))
      return InboxResponseDtoV2.buildFCMResult(
        mode,
        [],
        [],
        validUsers,
        undefined,
        0,
        validUsers.length,
        allFailedUsers,
      )
    }
  }

  // ✅ Put these helper methods inside your NotificationV2Service class

  private translateCategoryType(name: string, lang: string): string {
    const n = (name || '').trim()
    const L = String(lang || '').toUpperCase()

    const kmMap: Record<string, string> = {
      'News': 'ព័ត៌មាន',
      'Product & Feature': 'ផលិតផល និងមុខងារ',
      'Event': 'ព្រឹត្តិការណ៍',
      'Other': 'ផ្សេងៗ',
    }

    const jpMap: Record<string, string> = {
      'News': 'ニュース',
      'Product & Feature': '製品・機能',
      'Event': 'イベント',
      'Other': 'その他',
    }

    if (L === 'KM') return kmMap[n] ?? n
    if (L === 'JP' || L === 'JA') return jpMap[n] ?? n
    return n // EN fallback
  }

  private buildCategoryIconUrl(req: any, categoryTypeId?: number | null): string | undefined {
    if (!categoryTypeId) return undefined

    const baseUrl = this.baseFunctionHelper?.getBaseUrl(req) || 'http://localhost:4005'

    // ✅ V2 icon endpoint (as you requested)
    // If your API is still v1 for icon, change to:
    // return `${baseUrl}/api/v1/category-type/${categoryTypeId}/icon`
    return `${baseUrl}/api/v2/category-type/${categoryTypeId}/icon`
  }

  private detectIsV2(req?: any): boolean {
    return (
      (req as any)?.version === '2' ||
      String(req?.url || '').includes('/v2/') ||
      String(req?.originalUrl || '').includes('/v2/')
    )
  }

  // ======================================================
  // ✅ FULL FUNCTION (drop-in replacement)
  // ======================================================
  // private async sendFCMPayloadToPlatform(
  //   user: BakongUser,
  //   template: TemplateV2,
  //   translation: TemplateTranslationV2,
  //   title: string,
  //   body: string,
  //   notificationIdStr: string,
  //   imageUrlString: string,
  //   mode: 'individual' | 'shared',
  //   req?: any,
  // ): Promise<string | null> {
  //   const isV2 = this.detectIsV2(req)

  //   // Parse template platforms using shared helper function
  //   const templatePlatformsArray = ValidationHelper.parsePlatforms(template.platforms)

  //   const normalizedTemplatePlatforms = templatePlatformsArray
  //     .map((p) => ValidationHelper.normalizeEnum(p))
  //     .filter((p) => p === 'ALL' || p === 'IOS' || p === 'ANDROID')

  //   const targetsAllPlatforms = normalizedTemplatePlatforms.includes('ALL')
  //   const normalizedUserPlatform = user.platform ? ValidationHelper.normalizeEnum(user.platform) : null

  //   // CRITICAL: Double-check platform match before sending
  //   if (!targetsAllPlatforms && normalizedUserPlatform) {
  //     const platformMatches = normalizedTemplatePlatforms.some((p) => normalizedUserPlatform === p)
  //     if (!platformMatches) {
  //       console.warn(
  //         `⚠️ [sendFCMPayloadToPlatform] SKIPPING user ${user.accountId}: platform "${user.platform
  //         }" (normalized: "${normalizedUserPlatform}") does NOT match template platforms [${normalizedTemplatePlatforms.join(
  //           ', ',
  //         )}]`,
  //       )
  //       return null
  //     }
  //   }

  //   const platform = ValidationHelper.isPlatform(user.platform)

  //   console.log('📱 [sendFCMPayloadToPlatform] Platform detection:', {
  //     userPlatform: user.platform,
  //     normalizedUserPlatform,
  //     templatePlatforms: normalizedTemplatePlatforms,
  //     targetsAllPlatforms,
  //     isIOS: platform.ios,
  //     isAndroid: platform.android,
  //     mode,
  //     isV2,
  //   })

  //   const response: string | null = null

  //   // ======================================================
  //   // ✅ iOS
  //   // ======================================================
  //   if (platform.ios) {
  //     console.log('📱 [sendFCMPayloadToPlatform] Preparing iOS notification...')

  //     // iOS APNs size limits (safe truncation for alert)
  //     const iosTitleMaxLength = 40
  //     const iosBodyMaxLength = 100

  //     const iosTitle =
  //       title && title.length > iosTitleMaxLength
  //         ? title.substring(0, iosTitleMaxLength - 3) + '...'
  //         : title || ''

  //     const iosBody =
  //       body && body.length > iosBodyMaxLength
  //         ? body.substring(0, iosBodyMaxLength - 3) + '...'
  //         : body || ''

  //     // Build base notification data
  //     const whatNews = InboxResponseDtoV2.buildBaseNotificationData(
  //       template,
  //       translation,
  //       translation.language,
  //       imageUrlString,
  //       parseInt(notificationIdStr, 10),
  //       undefined,
  //       this.baseFunctionHelper?.getBaseUrl(req) || 'http://localhost:4005',
  //       req,
  //     )

  //     // ✅ ONLY APPLY IN V2: attach categoryType + categoryIcon into payload data
  //     if (isV2 && whatNews && typeof whatNews === 'object') {
  //       const categoryTypeName = template?.categoryTypeEntity?.name || ''
  //       const categoryType = categoryTypeName
  //         ? this.translateCategoryType(categoryTypeName, String(translation.language))
  //         : ''

  //       const categoryIcon = this.buildCategoryIconUrl(req, template?.categoryTypeId)

  //         ; (whatNews as any).categoryType = categoryType
  //         ; (whatNews as any).categoryIcon = categoryIcon
  //     }

  //     // ---- Keep your iOS payload-size truncation logic (unchanged, but works with added fields)
  //     if (whatNews && typeof whatNews === 'object') {
  //       const MAX_CONTENT_LENGTH_FOR_IOS = 500
  //       const MAX_TITLE_LENGTH_FOR_IOS = 100

  //       const originalContent = String((whatNews as any).content || '')
  //       const originalTitle = String((whatNews as any).title || '')

  //       if (originalContent.length > MAX_CONTENT_LENGTH_FOR_IOS) {
  //         ; (whatNews as any).content =
  //           originalContent.substring(0, MAX_CONTENT_LENGTH_FOR_IOS - 3) + '...'
  //       }
  //       if (originalTitle.length > MAX_TITLE_LENGTH_FOR_IOS) {
  //         ; (whatNews as any).title = originalTitle.substring(0, MAX_TITLE_LENGTH_FOR_IOS - 3) + '...'
  //       }
  //     }

  //     let iosPayloadResponse =
  //       mode === 'individual'
  //         ? InboxResponseDtoV2.buildIOSAlertPayload(
  //           user.fcmToken,
  //           iosTitle,
  //           iosBody,
  //           notificationIdStr,
  //           whatNews as unknown as Record<string, string | number>,
  //         )
  //         : InboxResponseDtoV2.buildIOSPayload(
  //           user.fcmToken,
  //           template.notificationType,
  //           iosTitle,
  //           iosBody,
  //           notificationIdStr,
  //           whatNews as unknown as Record<string, string | number>,
  //         )

  //     try {
  //       const fcm = this.getFCM(user.bakongPlatform)
  //       if (!fcm) {
  //         throw new Error(
  //           `Firebase Cloud Messaging is not initialized for bakongPlatform: ${user.bakongPlatform || 'DEFAULT'}`,
  //         )
  //       }

  //       // Check payload size (4KB)
  //       let payloadJsonString = JSON.stringify(iosPayloadResponse)
  //       let payloadSizeBytes = Buffer.byteLength(payloadJsonString, 'utf8')
  //       let truncationAttempts = 0
  //       const MAX_TRUNCATION_ATTEMPTS = 10

  //       while (payloadSizeBytes >= 4096 && truncationAttempts < MAX_TRUNCATION_ATTEMPTS) {
  //         truncationAttempts++
  //         if (whatNews && typeof whatNews === 'object' && (whatNews as any).content) {
  //           const originalContent = String((whatNews as any).content || '')
  //           const newLen = Math.floor(originalContent.length * 0.8)
  //           if (newLen <= 50) break
  //             ; (whatNews as any).content = originalContent.substring(0, newLen - 3) + '...'

  //           iosPayloadResponse =
  //             mode === 'individual'
  //               ? InboxResponseDtoV2.buildIOSAlertPayload(
  //                 user.fcmToken,
  //                 iosTitle,
  //                 iosBody,
  //                 notificationIdStr,
  //                 whatNews as unknown as Record<string, string | number>,
  //               )
  //               : InboxResponseDtoV2.buildIOSPayload(
  //                 user.fcmToken,
  //                 template.notificationType,
  //                 iosTitle,
  //                 iosBody,
  //                 notificationIdStr,
  //                 whatNews as unknown as Record<string, string | number>,
  //               )

  //           payloadJsonString = JSON.stringify(iosPayloadResponse)
  //           payloadSizeBytes = Buffer.byteLength(payloadJsonString, 'utf8')
  //         } else {
  //           break
  //         }
  //       }

  //       if (payloadSizeBytes >= 4096) {
  //         throw new Error(`iOS payload exceeds 4KB limit (${payloadSizeBytes} bytes)`)
  //       }

  //       const sendResponse = await fcm.send(iosPayloadResponse)
  //       return sendResponse
  //     } catch (error: any) {
  //       const errorMessage = error?.message || 'Unknown error'
  //       const errorCode = error?.code || error?.errorInfo?.code || 'N/A'
  //       const wrappedError: any = new Error(`iOS FCM send failed: ${errorMessage} (code: ${errorCode})`)
  //       wrappedError.code = errorCode !== 'N/A' ? errorCode : undefined
  //       wrappedError.originalError = error
  //       wrappedError.firebaseErrorCode = errorCode !== 'N/A' ? errorCode : undefined
  //       throw wrappedError
  //     }
  //   }

  //   // ======================================================
  //   // ✅ Android
  //   // ======================================================
  //   if (platform.android) {
  //     console.log('📱 [sendFCMPayloadToPlatform] Preparing Android notification...')

  //     const baseUrl = this.baseFunctionHelper
  //       ? this.baseFunctionHelper.getBaseUrl(req)
  //       : 'http://localhost:4005'

  //     const includeCategoryIcon =
  //       isV2 ||
  //       ['true', '1', 'yes'].includes(String((req as any)?.query?.includeCategoryIcon || '').toLowerCase())

  //     const normalizedLanguage = String(translation.language || 'KM').toUpperCase()
  //     const responseLanguage = normalizedLanguage || String(user.language || 'KM').toUpperCase()

  //     // Truncate for Android payload safety
  //     const MAX_CONTENT_LENGTH_FOR_ANDROID_INITIAL = 800
  //     const MAX_TITLE_LENGTH_FOR_ANDROID = 200

  //     let androidContent = String(translation.content || '')
  //     let androidTitle = String(title || '')

  //     if (androidContent.length > MAX_CONTENT_LENGTH_FOR_ANDROID_INITIAL) {
  //       androidContent = androidContent.substring(0, MAX_CONTENT_LENGTH_FOR_ANDROID_INITIAL - 3) + '...'
  //     }
  //     if (androidTitle.length > MAX_TITLE_LENGTH_FOR_ANDROID) {
  //       androidTitle = androidTitle.substring(0, MAX_TITLE_LENGTH_FOR_ANDROID - 3) + '...'
  //     }

  //     // ✅ categoryType (localized display) + categoryIcon (V2 only)
  //     const categoryTypeName = template?.categoryTypeEntity?.name || ''
  //     const categoryTypeDisplay =
  //       isV2 && categoryTypeName
  //         ? this.translateCategoryType(categoryTypeName, responseLanguage)
  //         : String(
  //           InboxResponseDtoV2.getCategoryDisplayName(
  //             template.categoryTypeEntity,
  //             responseLanguage as Language,
  //           ) || '',
  //         )

  //     const categoryIcon = includeCategoryIcon
  //       ? this.buildCategoryIconUrl(req, template?.categoryTypeId)
  //       : undefined

  //     const extraData: Record<string, string> = {
  //       templateId: String(template.id),
  //       notificationType: String(template.notificationType),
  //       language: String(responseLanguage),
  //       accountId: String(user.accountId),
  //       platform: String(user.platform || 'android'),
  //       imageUrl: imageUrlString || '',
  //       content: androidContent,
  //       linkPreview: translation.linkPreview || '',
  //       createdDate: template.createdAt
  //         ? DateFormatter.formatDateByLanguage(
  //           template.createdAt instanceof Date ? template.createdAt : new Date(template.createdAt),
  //           translation.language,
  //         )
  //         : DateFormatter.formatDateByLanguage(new Date(), translation.language),
  //       notification_title: androidTitle,
  //       notification_body: body,
  //     }

  //     // ✅ ONLY APPLY IN V2: include these keys
  //     if (isV2) {
  //       extraData.categoryType = String(categoryTypeDisplay || '')
  //       if (categoryIcon) extraData.categoryIcon = String(categoryIcon)
  //     }

  //     let androidPayload = InboxResponseDtoV2.buildAndroidPayload(
  //       user.fcmToken,
  //       androidTitle,
  //       body,
  //       notificationIdStr,
  //       extraData,
  //     )

  //     // Size guard (4KB)
  //     let androidPayloadJsonString = JSON.stringify(androidPayload)
  //     let androidPayloadSizeBytes = Buffer.byteLength(androidPayloadJsonString, 'utf8')
  //     let androidTruncationAttempts = 0
  //     const MAX_ANDROID_TRUNCATION_ATTEMPTS = 10
  //     const MAX_ANDROID_PAYLOAD_BYTES = 4096

  //     while (
  //       androidPayloadSizeBytes >= MAX_ANDROID_PAYLOAD_BYTES &&
  //       androidTruncationAttempts < MAX_ANDROID_TRUNCATION_ATTEMPTS
  //     ) {
  //       androidTruncationAttempts++

  //       const original = String(extraData.content || '')
  //       const newLen = Math.floor(original.length * 0.8)
  //       if (newLen <= 50) break

  //       extraData.content = original.substring(0, newLen - 3) + '...'

  //       androidPayload = InboxResponseDtoV2.buildAndroidPayload(
  //         user.fcmToken,
  //         androidTitle,
  //         body,
  //         notificationIdStr,
  //         extraData,
  //       )

  //       androidPayloadJsonString = JSON.stringify(androidPayload)
  //       androidPayloadSizeBytes = Buffer.byteLength(androidPayloadJsonString, 'utf8')
  //     }

  //     if (androidPayloadSizeBytes >= MAX_ANDROID_PAYLOAD_BYTES) {
  //       throw new Error(`Android payload exceeds 4KB limit (${androidPayloadSizeBytes} bytes)`)
  //     }

  //     try {
  //       const fcm = this.getFCM(user.bakongPlatform)
  //       if (!fcm) {
  //         throw new Error(
  //           `Firebase Cloud Messaging is not initialized for bakongPlatform: ${user.bakongPlatform || 'DEFAULT'}`,
  //         )
  //       }

  //       const sendResponse = await fcm.send(androidPayload)
  //       return sendResponse
  //     } catch (error: any) {
  //       const errorMessage = error?.message || 'Unknown error'
  //       const errorCode = error?.code || error?.errorInfo?.code || 'N/A'
  //       const wrappedError: any = new Error(
  //         `Android FCM send failed: ${errorMessage} (code: ${errorCode})`,
  //       )
  //       wrappedError.code = errorCode !== 'N/A' ? errorCode : undefined
  //       wrappedError.originalError = error
  //       wrappedError.firebaseErrorCode = errorCode !== 'N/A' ? errorCode : undefined
  //       throw wrappedError
  //     }
  //   }

  //   // If platform is neither iOS nor Android
  //   if (!platform.ios && !platform.android) {
  //     console.warn('⚠️ [sendFCMPayloadToPlatform] Platform not recognized:', {
  //       userPlatform: user.platform,
  //       accountId: user.accountId,
  //       isIOS: platform.ios,
  //       isAndroid: platform.android,
  //     })
  //     return null
  //   }

  //   return response
  // }



  // ======================================================
// ✅ FULL FUNCTION (drop-in replacement) - FIXED safely
// ======================================================
private async sendFCMPayloadToPlatform(
  user: BakongUser,
  template: TemplateV2,
  translation: TemplateTranslationV2,
  title: string,
  body: string,
  notificationIdStr: string,
  imageUrlString: string,
  mode: 'individual' | 'shared',
  req?: any,
): Promise<string | null> {
  const isV2 = this.detectIsV2(req)

  // ✅ FIX 1: Do not send if token missing
  const token = (user?.fcmToken || '').trim()
  if (!token) {
    console.warn(`⚠️ [sendFCMPayloadToPlatform] SKIPPING user ${user.accountId}: fcmToken is empty/null`)
    return null
  }

  // Parse template platforms using shared helper function
  const templatePlatformsArray = ValidationHelper.parsePlatforms(template.platforms)

  const normalizedTemplatePlatforms = templatePlatformsArray
    .map((p) => ValidationHelper.normalizeEnum(p))
    .filter((p) => p === 'ALL' || p === 'IOS' || p === 'ANDROID')

  const targetsAllPlatforms = normalizedTemplatePlatforms.includes('ALL')

  // ✅ FIX 2: Normalize user platform safely
  const rawUserPlatform = (user?.platform || '').trim()
  const normalizedUserPlatform = rawUserPlatform ? ValidationHelper.normalizeEnum(rawUserPlatform) : null

  // ✅ CRITICAL: Double-check platform match before sending
  if (!targetsAllPlatforms) {
    // if template targets specific platform but user platform not known -> skip
    if (!normalizedUserPlatform) {
      console.warn(
        `⚠️ [sendFCMPayloadToPlatform] SKIPPING user ${user.accountId}: user.platform is empty, template requires [${normalizedTemplatePlatforms.join(
          ', ',
        )}]`,
      )
      return null
    }

    const platformMatches = normalizedTemplatePlatforms.some((p) => normalizedUserPlatform === p)
    if (!platformMatches) {
      console.warn(
        `⚠️ [sendFCMPayloadToPlatform] SKIPPING user ${user.accountId}: platform "${user.platform}" (normalized: "${normalizedUserPlatform}") does NOT match template platforms [${normalizedTemplatePlatforms.join(
          ', ',
        )}]`,
      )
      return null
    }
  }

  const platform = ValidationHelper.isPlatform(user.platform)

  console.log('📱 [sendFCMPayloadToPlatform] Platform detection:', {
    userPlatform: user.platform,
    normalizedUserPlatform,
    templatePlatforms: normalizedTemplatePlatforms,
    targetsAllPlatforms,
    isIOS: platform.ios,
    isAndroid: platform.android,
    mode,
    isV2,
  })

  // ======================================================
  // ✅ iOS
  // ======================================================
  if (platform.ios) {
    console.log('📱 [sendFCMPayloadToPlatform] Preparing iOS notification...')

    // iOS APNs size limits (safe truncation for alert)
    const iosTitleMaxLength = 40
    const iosBodyMaxLength = 100

    const iosTitle =
      title && title.length > iosTitleMaxLength
        ? title.substring(0, iosTitleMaxLength - 3) + '...'
        : title || ''

    const iosBody =
      body && body.length > iosBodyMaxLength
        ? body.substring(0, iosBodyMaxLength - 3) + '...'
        : body || ''

    const whatNews = InboxResponseDtoV2.buildBaseNotificationData(
      template,
      translation,
      translation.language,
      imageUrlString,
      parseInt(notificationIdStr, 10),
      undefined,
      this.baseFunctionHelper?.getBaseUrl(req) || 'http://localhost:4005',
      req,
    )

    // ✅ ONLY APPLY IN V2: attach categoryType + categoryIcon into payload data
    if (isV2 && whatNews && typeof whatNews === 'object') {
      const categoryTypeName = template?.categoryTypeEntity?.name || ''
      const categoryType = categoryTypeName
        ? this.translateCategoryType(categoryTypeName, String(translation.language))
        : ''

      const categoryIcon = this.buildCategoryIconUrl(req, template?.categoryTypeId)

      ;(whatNews as any).categoryType = categoryType
      ;(whatNews as any).categoryIcon = categoryIcon
    }

    // Keep truncation logic
    if (whatNews && typeof whatNews === 'object') {
      const MAX_CONTENT_LENGTH_FOR_IOS = 500
      const MAX_TITLE_LENGTH_FOR_IOS = 100

      const originalContent = String((whatNews as any).content || '')
      const originalTitle = String((whatNews as any).title || '')

      if (originalContent.length > MAX_CONTENT_LENGTH_FOR_IOS) {
        ;(whatNews as any).content =
          originalContent.substring(0, MAX_CONTENT_LENGTH_FOR_IOS - 3) + '...'
      }
      if (originalTitle.length > MAX_TITLE_LENGTH_FOR_IOS) {
        ;(whatNews as any).title = originalTitle.substring(0, MAX_TITLE_LENGTH_FOR_IOS - 3) + '...'
      }
    }

    let iosPayloadResponse =
      mode === 'individual'
        ? InboxResponseDtoV2.buildIOSAlertPayload(
            token, // ✅ FIX: use trimmed token
            iosTitle,
            iosBody,
            notificationIdStr,
            whatNews as unknown as Record<string, string | number>,
          )
        : InboxResponseDtoV2.buildIOSPayload(
            token, // ✅ FIX: use trimmed token
            template.notificationType,
            iosTitle,
            iosBody,
            notificationIdStr,
            whatNews as unknown as Record<string, string | number>,
          )

    try {
      const fcm = this.getFCM(user.bakongPlatform)
      if (!fcm) {
        throw new Error(
          `Firebase Cloud Messaging is not initialized for bakongPlatform: ${user.bakongPlatform || 'DEFAULT'}`,
        )
      }

      // Check payload size (4KB)
      let payloadJsonString = JSON.stringify(iosPayloadResponse)
      let payloadSizeBytes = Buffer.byteLength(payloadJsonString, 'utf8')
      let truncationAttempts = 0
      const MAX_TRUNCATION_ATTEMPTS = 10

      while (payloadSizeBytes >= 4096 && truncationAttempts < MAX_TRUNCATION_ATTEMPTS) {
        truncationAttempts++
        if (whatNews && typeof whatNews === 'object' && (whatNews as any).content) {
          const originalContent = String((whatNews as any).content || '')
          const newLen = Math.floor(originalContent.length * 0.8)
          if (newLen <= 50) break
          ;(whatNews as any).content = originalContent.substring(0, newLen - 3) + '...'

          iosPayloadResponse =
            mode === 'individual'
              ? InboxResponseDtoV2.buildIOSAlertPayload(
                  token,
                  iosTitle,
                  iosBody,
                  notificationIdStr,
                  whatNews as unknown as Record<string, string | number>,
                )
              : InboxResponseDtoV2.buildIOSPayload(
                  token,
                  template.notificationType,
                  iosTitle,
                  iosBody,
                  notificationIdStr,
                  whatNews as unknown as Record<string, string | number>,
                )

          payloadJsonString = JSON.stringify(iosPayloadResponse)
          payloadSizeBytes = Buffer.byteLength(payloadJsonString, 'utf8')
        } else {
          break
        }
      }

      if (payloadSizeBytes >= 4096) {
        throw new Error(`iOS payload exceeds 4KB limit (${payloadSizeBytes} bytes)`)
      }

      const sendResponse = await fcm.send(iosPayloadResponse)
      return sendResponse
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error'
      const errorCode = error?.code || error?.errorInfo?.code || 'N/A'
      const wrappedError: any = new Error(`iOS FCM send failed: ${errorMessage} (code: ${errorCode})`)
      wrappedError.code = errorCode !== 'N/A' ? errorCode : undefined
      wrappedError.originalError = error
      wrappedError.firebaseErrorCode = errorCode !== 'N/A' ? errorCode : undefined
      throw wrappedError
    }
  }

  // ======================================================
  // ✅ Android
  // ======================================================
  if (platform.android) {
    console.log('📱 [sendFCMPayloadToPlatform] Preparing Android notification...')

    const includeCategoryIcon =
      isV2 ||
      ['true', '1', 'yes'].includes(String((req as any)?.query?.includeCategoryIcon || '').toLowerCase())

    const normalizedLanguage = String(translation.language || 'KM').toUpperCase()
    const responseLanguage = normalizedLanguage || String(user.language || 'KM').toUpperCase()

    // Truncate for Android payload safety
    const MAX_CONTENT_LENGTH_FOR_ANDROID_INITIAL = 800
    const MAX_TITLE_LENGTH_FOR_ANDROID = 200

    let androidContent = String(translation.content || '')
    let androidTitle = String(title || '')

    if (androidContent.length > MAX_CONTENT_LENGTH_FOR_ANDROID_INITIAL) {
      androidContent = androidContent.substring(0, MAX_CONTENT_LENGTH_FOR_ANDROID_INITIAL - 3) + '...'
    }
    if (androidTitle.length > MAX_TITLE_LENGTH_FOR_ANDROID) {
      androidTitle = androidTitle.substring(0, MAX_TITLE_LENGTH_FOR_ANDROID - 3) + '...'
    }

    const categoryTypeName = template?.categoryTypeEntity?.name || ''
    const categoryTypeDisplay =
      isV2 && categoryTypeName
        ? this.translateCategoryType(categoryTypeName, responseLanguage)
        : String(
            InboxResponseDtoV2.getCategoryDisplayName(
              template.categoryTypeEntity,
              responseLanguage as Language,
            ) || '',
          )

    const categoryIcon = includeCategoryIcon
      ? this.buildCategoryIconUrl(req, template?.categoryTypeId)
      : undefined

    const extraData: Record<string, string> = {
      templateId: String(template.id),
      notificationType: String(template.notificationType),
      language: String(responseLanguage),
      accountId: String(user.accountId),
      platform: String(user.platform || 'android'),
      imageUrl: imageUrlString || '',
      content: androidContent,
      linkPreview: translation.linkPreview || '',
      createdDate: template.createdAt
        ? DateFormatter.formatDateByLanguage(
            template.createdAt instanceof Date ? template.createdAt : new Date(template.createdAt),
            translation.language,
          )
        : DateFormatter.formatDateByLanguage(new Date(), translation.language),
      notification_title: androidTitle,
      notification_body: body,
    }

    if (isV2) {
      extraData.categoryType = String(categoryTypeDisplay || '')
      if (categoryIcon) extraData.categoryIcon = String(categoryIcon)
    }

    let androidPayload = InboxResponseDtoV2.buildAndroidPayload(
      token, // ✅ FIX: use trimmed token
      androidTitle,
      body,
      notificationIdStr,
      extraData,
    )

    // Size guard (4KB)
    let androidPayloadJsonString = JSON.stringify(androidPayload)
    let androidPayloadSizeBytes = Buffer.byteLength(androidPayloadJsonString, 'utf8')
    let androidTruncationAttempts = 0
    const MAX_ANDROID_TRUNCATION_ATTEMPTS = 10
    const MAX_ANDROID_PAYLOAD_BYTES = 4096

    while (
      androidPayloadSizeBytes >= MAX_ANDROID_PAYLOAD_BYTES &&
      androidTruncationAttempts < MAX_ANDROID_TRUNCATION_ATTEMPTS
    ) {
      androidTruncationAttempts++

      const original = String(extraData.content || '')
      const newLen = Math.floor(original.length * 0.8)
      if (newLen <= 50) break

      extraData.content = original.substring(0, newLen - 3) + '...'

      androidPayload = InboxResponseDtoV2.buildAndroidPayload(
        token,
        androidTitle,
        body,
        notificationIdStr,
        extraData,
      )

      androidPayloadJsonString = JSON.stringify(androidPayload)
      androidPayloadSizeBytes = Buffer.byteLength(androidPayloadJsonString, 'utf8')
    }

    if (androidPayloadSizeBytes >= MAX_ANDROID_PAYLOAD_BYTES) {
      throw new Error(`Android payload exceeds 4KB limit (${androidPayloadSizeBytes} bytes)`)
    }

    try {
      const fcm = this.getFCM(user.bakongPlatform)
      if (!fcm) {
        throw new Error(
          `Firebase Cloud Messaging is not initialized for bakongPlatform: ${user.bakongPlatform || 'DEFAULT'}`,
        )
      }

      const sendResponse = await fcm.send(androidPayload)
      return sendResponse
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error'
      const errorCode = error?.code || error?.errorInfo?.code || 'N/A'
      const wrappedError: any = new Error(
        `Android FCM send failed: ${errorMessage} (code: ${errorCode})`,
      )
      wrappedError.code = errorCode !== 'N/A' ? errorCode : undefined
      wrappedError.originalError = error
      wrappedError.firebaseErrorCode = errorCode !== 'N/A' ? errorCode : undefined
      throw wrappedError
    }
  }

  // If platform is neither iOS nor Android
  console.warn('⚠️ [sendFCMPayloadToPlatform] Platform not recognized:', {
    userPlatform: user.platform,
    accountId: user.accountId,
    isIOS: platform.ios,
    isAndroid: platform.android,
  })
  return null
}

  private async handleFlashNotification(
    template: TemplateV2,
    translation: TemplateTranslationV2,
    dto: SentNotificationDtoV2,
    req?: any,
  ) {
    const { language, templateId } = dto

    const accountIds: string[] | undefined = Array.isArray(dto.accountId)
      ? dto.accountId.map((x) => String(x).trim()).filter(Boolean)
      : typeof dto.accountId === 'string' && dto.accountId.trim()
        ? [dto.accountId.trim()]
        : undefined

    if (!accountIds) {
      return BaseResponseDto.error({
        errorCode: ErrorCode.USER_NOT_FOUND,
        message: ResponseMessage.USER_NOT_FOUND,
        data: { accountId: 'No accountId provided for flash notification' },
      })
    }

    // Get user's bakongPlatform to ensure we find matching template
    const user = await this.baseFunctionHelper.findUserByAccountId(accountIds[0])
    const userBakongPlatform = user?.bakongPlatform

    let selectedTemplate = template
    let selectedTranslation = translation

    if (templateId) {
      selectedTemplate = await this.templateRepo.findOne({
        where: { id: templateId, notificationType: NotificationType.FLASH_NOTIFICATION },
        relations: ['translations', 'categoryTypeEntity'],
      })

      if (!selectedTemplate) {
        return BaseResponseDto.error({
          errorCode: ErrorCode.TEMPLATE_NOT_FOUND,
          message: ResponseMessage.TEMPLATE_NOT_FOUND,
          data: { templateId },
        })
      }

      // Verify template is published (not draft)
      if (!selectedTemplate.isSent) {
        return BaseResponseDto.error({
          errorCode: ErrorCode.TEMPLATE_NOT_FOUND,
          message: 'Template is a draft and cannot be sent. Please publish it first.',
          data: { templateId, isDraft: true },
        })
      }

      // Verify template matches user's bakongPlatform
      if (
        userBakongPlatform &&
        selectedTemplate.bakongPlatform &&
        selectedTemplate.bakongPlatform !== userBakongPlatform
      ) {
        console.warn(
          `⚠️ [handleFlashNotification] Template ${templateId} bakongPlatform (${selectedTemplate.bakongPlatform}) doesn't match user's (${userBakongPlatform})`,
        )
      }

      selectedTranslation = this.templateService.findBestTranslation(selectedTemplate, language)
    } else {
      // Find template matching user's bakongPlatform (excluding templates sent 2+ times)
      // The limit is PER TEMPLATE: Each template can be sent 2 times per user per 24 hours
      // New templates can always be sent (up to 2 times each)
      const bestTemplate = await this.templateService.findBestTemplateForUser(
        accountIds[0],
        language,
        this.notiRepo,
        userBakongPlatform, // Pass user's bakongPlatform
      )
      if (!bestTemplate) {
        // Check if it's because all templates have been sent 2+ times
        const now = new Date()
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        // Get all available templates for this user's platform
        const allTemplatesWhere: any = {
          notificationType: NotificationType.FLASH_NOTIFICATION,
          isSent: true,
        }
        if (userBakongPlatform) {
          allTemplatesWhere.bakongPlatform = userBakongPlatform
        }
        const allAvailableTemplates = await this.templateRepo.find({
          where: allTemplatesWhere,
          select: ['id'],
        })

        const accountIds = Array.isArray(dto.accountId) ? dto.accountId : undefined

        // Get user's notification history
        const userNotifications = await this.notiRepo.find({
          where: {
            ...(accountIds?.length ? { accountId: In(accountIds) } : {}),
            ...(typeof dto.accountId === 'string' ? { accountId: dto.accountId } : {}),
          }
        })

        const todayNotifications = userNotifications.filter((notif) => {
          const createdAt = new Date(notif.createdAt)
          return createdAt >= last24Hours && createdAt <= now
        })

        const templateCounts = todayNotifications.reduce((acc, notif) => {
          if (notif.templateId) {
            acc[notif.templateId] = (acc[notif.templateId] || 0) + 1
          }
          return acc
        }, {} as Record<number, number>)

        const templatesAtLimit = Object.entries(templateCounts)
          .filter(([_, count]) => count >= 2)
          .map(([templateId]) => parseInt(templateId))

        // If all available templates have reached their limits, return limit error
        // Note: This check is now handled by findBestTemplateForUser which checks per-template limits
        // This is kept for backward compatibility
        if (
          allAvailableTemplates.length > 0 &&
          templatesAtLimit.length === allAvailableTemplates.length &&
          allAvailableTemplates.every((t) => templatesAtLimit.includes(t.id))
        ) {
          console.warn(
            `⚠️ [handleFlashNotification] All ${allAvailableTemplates.length} templates have reached their limits for user ${accountIds[0]}`,
          )
          return BaseResponseDto.error({
            errorCode: ErrorCode.FLASH_LIMIT_REACHED_IN_TODAY,
            message: ResponseMessage.FLASH_LIMIT_REACHED_IN_TODAY,
            data: {
              message:
                'You have reached the limit for flash notifications. All available templates have reached their daily or maximum day limits. Please try again later.',
              templatesAtLimit: templatesAtLimit,
              totalTemplates: allAvailableTemplates.length,
            },
          })
        }

        return BaseResponseDto.error({
          errorCode: ErrorCode.NO_FLASH_NOTIFICATION_TEMPLATE_AVAILABLE,
          message: ResponseMessage.NO_FLASH_NOTIFICATION_TEMPLATE_AVAILABLE,
          data: {},
        })
      }
      selectedTemplate = bestTemplate.template
      selectedTranslation = bestTemplate.translation

      console.log(
        `📤 [handleFlashNotification] Found template ${selectedTemplate.id
        } for user ${accountIds[0]} with bakongPlatform: ${selectedTemplate.bakongPlatform || 'NULL'}`,
      )
    }

    if (!selectedTranslation) {
      return BaseResponseDto.error({
        errorCode: ErrorCode.NO_FLASH_NOTIFICATION_TEMPLATE_AVAILABLE,
        message: ResponseMessage.NO_FLASH_NOTIFICATION_TEMPLATE_AVAILABLE,
      })
    }

    // Get flash notification limit settings from template (default: 1 per day, 1 day max)
    const showPerDay = selectedTemplate.showPerDay ?? 1
    const maxDayShowing = selectedTemplate.maxDayShowing ?? 1

    console.log(
      `📊 [handleFlashNotification] Template ${selectedTemplate.id} limits: showPerDay=${showPerDay}, maxDayShowing=${maxDayShowing}`,
    )

    // Check 1: Has user seen this template showPerDay times TODAY?
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    const todayCount = await this.notiRepo.count({
      where: {
        accountId: accountIds[0],
        templateId: selectedTemplate.id,
        createdAt: Between(todayStart, todayEnd),
      },
    })

    console.log(
      `📊 [handleFlashNotification] Template ${selectedTemplate.id} has been sent ${todayCount} times to user ${accountIds[0]} today (limit: ${showPerDay} per day)`,
    )

    // Check if user has already received this template showPerDay times today
    if (todayCount >= showPerDay) {
      console.warn(
        `⚠️ [handleFlashNotification] DAILY LIMIT REACHED: User ${accountIds[0]} has already received template ${selectedTemplate.id} ${todayCount} times today (limit: ${showPerDay} per day)`,
      )
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
      })
    }

    // Check 2: Has user seen this template for maxDayShowing days?
    // Count distinct days user has received this template
    const allNotifications = await this.notiRepo.find({
      where: {
        accountId: accountIds[0],
        templateId: selectedTemplate.id,
      },
      select: ['createdAt'],
    })

    // Get distinct days (YYYY-MM-DD format)
    const distinctDays = new Set<string>()
    allNotifications.forEach((notif) => {
      const date = new Date(notif.createdAt)
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(date.getDate()).padStart(2, '0')}`
      distinctDays.add(dayKey)
    })

    const daysCount = distinctDays.size
    console.log(
      `📊 [handleFlashNotification] Template ${selectedTemplate.id} has been shown to user ${accountIds[0]} for ${daysCount} distinct day(s) (limit: ${maxDayShowing} days)`,
    )

    // Check if user has already seen this template for maxDayShowing days
    if (daysCount >= maxDayShowing) {
      console.warn(
        `⚠️ [handleFlashNotification] MAX DAYS LIMIT REACHED: User ${accountIds[0]} has already seen template ${selectedTemplate.id} for ${daysCount} days (limit: ${maxDayShowing} days)`,
      )
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
      })
    }

    const newSendCount = todayCount + 1
    console.log(
      `✅ [handleFlashNotification] Proceeding to send template ${selectedTemplate.id
      } (will be send #${newSendCount} for this user today, day ${daysCount + 1
      } of ${maxDayShowing})`,
    )

    // User already fetched above, reuse it
    const saved = await this.storeNotification({
      accountId: accountIds[0],
      templateId: selectedTemplate.id,
      fcmToken: user?.fcmToken,
      sendCount: newSendCount,
      firebaseMessageId: 0,
    })

    await this.templateService.markAsPublished(selectedTemplate.id, req?.user)

    const imageUrl = selectedTranslation?.imageId
      ? this.imageService.buildImageUrl(selectedTranslation.imageId, req)
      : ''
    const baseUrl = this.baseFunctionHelper
      ? this.baseFunctionHelper.getBaseUrl(req)
      : 'http://localhost:4005'
    const whatNews = InboxResponseDtoV2.buildSendApiNotificationData(
      selectedTemplate,
      selectedTranslation,
      language,
      typeof imageUrl === 'string' ? imageUrl : '',
      saved.id,
      saved.sendCount,
      baseUrl,
      req,
    )
    return BaseResponseDto.success({
      data: { whatnews: whatNews },
      message: ResponseMessage.FLASH_NOTIFICATION_POPUP_SUCCESS,
    })
  }

  async getNotificationCenter(dto: NotificationInboxDtoV2, req?: any) {
    try {
      const { accountId, page, size, language, bakongPlatform, fcmToken, platform, participantCode } = dto

      console.log('📥 /inbox API called V2:', {
        accountId,
        language,
        page,
        size,
        platform,
        bakongPlatform,
      })

      if (!bakongPlatform) {
        return BaseResponseDto.error({
          errorCode: ErrorCode.FLASH_NOTIFICATION_POPUP_FAILED,
          message: 'bakongPlatform is required. Must be one of: BAKONG, BAKONG_JUNIOR, BAKONG_TOURIST',
          data: { accountId },
        })
      }

      // normalize language
      const languageValidation = language
        ? ValidationHelper.validateLanguage(String(language))
        : null
      const normalizedLanguage = languageValidation?.isValid
        ? (languageValidation.normalizedValue as Language)
        : Language.KM

      // ✅ sync user data (keep your existing logic but simplified)
      await this.baseFunctionHelper.updateUserData({
        accountId,
        fcmToken: fcmToken ?? undefined,
        participantCode: participantCode ?? undefined,
        platform: platform ?? undefined,
        language: normalizedLanguage,
        bakongPlatform: bakongPlatform,
      })

      const user = await this.baseFunctionHelper.findUserByAccountId(accountId)
      if (!user) {
        return BaseResponseDto.error({
          errorCode: ErrorCode.USER_NOT_FOUND,
          message: ResponseMessage.USER_NOT_FOUND,
          data: { accountId },
        })
      }

      const userPlatform = user.bakongPlatform

      const { skip, take } = PaginationUtils.normalizePagination(page || 1, size || 10)

      // ✅ IMPORTANT: this now joins notification.templateId -> TemplateV2 (which maps to V1 "template")
      const qb = this.notiRepo
        .createQueryBuilder('notification')
        .leftJoinAndSelect('notification.template', 'template')
        .leftJoinAndSelect('template.translations', 'translations')
        .leftJoinAndSelect('template.categoryTypeEntity', 'categoryTypeEntity')
        .where('notification.accountId = :accountId', { accountId: accountId.trim() })
        .orderBy('notification.createdAt', 'DESC')
        .skip(skip)
        .take(take)

      const [notifications, totalCount] = await qb.getManyAndCount()

      // ✅ Filter by user's bakongPlatform (keep backward compatibility)
      const filtered = notifications.filter((n) => {
        if (!n.template) return true // old records without template (keep)
        if (!n.template.bakongPlatform) return true
        return n.template.bakongPlatform === userPlatform
      })

      console.log('✅ V2 inbox fetched:', {
        totalCount,
        page,
        size,
        fetched: notifications.length,
        filtered: filtered.length,
        userPlatform,
      })

      return InboxResponseDtoV2.getNotificationCenterResponse(
        filtered.map(
          (notif) =>
            new InboxResponseDtoV2(
              notif,
              normalizedLanguage,
              this.baseFunctionHelper.getBaseUrl(req) || 'http://localhost:4005',
              this.templateService,
              this.imageService,
              req,
            ),
        ),
        PaginationUtils.generateResponseMessage(
          filtered,
          totalCount,
          page,
          size,
          PaginationUtils.calculatePaginationMeta(page, size, totalCount, filtered.length).pageCount,
          false,
        ),
        PaginationUtils.calculatePaginationMeta(page, size, totalCount, filtered.length),
        userPlatform,
      )
    } catch (error: any) {
      console.error('❌ [getNotificationCenter] Error:', error?.message || error)
      return BaseResponseDto.error({
        errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
        message: ResponseMessage.INTERNAL_SERVER_ERROR,
        data: { error: error?.message || String(error) },
      })
    }
  }

  private async storeNotification(params: {
    accountId: string
    templateId: number
    fcmToken?: string
    sendCount?: number
    firebaseMessageId?: number
  }): Promise<NotificationV2> {
    // NOTE: Deduplication removed - we now allow multiple records for the same template
    // The limit check (2 times per 24h) is handled in handleFlashNotification BEFORE calling this method
    // This ensures we can store up to 2 records per template per user per 24 hours

    const entity = this.notiRepo.create({
      accountId: params.accountId,
      templateId: params.templateId,
      fcmToken: params.fcmToken ?? '',
      sendCount: params.sendCount ?? 1,
      firebaseMessageId: params.firebaseMessageId ?? 0,
    })
    return this.notiRepo.save(entity)
  }

  private async updateNotificationRecord(
    user: BakongUser,
    template: TemplateV2,
    notificationId: number,
    response: string,
    mode: 'individual' | 'shared',
  ): Promise<void> {
    const firebaseMessageId = ValidationHelper.validateFirebaseMessageId(response)

    if (mode === 'individual') {
      try {
        await this.notiRepo.update({ id: notificationId }, { firebaseMessageId })
        return
      } catch (error) {
        throw error
      }
    }
    try {
      if (notificationId > 0) {
        const notification = await this.notiRepo.findOne({
          where: { id: notificationId, accountId: user.accountId },
        })
        if (notification) {
          await this.notiRepo.update({ id: notificationId }, { firebaseMessageId })
          return
        }
      }

      const latest = await this.notiRepo
        .createQueryBuilder('notification')
        .select('notification.id')
        .where('notification.accountId = :accountId', { accountId: user.accountId })
        .andWhere('notification.templateId = :templateId', { templateId: template.id })
        .andWhere('notification.firebaseMessageId = 0')
        .orderBy('notification.createdAt', 'DESC')
        .getOne()

      if (latest) {
        await this.notiRepo.update({ id: latest.id }, { firebaseMessageId })
        return
      }

      const fallbackNotification = await this.notiRepo
        .createQueryBuilder('notification')
        .select('notification.id')
        .where('notification.accountId = :accountId', { accountId: user.accountId })
        .orderBy('notification.createdAt', 'DESC')
        .getOne()

      if (fallbackNotification) {
        await this.notiRepo.update({ id: fallbackNotification.id }, { firebaseMessageId })
        return
      }
    } catch (error) { }
  }

  async deleteNotificationsByTemplateId(templateId: number): Promise<void> {
    try {
      console.log(`Deleting all notification records for template ID: ${templateId}`)
      const result = await this.notiRepo.delete({ templateId })
      console.log(`Deleted ${result.affected || 0} notification records for template ${templateId}`)
    } catch (error) {
      console.error(`Error deleting notification records for template ${templateId}:`, error)
      throw error
    }
  }

  async updateNotificationTemplateId(oldTemplateId: number, newTemplateId: number): Promise<void> {
    try {
      console.log(`Updating notification records: templateId ${oldTemplateId} -> ${newTemplateId}`)
      const result = await this.notiRepo.update(
        { templateId: oldTemplateId },
        { templateId: newTemplateId },
      )
      console.log(
        `Updated ${result.affected || 0
        } notification records from template ${oldTemplateId} to ${newTemplateId}`,
      )
    } catch (error) {
      console.error(
        `Error updating notification records from template ${oldTemplateId} to ${newTemplateId}:`,
        error,
      )
      throw error
    }
  }
}
