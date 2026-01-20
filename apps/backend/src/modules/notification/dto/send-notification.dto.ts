import { Transform, Type } from 'class-transformer'
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  ValidateIf,
  IsBoolean,
} from 'class-validator'
import { Language, NotificationType, Platform, BakongApp } from '@bakong/shared'
import { ValidationHelper } from 'src/common/util/validation.helper'

export default class SentNotificationDtoV2 {
  @IsOptional()
  @Transform(({ value }) => {
    // allow: "abc" OR ["abc","def"] OR "abc,def"
    if (value === undefined || value === null || value === '') return undefined
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      // support comma string too (optional)
      if (value.includes(',')) return value.split(',').map((s) => s.trim()).filter(Boolean)
      return value
    }
    return value
  })
  accountId?: string | string[]

  @IsOptional()
  @IsString()
  fcmToken?: string

  @IsOptional()
  @IsString()
  participantCode?: string

  @IsOptional()
  @IsString()
  topic?: string

  @IsOptional()
  @IsString()
  imageUrl?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  translations?: Array<any>

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const validation = ValidationHelper.validateLanguage(value)
      return validation.isValid ? validation.normalizedValue : value
    }
    return value
  })
  @IsEnum(Language, { message: 'Language must be one of: EN, KM, JP' })
  language?: Language

  @IsOptional()
  @IsNumber()
  templateId?: number

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const validation = ValidationHelper.validateNotificationType(value)
      return validation.isValid ? validation.normalizedValue : value
    }
    return value
  })
  @IsEnum(NotificationType, {
    message:
      'NotificationType must be a valid notification type : FLASH_NOTIFICATION, ANNOUNCEMENT, NOTIFICATION',
  })
  notificationType?: NotificationType

  @IsOptional()
  @IsString()
  categoryType?: string

  @IsOptional()
  @IsNumber()
  notificationId?: number

  @IsOptional()
  @IsEnum(BakongApp, {
    message: 'bakongPlatform must be one of: BAKONG, BAKONG_JUNIOR, BAKONG_TOURIST',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return ValidationHelper.normalizeEnum(value)
    }
    return value
  })
  bakongPlatform?: BakongApp

  @IsOptional()
  @IsBoolean()
  publishNow?: boolean
}

export class FlashNotificationDto {
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const validation = ValidationHelper.validateLanguage(value)
      return validation.isValid ? validation.normalizedValue : value
    }
    return value
  })
  @IsEnum(Language, { message: 'Language must be one of: EN, KM, JP' })
  language: Language

  @IsOptional()
  @Transform(({ value }) => {
    // allow: "abc" OR ["abc","def"] OR "abc,def"
    if (value === undefined || value === null || value === '') return undefined
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      // support comma string too (optional)
      if (value.includes(',')) return value.split(',').map((s) => s.trim()).filter(Boolean)
      return value
    }
    return value
  })
  accountId?: string | string[]
}
