import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsBoolean,
  IsNumber,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { TemplateTranslationDtoV2 } from './template-translation.v2.dto'
import { NotificationType, Platform, SendType, BakongApp } from '@bakong/shared'
import { ValidationHelper } from 'src/common/util/validation.helper'

export class UpdateTemplateDtoV2 {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((platform) => ValidationHelper.normalizeEnum(platform))
    }
    return value
  })
  @IsEnum(Platform, { each: true })
  platforms?: Platform[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateTranslationDtoV2)
  translations?: TemplateTranslationDtoV2[]

  @IsOptional()
  @IsEnum(NotificationType)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return ValidationHelper.normalizeEnum(value)
    }
    return value
  })
  notificationType?: NotificationType

  @IsOptional()
  @IsNumber()
  categoryTypeId?: number

  @IsOptional()
  @IsEnum(SendType)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return ValidationHelper.normalizeEnum(value)
    }
    return value
  })
  sendType?: SendType

  @IsOptional()
  @IsString()
  sendSchedule?: string

  @IsOptional()
  @IsBoolean()
  isSent?: boolean

  @IsOptional()
  @IsEnum(BakongApp)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return ValidationHelper.normalizeEnum(value)
    }
    return value
  })
  bakongPlatform?: BakongApp

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined // Don't set default on update
    const num = Number(value)
    return isNaN(num) ? undefined : Math.max(1, Math.min(10, num)) // Clamp between 1-10
  })
  showPerDay?: number

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined // Don't set default on update
    const num = Number(value)
    return isNaN(num) ? undefined : Math.max(1, Math.min(30, num)) // Clamp between 1-30
  })
  maxDayShowing?: number

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accountIds?: string[]
}
