import { Body, Controller, Post, Req } from '@nestjs/common'
import { ApiKeyRequired } from 'src/common/middleware/api-key.guard'
import { NotificationInboxDto } from './dto/notification-inbox.dto'
import { NotificationService } from './notification.service'
import SentNotificationDto from './dto/send-notification.dto'
import { BaseResponseDto } from 'src/common/base-response.dto'
import { ErrorCode, ResponseMessage, BakongApp } from '@bakong/shared'
import { NotificationType } from '@bakong/shared'
import { BaseFunctionHelper } from 'src/common/util/base-function.helper'
import { Roles } from 'src/common/middleware/roles.guard'
import { UserRole } from '@bakong/shared'

@Controller('notification')
export class NotificationController {
  constructor(
    private readonly service: NotificationService,
    private readonly baseFunctionHelper: BaseFunctionHelper,
  ) {}

  @Post('send')
  @ApiKeyRequired()
  @Roles(UserRole.ADMIN_USER, UserRole.NORMAL_USER)
  async sendNotification(@Body() dto: SentNotificationDto, @Req() req: any) {
    console.log('📤 /send API endpoint called with:', {
      templateId: dto.templateId,
      notificationId: dto.notificationId,
      language: dto.language,
      notificationType: dto.notificationType,
      bakongPlatform: dto.bakongPlatform,
    })
 
    const accountIdList = Array.isArray(dto.accountId) ? dto.accountId.map((x: any) => String(x).trim()).filter(Boolean) : undefined
    const singleAccountId = typeof dto.accountId === 'string' && dto.accountId.trim() ? dto.accountId.trim() : undefined

    try {
      if (singleAccountId) {
        const notificationTypeLabel = dto.notificationType || 'UNKNOWN'
        console.log(
          `🔄 [v2 sendNotification] Syncing user data FIRST for ${singleAccountId} before processing ${notificationTypeLabel}`,
        )

        // If notificationType missing for single-user send, default to FLASH (same as your old logic)
        if (!dto.notificationType) {
          dto.notificationType = NotificationType.FLASH_NOTIFICATION
        }

        const syncData: any = { accountId: singleAccountId }

        // Keep your existing sync rules (do not overwrite with empty string)
        if (dto.fcmToken !== undefined && dto.fcmToken !== null && dto.fcmToken !== '') {
          syncData.fcmToken = dto.fcmToken
        }
        if (dto.bakongPlatform !== undefined && dto.bakongPlatform !== null) {
          syncData.bakongPlatform = dto.bakongPlatform
        }
        if (dto.language !== undefined && dto.language !== null) {
          syncData.language = dto.language
        }
        if (
          dto.participantCode !== undefined &&
          dto.participantCode !== null &&
          dto.participantCode !== ''
        ) {
          syncData.participantCode = dto.participantCode
        }

        // ✅ Use only functions that exist
        await this.baseFunctionHelper.updateUserData(syncData)
      } else if (accountIdList?.length) {
        console.log(
          `📌 [v2 sendNotification] accountId list provided (${accountIdList.length}) -> skip sync user step, send only to these users`,
        )

        // optional: default type when none provided
        if (!dto.notificationType) {
          dto.notificationType = NotificationType.ANNOUNCEMENT
        }
      } else {
        // No accountId -> current behavior
        if (!dto.notificationType) {
          dto.notificationType = NotificationType.ANNOUNCEMENT
        }
      }

      // ✅ Now call service (service will filter by accountId list)
      const result = await this.service.sendNow(dto, req)
      return result
    } catch (error: any) {
      console.error('❌ [V2 CONTROLLER] Error in sendNotification:', error)

      if (error?.message && error.message.includes('No users found for')) {
        return BaseResponseDto.error({
          errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
          message: ResponseMessage.NO_USERS_FOR_BAKONG_PLATFORM,
          data: { error: error.message },
        })
      }

      throw error
    }
  }

  @Post('inbox')
  @ApiKeyRequired()
  @Roles(UserRole.ADMIN_USER, UserRole.API_USER)
  async postNotificationInbox(@Body() dto: NotificationInboxDto, @Req() req: any) {
    console.log('📥 /inbox API called:', {
      accountId: dto.accountId,
      language: dto.language,
      page: dto.page,
      size: dto.size,
      platform: dto.platform,
      bakongPlatform: dto.bakongPlatform,
    })
    const response = await this.service.getNotificationCenter(dto, req)
    if (response && typeof response === 'object' && 'responseCode' in response) {
      const data = (response as any).data
      console.log('📥 /inbox API response:', {
        responseCode: (response as any).responseCode,
        errorCode: (response as any).errorCode,
        notificationCount: Array.isArray(data) ? data.length : undefined,
      })
    }
    return response
  }

  /**
   * Infer bakongPlatform from participantCode or accountId
   * Priority: participantCode > accountId domain
   */
  private inferBakongPlatform(participantCode?: string, accountId?: string): BakongApp | undefined {
    // Check participantCode first (higher priority)
    if (participantCode) {
      const normalized = participantCode.toUpperCase()
      if (normalized.startsWith('BKRT')) {
        return BakongApp.BAKONG
      }
      if (normalized.startsWith('BKJR')) {
        return BakongApp.BAKONG_JUNIOR
      }
      if (normalized.startsWith('TOUR')) {
        return BakongApp.BAKONG_TOURIST
      }
    }

    // Check accountId domain
    if (accountId) {
      const normalized = accountId.toLowerCase()
      if (normalized.includes('@bkrt')) {
        return BakongApp.BAKONG
      }
      if (normalized.includes('@bkjr')) {
        return BakongApp.BAKONG_JUNIOR
      }
      if (normalized.includes('@tour')) {
        return BakongApp.BAKONG_TOURIST
      }
    }

    return undefined
  }
}
