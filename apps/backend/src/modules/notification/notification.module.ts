import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BakongUser } from 'src/entities/bakong-user.entity'
import { Image } from 'src/entities/image.entity'
import { Notification } from 'src/entities/notification.entity'
import { NotificationController } from './notification.controller'
import { NotificationControllerV2 } from '../notification-v2/notification.v2.controller'
import { NotificationService } from './notification.service'
import { NotificationSchedulerService } from './notification-scheduler.service'
import { Template } from 'src/entities/template.entity'
import { TemplateTranslation } from 'src/entities/template-translation.entity'
import { ImageService } from '../image/image.service'
import { TemplateModule } from '../template/template.module'
import { BaseFunctionHelper } from 'src/common/util/base-function.helper'
import { PaginationUtils } from '@bakong/shared'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Logger } from '@nestjs/common'
import { NotificationServiceV2 } from '../notification-v2/notification.v2.service'
import { NotificationV2 } from '@/entities/notification.v2.entity'
import { TemplateV2 } from '@/entities/template.v2.entity'
import { BaseFunctionHelperV2 } from '@/common/util/base-function.v2.helper'
import { TemplateServiceV2 } from '../template-v2/template.v2.service'
import { User } from '@/entities/user.entity'
import { CategoryTypeV2 } from '@/entities/category-type-v2.entity'
import { UserModule } from '../user/user.module'
import { TemplateTranslationV2 } from '@/entities/template-translation.v2.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, BakongUser, Template, TemplateTranslation, Image, NotificationV2, TemplateV2, TemplateTranslationV2, CategoryTypeV2, User, TemplateModule]),
    forwardRef(() => TemplateModule),
    UserModule,
  ],
  controllers: [NotificationController, NotificationControllerV2],
  providers: [
    NotificationService,
    NotificationSchedulerService,
    ImageService,
    PaginationUtils,
    NotificationServiceV2,
    TemplateServiceV2,
    {
      provide: BaseFunctionHelper,
      useFactory: (bkUserRepo) => {
        const logger = new Logger(BaseFunctionHelper.name)
        return new BaseFunctionHelper(bkUserRepo, logger)
      },
      inject: [getRepositoryToken(BakongUser)],
    },
    {
      provide: BaseFunctionHelperV2,
      useFactory: (bkUserRepo) => {
        const logger = new Logger(BaseFunctionHelper.name)
        return new BaseFunctionHelper(bkUserRepo, logger)
      },
      inject: [getRepositoryToken(BakongUser)],
    },
  ],
  exports: [NotificationService, NotificationServiceV2],
})
export class NotificationModule { }
