import { Body, Controller, Post, Req, Version } from '@nestjs/common'
import { ApiKeyRequired } from 'src/common/middleware/api-key.guard'
import { NotificationInboxDto } from './dto/notification-inbox.dto'
import { NotificationService } from './notification.service'
import SentNotificationDto from './dto/send-notification.dto'
import { BakongApp } from '@bakong/shared'
import { BaseFunctionHelper } from 'src/common/util/base-function.helper'
import { Roles } from 'src/common/middleware/roles.guard'
import { UserRole } from '@bakong/shared'
import { NotificationController } from './notification.controller'

@Controller('notification')
export class NotificationV2Controller extends NotificationController {
  constructor(
    service: NotificationService,
    baseFunctionHelper: BaseFunctionHelper,
  ) {
    super(service, baseFunctionHelper)
  }

  private ensureV2Request(req: any) {
    if (req && !req.version) {
      req.version = '2'
    }
  }

  @Post('send')
  @Version('2')
  @ApiKeyRequired()
  @Roles(UserRole.ADMIN_USER, UserRole.NORMAL_USER)
  async sendNotification(@Body() dto: SentNotificationDto, @Req() req: any) {
    this.ensureV2Request(req)
    return super.sendNotification(dto, req)
  }

  @Post('inbox')
  @Version('2')
  @ApiKeyRequired()
  @Roles(UserRole.ADMIN_USER, UserRole.API_USER)
  async postNotificationInbox(@Body() dto: NotificationInboxDto, @Req() req: any) {
    this.ensureV2Request(req)
    return super.postNotificationInbox(dto, req)
  }
}
