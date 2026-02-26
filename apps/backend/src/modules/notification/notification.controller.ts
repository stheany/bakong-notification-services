import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiKeyRequired } from 'src/common/middleware/api-key.guard';
import { NotificationInboxDto } from './dto/notification-inbox.dto';
import { NotificationService } from './notification.service';
import SentNotificationDto from './dto/send-notification.dto';
import { BaseResponseDto } from 'src/common/base-response.dto';
import { ErrorCode, ResponseMessage, BakongApp } from '@bakong/shared';
import { NotificationType } from '@bakong/shared';
import { BaseFunctionHelper } from 'src/common/util/base-function.helper';
import { Roles } from 'src/common/middleware/roles.guard';
import { UserRole } from '@bakong/shared';
@Controller('notification')
export class NotificationController {
  constructor(
    private readonly service: NotificationService,
    private readonly baseFunctionHelper: BaseFunctionHelper
  ) {}

  @Post('send')
  @ApiKeyRequired()
  @Roles(UserRole.ADMINISTRATOR, UserRole.EDITOR, UserRole.APPROVAL)
  async sendNotification(@Body() dto: SentNotificationDto, @Req() req: any) {
    req.version = '1';
    console.log('📤 /send API endpoint called with:', {
      templateId: dto.templateId,
      notificationId: dto.notificationId,
      language: dto.language,
      notificationType: dto.notificationType,
      bakongPlatform: dto.bakongPlatform,
      accountId: dto.accountId || 'N/A',
      accountIdType: Array.isArray(dto.accountId)
        ? 'Array'
        : typeof dto.accountId,
      fcmToken: dto.fcmToken
        ? `${dto.fcmToken.substring(0, 30)}...`
        : dto.fcmToken === ''
          ? 'EMPTY (explicitly cleared)'
          : 'NOT PROVIDED',
    });
    try {
      const accountIdList = Array.isArray(dto.accountId)
        ? dto.accountId.map((x: any) => String(x).trim()).filter(Boolean)
        : undefined;
      const singleAccountId =
        typeof dto.accountId === 'string' && dto.accountId.trim()
          ? dto.accountId.trim()
          : undefined;
      if (singleAccountId) {
        const notificationTypeLabel = dto.notificationType || 'UNKNOWN';
        console.log(
          `🔄 [sendNotification] FCM push received - Syncing user data FIRST for ${singleAccountId} before processing ${notificationTypeLabel} notification`
        );
        if (!dto.bakongPlatform) {
          const inferredBakongPlatform = this.inferBakongPlatform(
            dto.participantCode,
            singleAccountId
          );
          if (inferredBakongPlatform) {
            console.warn(
              `⚠️ [sendNotification] Mobile did not provide bakongPlatform (unexpected), inferred from accountId: ${singleAccountId} -> ${inferredBakongPlatform}`
            );
            dto.bakongPlatform = inferredBakongPlatform;
          }
        }
        if (!dto.notificationType) {
          console.warn(
            `⚠️ [sendNotification] notificationType not provided in request, defaulting to FLASH_NOTIFICATION for backward compatibility`
          );
          dto.notificationType = NotificationType.FLASH_NOTIFICATION;
        }
        if (dto.fcmToken === undefined) {
          const existingUser =
            await this.baseFunctionHelper.findUserByAccountId(singleAccountId);
          if (existingUser?.fcmToken) {
            console.warn(
              `⚠️ [sendNotification] ${
                dto.notificationType || 'Notification'
              } for ${singleAccountId} but fcmToken NOT PROVIDED. User has existing token: ${existingUser.fcmToken.substring(
                0,
                30
              )}... (This might be an old/invalid token if app was reinstalled)`
            );
          } else {
            console.warn(
              `⚠️ [sendNotification] ${
                dto.notificationType || 'Notification'
              } for ${singleAccountId} but fcmToken NOT PROVIDED. User has no existing token.`
            );
          }
        } else if (dto.fcmToken === '') {
          console.log(
            `ℹ️ [sendNotification] ${
              dto.notificationType || 'Notification'
            } for ${singleAccountId} with EMPTY fcmToken (app deleted/reinstalled - will clear old token)`
          );
        } else {
          console.log(
            `✅ [sendNotification] ${
              dto.notificationType || 'Notification'
            } for ${singleAccountId} with NEW fcmToken: ${dto.fcmToken.substring(
              0,
              30
            )}...`
          );
        }
        const syncData: any = {
          accountId: singleAccountId,
        };
        if (
          dto.fcmToken !== undefined &&
          dto.fcmToken !== null &&
          dto.fcmToken !== ''
        ) {
          syncData.fcmToken = dto.fcmToken;
        }
        if (dto.bakongPlatform !== undefined && dto.bakongPlatform !== null) {
          syncData.bakongPlatform = dto.bakongPlatform;
        }
        if (dto.language !== undefined && dto.language !== null) {
          syncData.language = dto.language;
        }
        if (dto.platform !== undefined && dto.platform !== null) {
          syncData.platform = dto.platform;
        }
        if (
          dto.participantCode !== undefined &&
          dto.participantCode !== null &&
          dto.participantCode !== ''
        ) {
          syncData.participantCode = dto.participantCode;
        }
        await this.baseFunctionHelper.updateUserData(syncData);
      } else if (accountIdList?.length) {
        console.log(
          `📌 [sendNotification] accountId list provided (${accountIdList.length}) -> skip sync user step, send only to these users`
        );
        if (!dto.bakongPlatform && accountIdList.length > 0) {
          const inferred = this.inferBakongPlatform(
            undefined,
            accountIdList[0]
          );
          if (inferred) {
            console.log(
              `📌 [sendNotification] Inferred bakongPlatform for list: ${inferred}`
            );
            dto.bakongPlatform = inferred;
          }
        }
        if (!dto.notificationType) {
          dto.notificationType = NotificationType.ANNOUNCEMENT;
        }
      } else {
        if (!dto.notificationType) {
          dto.notificationType = NotificationType.ANNOUNCEMENT;
        }
      }
      const result = await this.service.sendNow(dto, req);
      if (
        result &&
        typeof result === 'object' &&
        'responseCode' in result &&
        result.responseCode !== 0
      ) {
        if (
          dto.templateId &&
          result.errorCode === ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM
        ) {
          try {
            const templateService =
              this.service['templateService'] ||
              (await import('../template/template.service')).TemplateService;
          } catch (e) {
            console.error('Error marking template as draft:', e);
          }
        }
        return result;
      }
      return result;
    } catch (error: any) {
      console.error('❌ [CONTROLLER] Error in sendNotification:', error);
      if (error?.message && error.message.includes('No users found for')) {
        return BaseResponseDto.error({
          errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
          message: ResponseMessage.NO_USERS_FOR_BAKONG_PLATFORM,
          data: {
            error: error.message,
          },
        });
      }
      throw error;
    }
  }

  @Post('inbox')
  @ApiKeyRequired()
  @Roles(UserRole.ADMINISTRATOR, UserRole.EDITOR)
  async postNotificationInbox(
    @Body() dto: NotificationInboxDto,
    @Req() req: any
  ) {
    const response = await this.service.getNotificationCenter(dto, req);
    if (
      response &&
      typeof response === 'object' &&
      'responseCode' in response
    ) {
      const data = (response as any).data;
      console.log('📥 /inbox API response:', {
        responseCode: (response as any).responseCode,
        errorCode: (response as any).errorCode,
        notificationCount: Array.isArray(data) ? data.length : undefined,
      });
    }
    return response;
  }

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

  @Post('sync-users')
  @ApiKeyRequired()
  @Roles(UserRole.ADMINISTRATOR, UserRole.EDITOR, UserRole.VIEW_ONLY)
  async syncUsers(@Req() req: any) {
    try {
      const result = await this.baseFunctionHelper.syncAllUsers();
      return BaseResponseDto.success({
        data: {
          totalCount: result.totalCount,
          updatedCount: result.updatedCount,
          platformUpdates: result.platformUpdates,
          languageUpdates: result.languageUpdates,
          invalidTokens: result.invalidTokens,
          updatedIds: result.updatedIds,
          updatedIdsCount: result.updatedIds.length,
        },
        message: `User sync completed: ${result.updatedCount} of ${result.totalCount} users updated`,
      });
    } catch (error: any) {
      return BaseResponseDto.error({
        errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
        message: `User sync failed: ${error.message}`,
        data: {
          error: error.message,
        },
      });
    }
  }
}
