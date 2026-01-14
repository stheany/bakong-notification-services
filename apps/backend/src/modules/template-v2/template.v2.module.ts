import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScheduleModule } from '@nestjs/schedule'
import { TemplateV2Controller } from './template.v2.controller'
import { ImageModule } from '../image/image.module'
import { Image } from 'src/entities/image.entity'
import { BakongUser } from 'src/entities/bakong-user.entity'
import { ImageService } from '../image/image.service'
import { PaginationUtils } from '@bakong/shared'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Logger } from '@nestjs/common'
import { CategoryTypeV2 } from '@/entities/category-type-v2.entity'
import { User } from '@/entities/user.entity'
import { TemplateTranslationV2 } from '@/entities/template-translation.v2.entity'
import { TemplateServiceV2 } from './template.v2.service'
import { TemplateV2 } from '@/entities/template.v2.entity'
import { BaseFunctionHelperV2 } from '@/common/util/base-function.v2.helper'
import { NotificationModuleV2 } from '@/modules/notification-v2/notification.v2.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TemplateV2,
      TemplateTranslationV2,
      Image,
      BakongUser,
      CategoryTypeV2,
      User, 
    ]),
    forwardRef(() => NotificationModuleV2),
    forwardRef(() => ImageModule),
    ScheduleModule,
  ],
    providers: [
    TemplateServiceV2,
    PaginationUtils,
    {
      provide: BaseFunctionHelperV2,
      useFactory: (bkUserRepo) => {
        const logger = new Logger(BaseFunctionHelperV2.name)
        return new BaseFunctionHelperV2(bkUserRepo, logger)
      },
      inject: [getRepositoryToken(BakongUser)],
    },
  ],
  exports: [TemplateServiceV2, TypeOrmModule],
  controllers: [TemplateV2Controller],
})
export class TemplateModuleV2 { }
