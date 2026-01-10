import { Body, Controller, Post, Req, Version } from '@nestjs/common'
import { ApiKeyRequired } from 'src/common/middleware/api-key.guard'
import { BaseResponseDto } from 'src/common/base-response.dto'
import { ErrorCode, ResponseMessage, NotificationType } from '@bakong/shared'
import { BaseFunctionHelperV2 } from 'src/common/util/base-function.v2.helper'
import { Roles } from 'src/common/middleware/roles.guard'
import { UserRole } from '@bakong/shared'
import { BakongApp } from '@bakong/shared'
import SentNotificationDtoV2 from './dto/send-notification.v2.dto'
import { NotificationInboxDtoV2 } from './dto/notification-inbox.v2.dto'
import { NotificationServiceV2 } from './notification.v2.service'
import { TemplateServiceV2 } from '../template-v2/template.v2.service'

@Controller({ path: 'notification', version: '2' })
export class NotificationControllerV2 {
  [x: string]: any
  constructor(
    private readonly service: NotificationServiceV2,
    private readonly baseFunctionHelper: BaseFunctionHelperV2,

  ) { }

  @Post('send')
  @Version('2')
  @ApiKeyRequired()
  @Roles(UserRole.ADMIN_USER, UserRole.NORMAL_USER)
  async sendNotification(@Body() dto: SentNotificationDtoV2, @Req() req: any) {
    // mark request as v2 for downstream
    req.version = '2'

    const accountIdList = Array.isArray(dto.accountId)
      ? dto.accountId.map((x: any) => String(x).trim()).filter(Boolean)
      : undefined

    const singleAccountId =
      typeof dto.accountId === 'string' && dto.accountId.trim() ? dto.accountId.trim() : undefined

    console.log('📤 v2 /send API endpoint called with:', {
      templateId: dto.templateId,
      notificationId: dto.notificationId,
      language: dto.language,
      notificationType: dto.notificationType,
      bakongPlatform: dto.bakongPlatform,
      accountId: accountIdList?.length ? accountIdList : singleAccountId || 'N/A',
      fcmToken: dto.fcmToken
        ? `${dto.fcmToken.substring(0, 30)}...`
        : dto.fcmToken === ''
          ? 'EMPTY (explicitly cleared)'
          : 'NOT PROVIDED',
    })

    try {
      /**
       * ✅ Only sync user data when accountId is SINGLE string.
       * If accountId is array -> skip sync (bulk target send).
       */
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
  @Version('2')
  @ApiKeyRequired()
  @Roles(UserRole.ADMIN_USER, UserRole.API_USER)
  async postNotificationInbox(@Body() dto: NotificationInboxDtoV2, @Req() req: any) {
    req.version = '2'
    console.log('📥 /inbox API called V:', {
      accountId: dto.accountId,
      language: dto.language,
      page: dto.page,
      size: dto.size,
      platform: dto.platform,
      bakongPlatform: dto.bakongPlatform,
    })
    return await this.service.getNotificationCenter(dto, req)
  }

  @Post('test-token')
  @Version('2')
  @ApiKeyRequired()
  @Roles(UserRole.ADMIN_USER, UserRole.NORMAL_USER)
  async testToken(@Body() dto: { token: string; bakongPlatform?: BakongApp }, @Req() req: any) {
    req.version = '2'
    try {
      const result = await this.service.testFCMToken(dto.token, dto.bakongPlatform)
      return BaseResponseDto.success({
        data: result,
        message: result.isValid
          ? 'Token is valid! A test notification has been sent.'
          : 'Token validation failed. Check the details below.',
      })
    } catch (error: any) {
      return BaseResponseDto.error({
        errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
        message: `Token test failed: ${error.message}`,
        data: { error: error.message },
      })
    }
  }

  @Post('sync-users')
  @Version('2')
  @ApiKeyRequired()
  @Roles(UserRole.ADMIN_USER, UserRole.NORMAL_USER)
  async syncUsers(@Req() req: any) {
    req.version = '2'
    const result = await this.baseFunctionHelper.syncAllUsers()
    return BaseResponseDto.success({
      data: result,
      message: `User sync completed: ${result.updatedCount} of ${result.totalCount} users updated`,
    })
  }
}


// import { Body, Controller, Post, Req, Version } from '@nestjs/common'
// import { ApiKeyRequired } from 'src/common/middleware/api-key.guard'
// import { BakongApp } from '@bakong/shared'
// import { baseFunctionHelperV2 } from 'src/common/util/base-function.helper'
// import { Roles } from 'src/common/middleware/roles.guard'
// import { UserRole } from '@bakong/shared'
// import { NotificationInboxDtoV2 } from './dto/notification-inbox.v2.dto'
// import SentNotificationDtoV2 from './dto/send-notification.v2.dto'
// import { NotificationServiceV2 } from './notification.v2.service'
// import { NotificationController } from '../notification/notification.controller'
// import { NotificationService } from '../notification/notification.service'

// @Controller('notification')
// export class NotificationControllerV2 extends NotificationController {
//   constructor(
//     service: NotificationServiceV2,
//     baseFunctionHelperV2: baseFunctionHelperV2,
//   ) {
//     super(service, baseFunctionHelperV2)
//   }

//   private ensureV2Request(req: any) {
//     if (req && !req.version) {
//       req.version = '2'
//     }
//   }

//   @Post('send')
//   @Version('2')
//   @ApiKeyRequired()
//   @Roles(UserRole.ADMIN_USER, UserRole.NORMAL_USER)
//   async sendNotification(@Body() dto: SentNotificationDtoV2, @Req() req: any) {
//     this.ensureV2Request(req)
//     return super.sendNotification(dto, req)
//   }

//   @Post('inbox')
//   @Version('2')
//   @ApiKeyRequired()
//   @Roles(UserRole.ADMIN_USER, UserRole.API_USER)
//   async postNotificationInbox(@Body() dto: NotificationInboxDtoV2, @Req() req: any) {
//     this.ensureV2Request(req)
//     return super.postNotificationInbox(dto, req)
//   }
// }
