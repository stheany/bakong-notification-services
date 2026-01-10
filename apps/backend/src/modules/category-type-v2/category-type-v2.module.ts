import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CategoryTypeV2 } from '@/entities/category-type-v2.entity'
import { CategoryTypeServiceV2 } from './category-type-v2.service'
import { CategoryTypeControllerV2 } from './category-type-v2.controller'

@Module({
  imports: [TypeOrmModule.forFeature([CategoryTypeV2])],
  controllers: [CategoryTypeControllerV2],
  providers: [CategoryTypeServiceV2],
  exports: [CategoryTypeServiceV2],
})
export class CategoryTypeModule { }
