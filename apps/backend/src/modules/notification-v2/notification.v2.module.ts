import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BakongUser } from 'src/entities/bakong-user.entity'
import { Image } from 'src/entities/image.entity'
import { Notification } from 'src/entities/notification.entity'
import { NotificationServiceV2 } from './notification.v2.service'
import { NotificationSchedulerService } from './notification-scheduler.service'
import { Template } from 'src/entities/template.entity'
import { TemplateTranslation } from 'src/entities/template-translation.entity'
import { ImageService } from '../image/image.service'
import { TemplateModule } from '../template/template.module'
import { BaseFunctionHelper } from 'src/common/util/base-function.helper'
import { PaginationUtils } from '@bakong/shared'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Logger } from '@nestjs/common'
import { NotificationControllerV2 } from './notification.v2.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, BakongUser, Template, TemplateTranslation, Image]),
    forwardRef(() => TemplateModule),
  ],
  controllers: [NotificationControllerV2],
  providers: [
    NotificationServiceV2,
    NotificationSchedulerService,
    ImageService,
    PaginationUtils,
    {
      provide: BaseFunctionHelper,
      useFactory: (bkUserRepo) => {
        const logger = new Logger(BaseFunctionHelper.name)
        return new BaseFunctionHelper(bkUserRepo, logger)
      },
      inject: [getRepositoryToken(BakongUser)],
    },
  ],
  exports: [NotificationServiceV2],
})
export class NotificationModule { }
