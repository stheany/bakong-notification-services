import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BakongUser } from 'src/entities/bakong-user.entity'
import { Image } from 'src/entities/image.entity'
import { Notification } from 'src/entities/notification.entity'
import { NotificationServiceV2 } from './notification.v2.service'
import { NotificationSchedulerServiceV2 } from './notification-scheduler.v2.service'
import { Template } from 'src/entities/template.entity'
import { TemplateTranslation } from 'src/entities/template-translation.entity'
import { ImageService } from '../image/image.service'
import { TemplateModule } from '../template/template.module'
import { BaseFunctionHelper } from 'src/common/util/base-function.helper'
import { PaginationUtils } from '@bakong/shared'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Logger } from '@nestjs/common'
import { NotificationControllerV2 } from './notification.v2.controller'
import { NotificationV2 } from '@/entities/notification.v2.entity'
import { TemplateTranslationV2 } from '@/entities/template-translation.v2.entity'
import { TemplateV2 } from '@/entities/template.v2.entity'
import { TemplateModuleV2 } from '../template-v2/template.v2.module'
import { BaseFunctionHelperV2 } from '@/common/util/base-function.v2.helper'
import { ImageModule } from '../image/image.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationV2, BakongUser, TemplateV2, TemplateTranslationV2, Image]),
    TemplateModuleV2,
    ImageModule,
  ],
  controllers: [NotificationControllerV2],
  providers: [
    NotificationServiceV2,
    NotificationSchedulerServiceV2,
    PaginationUtils,
    BaseFunctionHelperV2,
    {
      provide: BaseFunctionHelperV2,
      useFactory: (bkUserRepo) => {
        const logger = new Logger(BaseFunctionHelperV2.name)
        return new BaseFunctionHelperV2(bkUserRepo, logger)
      },
      inject: [getRepositoryToken(BakongUser)],
    },
  ],
  exports: [NotificationServiceV2, NotificationSchedulerServiceV2, TypeOrmModule],
})
export class NotificationModuleV2 { }
