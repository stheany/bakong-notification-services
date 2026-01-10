import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScheduleModule } from '@nestjs/schedule'
import { Template } from 'src/entities/template.entity'
import { TemplateTranslation } from 'src/entities/template-translation.entity'
import { TemplateV2Controller } from './template.v2.controller'
import { NotificationModule } from '../notification/notification.module'
import { ImageModule } from '../image/image.module'
import { Image } from 'src/entities/image.entity'
import { BakongUser } from 'src/entities/bakong-user.entity'
import { ImageService } from '../image/image.service'
import { CategoryType, PaginationUtils } from '@bakong/shared'
import { BaseFunctionHelper } from 'src/common/util/base-function.helper'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Logger } from '@nestjs/common'
import { TemplateController } from '../template/template.controller'
import { TemplateService } from '../template/template.service'
import { CategoryTypeV2 } from '@/entities/category-type-v2.entity'
import { User } from '@/entities/user.entity'
import { TemplateTranslationV2 } from '@/entities/template-translation.v2.entity'
import { TemplateServiceV2 } from './template.v2.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Template,
      TemplateTranslation,
      Image,
      BakongUser,
      CategoryTypeV2,
      User,
      TemplateTranslationV2,
    ]),
    forwardRef(() => NotificationModule),
    forwardRef(() => ImageModule),
    ScheduleModule,
  ],
  providers: [
    TemplateService,
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
  exports: [TemplateService, TemplateServiceV2],
  controllers: [TemplateController, TemplateV2Controller],
})
export class TemplateModule { }
