import { Module, Logger } from '@nestjs/common'
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm'
import { BakongUserV2 } from '@/entities/bakong-user.v2.entity'
import { BaseFunctionHelperV2 } from './base-function.v2.helper'

@Module({
  imports: [TypeOrmModule.forFeature([BakongUserV2])],
  providers: [
    {
      provide: BaseFunctionHelperV2,
      useFactory: (bkUserRepo) => {
        const logger = new Logger(BaseFunctionHelperV2.name)
        return new BaseFunctionHelperV2(bkUserRepo, logger)
      },
      inject: [getRepositoryToken(BakongUserV2)],
    },
  ],
  exports: [BaseFunctionHelperV2],
})
export class HelperV2Module {}
