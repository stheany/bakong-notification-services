import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  Inject,
  forwardRef,
  Logger,
  HttpException,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import moment from 'moment';
import { Image } from 'src/entities/image.entity';
import { BaseResponseDto } from 'src/common/base-response.dto';
import { Template } from 'src/entities/template.entity';
import { CategoryType } from 'src/entities/category-type.entity';
import { MoreThanOrEqual, Repository, Not, In } from 'typeorm';
import { NotificationService } from '../notification/notification.service';
import { TemplateTranslation } from 'src/entities/template-translation.entity';
import { User } from 'src/entities/user.entity';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { RejectTemplateDto } from './dto/reject-template.dto';
import { ImageService } from '../image/image.service';
import { PaginationUtils } from '@bakong/shared';
import {
  ErrorCode,
  ResponseMessage,
  SendType,
  NotificationType,
  TimezoneUtils,
  Language,
  ApprovalStatus,
  UserRole,
} from '@bakong/shared';
import { ValidationHelper } from 'src/common/util/validation.helper';
import { InboxResponseDto } from '../notification/dto/inbox-response.dto';
import { BaseFunctionHelper } from 'src/common/util/base-function.helper';
@Injectable()
export class TemplateService implements OnModuleInit {
  private readonly logger = new Logger(TemplateService.name);
  constructor(
    @InjectRepository(Template) private readonly repo: Repository<Template>,
    @InjectRepository(TemplateTranslation)
    private readonly translationRepo: Repository<TemplateTranslation>,
    @InjectRepository(Image)
    private readonly imageRepo: Repository<Image>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CategoryType)
    private readonly categoryTypeRepo: Repository<CategoryType>,
    @Inject(forwardRef(() => NotificationService))
    public readonly notificationService: NotificationService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly imageService: ImageService,
    private readonly baseFunctionHelper?: BaseFunctionHelper
  ) { }

  async onModuleInit() {
    await this.pickPendingSchedule();
  }

  async create(dto: CreateTemplateDto, currentUser?: any, req?: any) {
    console.log('🔵 [TEMPLATE CREATE] Starting template creation:', {
      notificationType: dto.notificationType,
      sendType: dto.sendType,
      isSent: dto.isSent,
      platforms: dto.platforms,
      hasTranslations: dto.translations?.length > 0,
    });
    if (dto.imageId) {
      const image = await this.imageRepo.findOne({
        where: { fileId: dto.imageId },
      });
      if (!image) {
        throw new BadRequestException(
          new BaseResponseDto({
            responseCode: 1,
            errorCode: ErrorCode.IMAGE_NOT_FOUND,
            responseMessage: ResponseMessage.IMAGE_NOT_FOUND,
          })
        );
      }
    }
    if (dto.sendSchedule) {
      const scheduledTime = moment.utc(dto.sendSchedule);
      const now = moment.utc();
      console.log('BACKEND SCHEDULE DEBUG:', {
        providedSchedule: dto.sendSchedule,
        sendType: dto.sendType,
        isSent: dto.isSent,
        scheduledTime: scheduledTime.format(),
        currentTime: now.format(),
        isScheduledTimeValid: scheduledTime.isValid(),
        isScheduledTimeInFuture: scheduledTime.isAfter(now),
        timeDifference: scheduledTime.diff(now, 'minutes'),
      });
      if (!scheduledTime.isValid()) {
        throw new BadRequestException(
          new BaseResponseDto({
            errorCode: ErrorCode.VALIDATION_FAILED,
            responseMessage: 'Invalid sendSchedule date format',
            data: {
              providedDate: dto.sendSchedule,
              expectedFormat: 'ISO 8601 format (e.g., 2025-10-06T09:30:00)',
            },
          })
        );
      }
      if (scheduledTime.isBefore(now)) {
        throw new BadRequestException(
          new BaseResponseDto({
            errorCode: ErrorCode.TEMPLATE_SEND_SCHEDULE_IN_PAST,
            responseMessage: ResponseMessage.TEMPLATE_SEND_SCHEDULE_IN_PAST,
            data: {
              scheduledTime: scheduledTime.format('h:mm A MMM D, YYYY'),
              currentTime: now.format('h:mm A MMM D, YYYY'),
              timezone: 'Asia/Phnom_Penh',
            },
          })
        );
      }
    }
    if (dto.sendType === SendType.SEND_INTERVAL && dto.sendInterval) {
      const startTime = moment(dto.sendInterval.startAt);
      const endTime = moment(dto.sendInterval.endAt);
      const now = moment();
      if (!startTime.isValid()) {
        throw new BadRequestException(
          new BaseResponseDto({
            errorCode: ErrorCode.VALIDATION_FAILED,
            responseMessage: 'Invalid sendInterval.startAt date format',
            data: {
              providedDate: dto.sendInterval.startAt,
              expectedFormat: 'ISO 8601 format (e.g., 2025-10-06T09:30:00)',
            },
          })
        );
      }
      if (!endTime.isValid()) {
        throw new BadRequestException(
          new BaseResponseDto({
            errorCode: ErrorCode.VALIDATION_FAILED,
            responseMessage: 'Invalid sendInterval.endAt date format',
            data: {
              providedDate: dto.sendInterval.endAt,
              expectedFormat: 'ISO 8601 format (e.g., 2025-10-06T09:40:00)',
            },
          })
        );
      }
      if (startTime.isBefore(now)) {
        throw new BadRequestException(
          new BaseResponseDto({
            errorCode: ErrorCode.TEMPLATE_SEND_SCHEDULE_IN_PAST,
            responseMessage: 'sendInterval.startAt cannot be in the past',
            data: {
              startTime: startTime.format('h:mm A MMM D, YYYY'),
              currentTime: now.format('h:mm A MMM D, YYYY'),
              timezone: 'Asia/Phnom_Penh',
            },
          })
        );
      }
      if (endTime.isBefore(startTime)) {
        throw new BadRequestException(
          new BaseResponseDto({
            errorCode: ErrorCode.VALIDATION_FAILED,
            responseMessage: 'sendInterval.endAt must be after startAt',
            data: {
              startTime: startTime.format('h:mm A MMM D, YYYY'),
              endTime: endTime.format('h:mm A MMM D, YYYY'),
              timezone: 'Asia/Phnom_Penh',
            },
          })
        );
      }
    }
    if (
      dto.sendType === SendType.SEND_SCHEDULE &&
      !dto.sendSchedule &&
      dto.notificationType !== NotificationType.FLASH_NOTIFICATION
    ) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.VALIDATION_FAILED,
          responseMessage: ResponseMessage.VALIDATION_FAILED,
        })
      );
    }
    const normalizedPlatforms = ValidationHelper.parsePlatforms(dto.platforms);
    let approvalStatus: ApprovalStatus | null;
    if (
      currentUser?.role === UserRole.EDITOR ||
      currentUser?.role === UserRole.ADMINISTRATOR
    ) {
      if (dto.isSent === true) {
        approvalStatus = ApprovalStatus.PENDING;
      } else {
        approvalStatus = null; // DRAFT
      }
    } else {
      approvalStatus = ApprovalStatus.APPROVED;
    }
    if (approvalStatus === ApprovalStatus.PENDING) {
      console.log(
        `🔵 [CREATE] User is trying to submit - validating users BEFORE creating template...`
      );
      const tempTemplate = {
        platforms: normalizedPlatforms,
        bakongPlatform: dto.bakongPlatform,
      } as Template;
      const hasMatchingUsers = await this.validateMatchingUsers(tempTemplate);
      if (!hasMatchingUsers) {
        const platformInfo = `OS platform: ${tempTemplate.platforms?.join(', ') || 'ALL'
          }, Bakong platform: ${tempTemplate.bakongPlatform}`;
        const platformName =
          tempTemplate.bakongPlatform === 'BAKONG_TOURIST'
            ? 'Bakong Tourist'
            : tempTemplate.bakongPlatform === 'BAKONG_JUNIOR'
              ? 'Bakong Junior'
              : 'Bakong';
        const osPlatforms =
          tempTemplate.platforms?.filter((p) => p !== 'ALL').join(', ') ||
          'ALL';
        const errorMessage = `No users found for Using ${osPlatforms} on ${platformName} app.`;
        this.logger.error(
          `❌ [CREATE] No users match platform requirements (${platformInfo}). Preventing template creation, keeping as draft.`
        );
        throw new BadRequestException(
          new BaseResponseDto({
            responseCode: 1,
            errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
            responseMessage: errorMessage,
          })
        );
      }
      console.log(
        `🔵 [CREATE] ✅ Users validated - template creation can proceed`
      );
    }
    const initialIsSent =
      dto.sendType === SendType.SEND_SCHEDULE
        ? false // Scheduled notifications are never sent immediately - wait for scheduled time
        : approvalStatus === ApprovalStatus.PENDING
          ? false // PENDING templates should not be sent until approved
          : dto.sendType === SendType.SEND_NOW
            ? dto.isSent !== false && approvalStatus === ApprovalStatus.APPROVED // Only send if approved
            : dto.isSent === true && approvalStatus === ApprovalStatus.APPROVED;
    let template = this.repo.create({
      platforms: normalizedPlatforms,
      bakongPlatform: dto.bakongPlatform,
      sendType: dto.sendType,
      isSent: initialIsSent,
      notificationType:
        dto.notificationType || NotificationType.FLASH_NOTIFICATION,
      categoryTypeId: dto.categoryTypeId,
      priority: dto.priority || 0,
      sendSchedule: dto.sendSchedule
        ? moment.utc(dto.sendSchedule).toDate()
        : null,
      sendInterval: dto.sendInterval
        ? {
          ...dto.sendInterval,
          startAt: moment(dto.sendInterval.startAt).toDate(),
          endAt: moment(dto.sendInterval.endAt).toDate(),
        }
        : null,
      showPerDay: dto.showPerDay !== undefined ? dto.showPerDay : 1,
      maxDayShowing: dto.maxDayShowing !== undefined ? dto.maxDayShowing : 1,
      createdBy: currentUser?.username,
      updatedBy: currentUser?.username,
      approvalStatus: approvalStatus,
    });
    template = await this.repo.save(template);
    console.log('🔵 [TEMPLATE CREATE] Template saved with ID:', template.id);
    if (dto.translations && dto.translations.length > 0) {
      const now = new Date();
      const translationsMap = new Map();
      dto.translations.forEach((t) => {
        translationsMap.set(t.language, t);
      });
      const isDraft = template.isSent === false;
      const getFallbackValue = (
        field: 'title' | 'content',
        language: Language
      ): string => {
        const current = translationsMap.get(language);
        if (current && current[field] && String(current[field]).trim() !== '') {
          return String(current[field]);
        }
        let fallbackOrder: Language[] = [];
        if (language === Language.KM) {
          fallbackOrder = [Language.EN, Language.JP];
        } else if (language === Language.EN) {
          fallbackOrder = [Language.KM, Language.JP];
        } else if (language === Language.JP) {
          fallbackOrder = [Language.KM, Language.EN];
        }
        for (const fallbackLang of fallbackOrder) {
          const fallback = translationsMap.get(fallbackLang);
          if (
            fallback &&
            fallback[field] &&
            String(fallback[field]).trim() !== ''
          ) {
            return String(fallback[field]);
          }
        }
        return '';
      };
      if (!isDraft) {
        dto.translations.forEach((translation) => {
          if (
            translation.title === undefined ||
            translation.title === null ||
            String(translation.title).trim() === ''
          ) {
            translation.title = getFallbackValue('title', translation.language);
          }
          if (
            translation.content === undefined ||
            translation.content === null ||
            String(translation.content).trim() === ''
          ) {
            translation.content = getFallbackValue(
              'content',
              translation.language
            );
          }
        });
      }
      const translationsToProcess = isDraft
        ? dto.translations.filter((t) => {
          const hasTitle = t.title && String(t.title).trim() !== '';
          const hasContent = t.content && String(t.content).trim() !== '';
          const hasImage = t.image && String(t.image).trim() !== '';
          return hasTitle || hasContent || hasImage;
        })
        : dto.translations;
      for (const translation of translationsToProcess) {
        const existingTranslation = await this.translationRepo.findOne({
          where: {
            templateId: template.id,
            language: translation.language,
          },
        });
        // If all fields are empty, delete the translation and skip fallback logic
        const allEmpty =
          (!translation.title || String(translation.title).trim() === '') &&
          (!translation.content || String(translation.content).trim() === '') &&
          (!translation.image || String(translation.image).trim() === '') &&
          (!translation.linkPreview || String(translation.linkPreview).trim() === '');
        if (allEmpty) {
          if (existingTranslation) {
            this.logger.log(
              `[TRANSLATION DELETE] Deleting translation: templateId=${template.id}, language=${translation.language}, translationId=${existingTranslation.id}`
            );
            await this.translationRepo.delete({ id: existingTranslation.id });
          } else {
            this.logger.log(
              `[TRANSLATION DELETE] No existing translation found for templateId=${template.id}, language=${translation.language}`
            );
          }
          this.logger.log(
            `[TRANSLATION SKIP] Skipping insert/update for empty translation: language=${translation.language}`
          );
          // Remove from response: do not add/save this translation
          // Remove from translationsMap so it is not processed again
          if (translationsMap) {
            translationsMap.delete(translation.language);
          }
          continue;
        }
        // Only apply fallback if NOT all fields are empty
        let imageId = null;
        const imageValue =
          translation.image && String(translation.image).trim() !== ''
            ? String(translation.image).trim()
            : null;
        if (imageValue) {
          if (template.isSent === false) {
            imageId = imageValue;
          } else {
            const imageExists = await this.imageService.validateImageExists(
              imageValue
            );
            if (imageExists) {
              imageId = imageValue;
            }
          }
        } else if (dto.imageId && String(dto.imageId).trim() !== '') {
          const dtoImageValue = String(dto.imageId).trim();
          if (template.isSent === false) {
            imageId = dtoImageValue;
          } else {
            const imageExists = await this.imageService.validateImageExists(
              dtoImageValue
            );
            if (imageExists) {
              imageId = dtoImageValue;
            }
          }
        }
        const title =
          translation.title !== undefined && translation.title !== null
            ? String(translation.title)
            : '';
        const content =
          translation.content !== undefined && translation.content !== null
            ? String(translation.content)
            : '';
        const linkPreview = translation.linkPreview || null;
        if (template.isSent !== false && (!title || !content)) {
          throw new BadRequestException(
            new BaseResponseDto({
              responseCode: 1,
              errorCode: ErrorCode.VALIDATION_FAILED,
              responseMessage:
                'Title and content are required for published notifications',
              data: {},
            })
          );
        }
        if (existingTranslation) {
          const needsUpdate =
            existingTranslation.title !== title ||
            existingTranslation.content !== content ||
            existingTranslation.imageId !== imageId ||
            existingTranslation.linkPreview !== linkPreview;
          if (needsUpdate) {
            await this.translationRepo.update(existingTranslation.id, {
              title: title,
              content: content,
              imageId: imageId,
              linkPreview: linkPreview,
              updatedAt: now,
            });
          }
        } else {
          await this.translationRepo.save({
            templateId: template.id,
            language: translation.language,
            title: title,
            content: content,
            imageId: imageId,
            linkPreview: linkPreview,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
    const templateWithRelations = await this.repo.findOne({
      where: { id: template.id },
      relations: ['translations', 'translations.image', 'categoryTypeEntity'],
    });
    if (templateWithRelations) {
      template = templateWithRelations;
      console.log('🔵 [TEMPLATE CREATE] Template reloaded with relations:', {
        templateId: template.id,
        translationsCount: template.translations?.length || 0,
        hasTranslations: !!template.translations?.length,
      });
    } else {
      console.error(
        '🔵 [TEMPLATE CREATE] ⚠️ Could not reload template with relations!'
      );
    }
    console.log('🔵 [TEMPLATE CREATE] Ready to check sending logic:', {
      notificationType: template.notificationType,
      isFlashNotification:
        template.notificationType === NotificationType.FLASH_NOTIFICATION,
      sendType: template.sendType,
      isSent: template.isSent,
      hasTranslations: template.translations?.length > 0 || false,
      translationsCount: template.translations?.length || 0,
    });
    if (template.notificationType === NotificationType.FLASH_NOTIFICATION) {
      console.log(
        '🔵 [TEMPLATE CREATE] FLASH_NOTIFICATION - will send FCM push (mobile displays as popup)'
      );
    }
    console.log('🔵 [TEMPLATE CREATE] SEND TYPE DEBUG:', {
      sendType: template.sendType,
      isSent: template.isSent,
      sendSchedule: template.sendSchedule,
      templateId: template.id,
    });
    const shouldAutoSend = template.isSent === true;
    console.log(
      '🔵 [TEMPLATE CREATE] shouldAutoSend:',
      shouldAutoSend,
      'isSent:',
      template.isSent,
      'sendType:',
      template.sendType
    );
    switch (template.sendType) {
      case SendType.SEND_NOW:
        if (!shouldAutoSend) {
          console.log(
            '🔵 [TEMPLATE CREATE] Skipping SEND_NOW - this is a draft (isSent=false):',
            template.id
          );
          break;
        }
        console.log(
          '🔵 [TEMPLATE CREATE] Executing SEND_NOW for template:',
          template.id
        );
        console.log('🔵 [TEMPLATE CREATE] Template has translations?', {
          hasTranslations: !!template.translations,
          translationsCount: template.translations?.length || 0,
          translations: template.translations?.map((t) => ({
            language: t.language,
            title: t.title,
          })),
        });
        const templateWithTranslations = template;
        if (
          !templateWithTranslations ||
          !templateWithTranslations.translations ||
          templateWithTranslations.translations.length === 0
        ) {
          console.error(
            '🔵 [TEMPLATE CREATE] ❌ No translations found for template:',
            template.id
          );
          console.error('🔵 [TEMPLATE CREATE] Template object:', {
            id: templateWithTranslations?.id,
            translations: templateWithTranslations?.translations,
            translationsType: typeof templateWithTranslations?.translations,
          });
          break;
        }
        console.log(
          '🔵 [TEMPLATE CREATE] ✅ Translations found, calling sendWithTemplate...'
        );
        if (template.approvalStatus !== ApprovalStatus.APPROVED) {
          console.log(
            `🔵 [TEMPLATE CREATE] ⏸️ Skipping send - template ${template.id} has approvalStatus: ${template.approvalStatus}, waiting for approval`
          );
          await this.repo.update(template.id, { isSent: false });
          break;
        }
        let sendResult: {
          successfulCount: number;
          failedCount: number;
          failedUsers?: string[];
          failedDueToInvalidTokens?: boolean;
        } = {
          successfulCount: 0,
          failedCount: 0,
          failedUsers: [],
          failedDueToInvalidTokens: false,
        };
        let sendError: any = null;
        let noUsersForPlatform = false;
        try {
          sendResult = await this.notificationService.sendWithTemplate(
            templateWithTranslations
          );
          console.log(
            '🔵 [TEMPLATE CREATE] sendWithTemplate returned:',
            sendResult
          );
        } catch (error: any) {
          console.error('🔵 [TEMPLATE CREATE] ❌ ERROR in sendWithTemplate:', {
            message: error?.message,
            stack: error?.stack,
            code: error?.code,
            fullError:
              process.env.NODE_ENV === 'development'
                ? error
                : 'Hidden in production',
          });
          sendError = error;
          sendResult = {
            successfulCount: 0,
            failedCount: 0,
            failedUsers: [],
            failedDueToInvalidTokens: false,
          };
          if (error?.message && error.message.includes('No users found for')) {
            noUsersForPlatform = true;
            console.log(
              '🔵 [TEMPLATE CREATE] ⚠️ No users found for bakongPlatform - keeping as draft'
            );
          }
        }
        if (noUsersForPlatform) {
          console.log(
            '📊 SEND_NOW Result: No users for platform - keeping as draft'
          );
          console.log('📊 Template will remain as draft (isSent=false)');
          await this.repo.update(template.id, { isSent: false });
          console.log(
            '✅ Template kept as draft due to no users for target platform'
          );
          (template as any).savedAsDraftNoUsers = true;
          break;
        }
        console.log('📊 SEND_NOW Result:', {
          templateId: template.id,
          successfulCount: sendResult.successfulCount,
          failedCount: sendResult.failedCount,
          willMarkAsPublished: sendResult.successfulCount > 0, // Only mark as published if successfully sent
        });
        if (sendResult.successfulCount > 0) {
          await this.markAsPublished(template.id, currentUser);
          console.log('✅ Template marked as published:', template.id);
          console.log(
            `✅ Successfully sent to ${sendResult.successfulCount} user(s)`
          );
          if (sendResult.failedCount > 0) {
            console.log(
              `⚠️ Failed to send to ${sendResult.failedCount} user(s)`
            );
            if (sendResult.failedUsers && sendResult.failedUsers.length > 0) {
              console.log('❌ Failed users:', sendResult.failedUsers);
            }
          }
        } else {
          console.warn(
            '⚠️ No notifications were sent (successfulCount = 0) - keeping as draft'
          );
          const failedDueToInvalidTokens =
            sendResult.failedDueToInvalidTokens === true;
          const failedCount = sendResult.failedCount || 0;
          const hasNoUsers =
            failedCount === 0 &&
            sendResult.successfulCount === 0 &&
            !failedDueToInvalidTokens;
          if (hasNoUsers) {
            console.warn('⚠️ This might indicate:');
            console.warn('   1. No users have FCM tokens');
            console.warn('   2. No users match the platform filter');
            console.warn('   3. FCM token validation failed');
            console.warn('   4. Firebase FCM not initialized');
            console.warn('   5. No users in database');
            (template as any).savedAsDraftNoUsers = true;
          } else if (failedDueToInvalidTokens && failedCount > 0) {
            console.warn(
              `⚠️ All ${failedCount} send attempts failed due to invalid tokens - keeping as draft`
            );
            if (sendResult.failedUsers && sendResult.failedUsers.length > 0) {
              console.warn(
                '❌ Failed users (invalid tokens):',
                sendResult.failedUsers
              );
            }
          } else {
            console.warn(
              `⚠️ All ${failedCount} send attempts failed - keeping as draft`
            );
            if (sendResult.failedUsers && sendResult.failedUsers.length > 0) {
              console.warn('❌ Failed users:', sendResult.failedUsers);
            }
          }
          await this.repo.update(template.id, { isSent: false });
        }
        (template as any).successfulCount = sendResult.successfulCount;
        (template as any).failedCount = sendResult.failedCount;
        (template as any).failedUsers = sendResult.failedUsers || [];
        (template as any).failedDueToInvalidTokens =
          sendResult.failedDueToInvalidTokens || false;
        break;
      case SendType.SEND_SCHEDULE:
        console.log('Executing SEND_SCHEDULE for template:', template.id);
        if (shouldAutoSend) {
          const hasMatchingUsers = await this.validateMatchingUsers(template);
          if (!hasMatchingUsers) {
            console.log(
              '🔵 [TEMPLATE CREATE] ⚠️ No matching users found for scheduled notification - keeping as draft'
            );
            console.log(
              '📊 SEND_SCHEDULE Result: No matching users - keeping as draft'
            );
            console.log('📊 Template will remain as draft (isSent=false)');
            await this.repo.update(template.id, { isSent: false });
            console.log('✅ Template kept as draft due to no matching users');
            (template as any).savedAsDraftNoUsers = true;
            break;
          }
        }
        this.addScheduleNotification(template);
        break;
      case SendType.SEND_INTERVAL:
        console.log('Executing SEND_INTERVAL for template:', template.id);
        this.addIntervalNotification(template);
        break;
      default:
        console.log('Unknown send type:', template.sendType);
    }
    await this.repo.manager.connection.queryResultCache?.clear();
    const templateWithTranslations = await this.findOneRaw(template.id);
    if ((template as any).savedAsDraftNoUsers) {
      (templateWithTranslations as any).savedAsDraftNoUsers = true;
    }
    if ((template as any).successfulCount !== undefined) {
      (templateWithTranslations as any).successfulCount = (
        template as any
      ).successfulCount;
      (templateWithTranslations as any).failedCount = (
        template as any
      ).failedCount;
      (templateWithTranslations as any).failedUsers = (
        template as any
      ).failedUsers;
    }
    return this.formatTemplateResponse(templateWithTranslations);
  }

  async update(
    id: number,
    dto: UpdateTemplateDto,
    currentUser?: any,
    req?: any
  ) {
    if (
      dto.removeOtherTranslations &&
      dto.bakongPlatform === 'BAKONG_TOURIST'
    ) {
      console.log(
        `🟢 [UPDATE] removeOtherTranslations flag detected for Bakong Tourist. Deleting all non-EN translations for template ${id}`
      );
      await this.translationRepo.delete({
        templateId: id,
        language: Not(Language.EN),
      });
    }
    console.log(`\n🔵 [UPDATE] ========== START UPDATE REQUEST ==========`);
    console.log(`🔵 [UPDATE] Template ID: ${id}`);
    console.log(
      `🔵 [UPDATE] Current User: ${currentUser?.username || 'NO USER'} (Role: ${currentUser?.role || 'NO ROLE'
      })`
    );
    console.log(`🔵 [UPDATE] Request DTO:`, {
      isSent: dto.isSent,
      sendType: dto.sendType,
      sendSchedule: dto.sendSchedule,
      hasTranslations: !!dto.translations?.length,
      platforms: dto.platforms,
    });
    const {
      platforms,
      bakongPlatform,
      translations,
      notificationType,
      categoryTypeId,
      sendType,
      sendSchedule,
      isSent,
    } = dto;
    const template = await this.findOneRaw(id);
    console.log(`🔵 [UPDATE] Current Template State:`, {
      id: template.id,
      isSent: template.isSent,
      sendType: template.sendType,
      approvalStatus: template.approvalStatus,
      sendSchedule: template.sendSchedule,
    });
    const isApproverPublishingPending =
      currentUser?.role === UserRole.APPROVAL &&
      template.approvalStatus === ApprovalStatus.PENDING &&
      dto.isSent === true;
    console.log(`🔵 [UPDATE] Is approver publishing pending template:`, {
      isApproverPublishingPending,
      userRole: currentUser?.role,
      templateApprovalStatus: template.approvalStatus,
      dtoIsSent: dto.isSent,
      templateIsSent: template.isSent,
    });
    if (
      template.approvalStatus === ApprovalStatus.APPROVED &&
      !isApproverPublishingPending
    ) {
      console.log(
        `🔵 [UPDATE] Routing to editPublishedNotification (template is APPROVED and not approver publishing pending)`
      );
      return await this.editPublishedNotification(id, dto, currentUser, req);
    }
    if (isApproverPublishingPending) {
      console.log(
        `🔵 [UPDATE] ✅ Approver publishing PENDING template - will go through send flow (not editPublishedNotification)`
      );
    }
    if (!isApproverPublishingPending) {
      console.log(`🔵 [UPDATE] Running validateModificationTemplate...`);
      this.validateModificationTemplate(template);
    } else {
      console.log(
        `🔵 [UPDATE] ⏭️ Skipping validateModificationTemplate for approver publishing pending template`
      );
    }
    try {
      const updateFields: any = {};
      if (platforms !== undefined) {
        const normalizedPlatforms = ValidationHelper.parsePlatforms(platforms);
        console.log(
          `🔵 [UPDATE] Platforms explicitly provided in update request:`,
          {
            original: platforms,
            normalized: normalizedPlatforms,
            existing: template.platforms,
          }
        );
        updateFields.platforms = normalizedPlatforms;
      } else {
        console.log(
          `🔵 [UPDATE] Platforms NOT provided in update request - preserving existing:`,
          template.platforms
        );
      }
      if (bakongPlatform !== undefined)
        updateFields.bakongPlatform = bakongPlatform;
      if (notificationType !== undefined)
        updateFields.notificationType = notificationType;
      if (categoryTypeId !== undefined)
        updateFields.categoryTypeId = categoryTypeId;
      if (sendType !== undefined) {
        updateFields.sendType = sendType;
      }
      if (sendSchedule !== undefined) {
        console.log(`🔵 [UPDATE] Processing sendSchedule update:`, {
          provided: sendSchedule,
          current: template.sendSchedule,
          willUpdate: sendSchedule !== null && sendSchedule !== undefined,
        });
        if (sendSchedule) {
          const scheduledTime = moment.utc(sendSchedule);
          const existingScheduleTime = template.sendSchedule
            ? moment.utc(template.sendSchedule)
            : null;
          if (!scheduledTime.isValid()) {
            throw new BadRequestException(
              new BaseResponseDto({
                responseCode: 1,
                errorCode: ErrorCode.VALIDATION_FAILED,
                responseMessage: 'Invalid sendSchedule date format',
                data: {
                  providedDate: sendSchedule,
                  expectedFormat: 'ISO 8601 format (e.g., 2025-10-06T09:30:00)',
                },
              })
            );
          }
          const isPreservingExistingSchedule =
            existingScheduleTime && scheduledTime.isSame(existingScheduleTime);
          if (!isPreservingExistingSchedule) {
            const now = moment.utc();
            if (scheduledTime.isBefore(now.clone().subtract(1, 'minute'))) {
              throw new BadRequestException(
                new BaseResponseDto({
                  responseCode: 1,
                  errorCode: ErrorCode.TEMPLATE_SEND_SCHEDULE_IN_PAST,
                  responseMessage:
                    ResponseMessage.TEMPLATE_SEND_SCHEDULE_IN_PAST,
                  data: {
                    scheduledTime: scheduledTime.format('h:mm A MMM D, YYYY'),
                    currentTime: now.format('h:mm A MMM D, YYYY'),
                  },
                })
              );
            }
          } else {
            console.log(
              `🔵 [UPDATE] ⏭️ Preserving existing schedule time (no validation needed):`,
              {
                utc: scheduledTime.toISOString(),
                cambodia: scheduledTime
                  .clone()
                  .utcOffset(7)
                  .format('YYYY-MM-DD HH:mm:ss'),
              }
            );
          }
          updateFields.sendSchedule = scheduledTime.toDate();
          console.log(`🔵 [UPDATE] ✅ Setting sendSchedule to:`, {
            utc: scheduledTime.toISOString(),
            local: scheduledTime.format('YYYY-MM-DD HH:mm:ss'),
            cambodia: scheduledTime
              .clone()
              .utcOffset(7)
              .format('YYYY-MM-DD HH:mm:ss'),
            isPreservingExisting: isPreservingExistingSchedule,
          });
        } else {
          updateFields.sendSchedule = null;
          console.log(`🔵 [UPDATE] ✅ Clearing sendSchedule (null provided)`);
        }
      }
      if (isSent !== undefined) {
        updateFields.isSent = isSent;
      }
      if (dto.showPerDay !== undefined) {
        updateFields.showPerDay = dto.showPerDay;
      }
      if (dto.maxDayShowing !== undefined) {
        updateFields.maxDayShowing = dto.maxDayShowing;
      }
      if (currentUser?.username) {
        updateFields.updatedBy = currentUser.username;
      }
      if (
        currentUser?.role === UserRole.EDITOR ||
        currentUser?.role === UserRole.ADMINISTRATOR
      ) {
        const existingTemplate = await this.repo.findOne({ where: { id } });
        if (existingTemplate) {
          if (
            (existingTemplate.approvalStatus ===
              ('EXPIRED' as ApprovalStatus) ||
              existingTemplate.approvalStatus === ApprovalStatus.REJECTED) &&
            isSent === true
          ) {
            console.log(
              `🔄 [UPDATE] Resubmitting ${existingTemplate.approvalStatus} template ${id} - resetting approvalStatus to PENDING`
            );
            updateFields.approvalStatus = ApprovalStatus.PENDING;
            updateFields.approvedBy = null;
            updateFields.approvedAt = null;
            updateFields.reasonForRejection = null;
          } else if (
            existingTemplate.approvalStatus === null ||
            existingTemplate.approvalStatus === undefined
          ) {
            if (isSent === true) {
              console.log(
                `🔄 [UPDATE] Submitting DRAFT template ${id} - setting approvalStatus to PENDING`
              );
              updateFields.approvalStatus = ApprovalStatus.PENDING;
              updateFields.approvedBy = null;
              updateFields.approvedAt = null;
              updateFields.reasonForRejection = null;
            } else {
              updateFields.reasonForRejection = null;
            }
          } else if (
            existingTemplate.approvalStatus === ApprovalStatus.PENDING
          ) {
            updateFields.reasonForRejection = null;
          } else if (
            existingTemplate.approvalStatus === ApprovalStatus.APPROVED
          ) {
            const existingIsScheduled =
              existingTemplate.sendSchedule !== null &&
              existingTemplate.sendSchedule !== undefined;
            const newIsScheduled =
              sendSchedule !== null && sendSchedule !== undefined;
            const isScheduledTemplate = existingIsScheduled || newIsScheduled; // Template is/was scheduled
            const isPublishedTemplate =
              existingTemplate.isSent === true && !existingIsScheduled;
            if (isScheduledTemplate || isPublishedTemplate) {
              console.log(
                `🔄 [UPDATE] Editing APPROVED template ${id} from ${isScheduledTemplate ? 'Scheduled' : 'Published'
                } tab - preserving APPROVED status`
              );
              updateFields.reasonForRejection = null;
            } else {
              console.log(
                `🔄 [UPDATE] Editing APPROVED template ${id} - resetting approvalStatus to PENDING`
              );
              updateFields.approvalStatus = ApprovalStatus.PENDING;
              updateFields.approvedBy = null;
              updateFields.approvedAt = null;
            }
          } else if (
            existingTemplate.approvalStatus === ApprovalStatus.REJECTED &&
            isSent !== true
          ) {
          }
        }
      }
      const isTryingToSubmit =
        (isSent !== undefined && isSent === true) ||
        (isSent === undefined && dto.isSent === true) ||
        updateFields.approvalStatus === ApprovalStatus.PENDING ||
        (template.approvalStatus === ApprovalStatus.REJECTED &&
          isSent !== undefined &&
          isSent === true) ||
        (template.approvalStatus === ('EXPIRED' as ApprovalStatus) &&
          isSent !== undefined &&
          isSent === true);
      const pendingApprovalStatus = updateFields.approvalStatus;
      if (
        isTryingToSubmit &&
        updateFields.approvalStatus === ApprovalStatus.PENDING
      ) {
        delete updateFields.approvalStatus;
      }
      if (Object.keys(updateFields).length > 0) {
        await this.repo.update(id, updateFields);
      }
      if (translations && translations.length > 0) {
        // --- Translation deletion logic ---
        const translationsToDelete = [];
        for (const translation of translations) {
          const existingTranslation = await this.translationRepo.findOne({
            where: {
              templateId: id,
              language: translation.language,
            },
          });
          const allEmpty =
            (!translation.title || String(translation.title).trim() === '') &&
            (!translation.content || String(translation.content).trim() === '') &&
            (!translation.image || String(translation.image).trim() === '') &&
            (!translation.linkPreview || String(translation.linkPreview).trim() === '');
          if (allEmpty && existingTranslation) {
            console.log(
              `🗑️ [UPDATE] Translation for template ${id}, language ${translation.language} is empty and exists in DB. Deleting it.`
            );
            await this.translationRepo.delete({ id: existingTranslation.id });
            translationsToDelete.push(translation.language);
          }
        }

        // Remove deleted translations from the local array so they aren't re-saved below
        const filteredTranslations = translations.filter(
          (t) => !translationsToDelete.includes(t.language)
        );

        // --- Existing translation update/save logic ---
        const translationsMap = new Map();
        filteredTranslations.forEach((t) => {
          translationsMap.set(t.language, t);
        });
        const existingTemplate = await this.repo.findOne({ where: { id } });
        const isDraft = existingTemplate?.isSent === false;
        const getFallbackValue = (
          field: 'title' | 'content',
          language: Language
        ): string => {
          const current = translationsMap.get(language);
          if (
            current &&
            current[field] &&
            String(current[field]).trim() !== ''
          ) {
            return String(current[field]);
          }
          let fallbackOrder: Language[] = [];
          if (language === Language.KM) {
            fallbackOrder = [Language.EN, Language.JP];
          } else if (language === Language.EN) {
            fallbackOrder = [Language.KM, Language.JP];
          } else if (language === Language.JP) {
            fallbackOrder = [Language.KM, Language.EN];
          }
          for (const fallbackLang of fallbackOrder) {
            const fallback = translationsMap.get(fallbackLang);
            if (
              fallback &&
              fallback[field] &&
              String(fallback[field]).trim() !== ''
            ) {
              return String(fallback[field]);
            }
          }
          return '';
        };
        if (!isDraft) {
          filteredTranslations.forEach((translation) => {
            if (
              translation.title === undefined ||
              translation.title === null ||
              String(translation.title).trim() === ''
            ) {
              translation.title = getFallbackValue(
                'title',
                translation.language
              );
            }
            if (
              translation.content === undefined ||
              translation.content === null ||
              String(translation.content).trim() === ''
            ) {
              translation.content = getFallbackValue(
                'content',
                translation.language
              );
            }
          });
        }
        for (const translation of filteredTranslations) {
          const {
            language,
            title,
            content,
            image,
            linkPreview,
            id: translationId,
          } = translation;
          const titleValue =
            title !== undefined && title !== null ? String(title) : '';
          const contentValue =
            content !== undefined && content !== null ? String(content) : '';
          let item = null;
          if (translationId) {
            item = await this.translationRepo.findOne({
              where: { id: translationId, templateId: id },
            });
            if (!item) {
              this.logger.warn(
                `⚠️ [Template Update] Translation ID ${translationId} not found for template ${id}, falling back to language matching`
              );
            }
          }
          if (!item) {
            item = await this.translationRepo.findOneBy({
              templateId: id,
              language: language,
            });
          }
          if (item) {
            let imageId = item.imageId;
            const oldImageId = item.imageId;
            if (translation.image !== undefined) {
              if (image && String(image).trim() !== '') {
                const imageExists = await this.imageService.validateImageExists(
                  image
                );
                if (imageExists) {
                  imageId = image;
                  if (oldImageId !== imageId) {
                    this.logger.log(
                      `🖼️ [Template Update] Updating imageId for template ${id}, language ${language}: ${oldImageId || 'null'
                      } -> ${imageId}`
                    );
                  }
                } else {
                  this.logger.warn(
                    `⚠️ [Template Update] Image ${image} does not exist, setting imageId to null for template ${id}, language ${language}`
                  );
                  imageId = null;
                }
              } else {
                if (oldImageId) {
                  this.logger.log(
                    `🖼️ [Template Update] Removing imageId for template ${id}, language ${language}: ${oldImageId} -> null`
                  );
                }
                imageId = null;
              }
            }
            if (
              item.title !== titleValue ||
              item.content !== contentValue ||
              item.imageId !== imageId ||
              item.linkPreview !== linkPreview
            ) {
              await this.translationRepo.update(item.id, {
                title: titleValue,
                content: contentValue,
                imageId: imageId,
                linkPreview: linkPreview,
                updatedAt: new Date(),
              });
              if (oldImageId !== imageId) {
                this.logger.log(
                  `✅ [Template Update] Successfully updated imageId for template ${id}, language ${language}: ${oldImageId || 'null'
                  } -> ${imageId || 'null'}`
                );
              }
            }
          } else {
            let imageId = null;
            if (translation.image) {
              const imageExists = await this.imageService.validateImageExists(
                translation.image
              );
              if (imageExists) {
                imageId = translation.image;
              }
            }
            await this.translationRepo.save({
              templateId: id,
              language: translation.language,
              title: titleValue,
              content: contentValue,
              imageId: imageId,
              linkPreview: translation.linkPreview,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }
      if (
        isTryingToSubmit &&
        pendingApprovalStatus === ApprovalStatus.PENDING
      ) {
        console.log(
          `🔵 [UPDATE] User is trying to submit - validating users AFTER data is saved...`
        );
        const updatedTemplate = await this.findOneRaw(id);
        const tempTemplate = {
          ...updatedTemplate,
          platforms:
            updateFields.platforms !== undefined
              ? updateFields.platforms
              : updatedTemplate.platforms,
          bakongPlatform:
            updateFields.bakongPlatform !== undefined
              ? updateFields.bakongPlatform
              : updatedTemplate.bakongPlatform,
        } as Template;
        const hasMatchingUsers = await this.validateMatchingUsers(tempTemplate);
        if (!hasMatchingUsers) {
          const platformInfo = `OS platform: ${tempTemplate.platforms?.join(', ') || 'ALL'
            }, Bakong platform: ${tempTemplate.bakongPlatform}`;
          const platformName =
            tempTemplate.bakongPlatform === 'BAKONG_TOURIST'
              ? 'Bakong Tourist'
              : tempTemplate.bakongPlatform === 'BAKONG_JUNIOR'
                ? 'Bakong Junior'
                : 'Bakong';
          const osPlatforms =
            tempTemplate.platforms?.filter((p) => p !== 'ALL').join(', ') ||
            'ALL';
          const errorMessage = `No users found for Using ${osPlatforms} on ${platformName} app.`;
          this.logger.error(
            `❌ [UPDATE] No users match platform requirements (${platformInfo}). Data saved but keeping template in draft.`
          );
          await this.repo.update(id, {
            approvalStatus: null,
            reasonForRejection: null,
          });
          throw new BadRequestException(
            new BaseResponseDto({
              responseCode: 1,
              errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
              responseMessage: errorMessage,
            })
          );
        }
        console.log(
          `🔵 [UPDATE] ✅ Users validated - updating approvalStatus to PENDING`
        );
        await this.repo.update(id, {
          approvalStatus: ApprovalStatus.PENDING,
          reasonForRejection: null, // Clear any previous rejection reason
        });
      }
      const updatedTemplate = await this.findOneRaw(id);
      console.log(`🔵 [UPDATE] Template after field updates:`, {
        id: updatedTemplate.id,
        isSent: updatedTemplate.isSent,
        sendType: updatedTemplate.sendType,
        approvalStatus: updatedTemplate.approvalStatus,
        sendSchedule: updatedTemplate.sendSchedule,
      });
      const isApproverPublishNow =
        currentUser?.role === UserRole.APPROVAL &&
        updatedTemplate.isSent === true;
      const isResubmissionFromRejected =
        (template.approvalStatus === ApprovalStatus.REJECTED ||
          template.approvalStatus === ('EXPIRED' as ApprovalStatus)) &&
        updatedTemplate.approvalStatus === ApprovalStatus.PENDING &&
        (currentUser?.role === UserRole.ADMINISTRATOR ||
          currentUser?.role === UserRole.EDITOR);
      console.log(`🔵 [UPDATE] Send Decision Logic:`, {
        isApproverPublishNow,
        userRole: currentUser?.role,
        templateIsSent: updatedTemplate.isSent,
        templateSendType: updatedTemplate.sendType,
        isSendNow:
          updatedTemplate.sendType === SendType.SEND_NOW &&
          updatedTemplate.isSent === true,
        isResubmissionFromRejected,
        originalApprovalStatus: template.approvalStatus,
        newApprovalStatus: updatedTemplate.approvalStatus,
      });
      const shouldSendImmediately =
        isApproverPublishNow ||
        (updatedTemplate.sendType === SendType.SEND_NOW &&
          updatedTemplate.isSent === true &&
          !isResubmissionFromRejected &&
          updatedTemplate.approvalStatus !== ApprovalStatus.PENDING);
      console.log(
        `🔵 [UPDATE] shouldSendImmediately: ${shouldSendImmediately}`,
        {
          reason: isApproverPublishNow
            ? 'Approver publish now'
            : isResubmissionFromRejected
              ? 'Resubmission from rejected - waiting for approver'
              : updatedTemplate.approvalStatus === ApprovalStatus.PENDING
                ? 'PENDING status - waiting for approval'
                : updatedTemplate.sendType === SendType.SEND_NOW &&
                  updatedTemplate.isSent === true
                  ? 'SEND_NOW with isSent=true'
                  : 'Conditions not met',
          approvalStatus: updatedTemplate.approvalStatus,
        }
      );
      if (shouldSendImmediately) {
        console.log(
          `🔵 [UPDATE] ✅ Entering send block - will attempt to send notification`
        );
        console.log(
          `🔵 [UPDATE] Publishing notification (type: ${updatedTemplate.notificationType}) - will send FCM push`
        );
        console.log(
          `🔵 [UPDATE] Template platforms when publishing:`,
          updatedTemplate.platforms,
          `(type: ${typeof updatedTemplate.platforms})`
        );
        const isRetry =
          !updatedTemplate.isSent ||
          (updatedTemplate as any).failedUsers?.length > 0;
        if (isRetry) {
          console.log(
            `🔄 [UPDATE] This appears to be a retry of a previously failed template. Ensuring user data is synced...`
          );
          console.log(
            `🔄 [UPDATE] User sync will happen in sendWithTemplate - ensure mobile app has updated tokens via /send or /inbox API`
          );
        }
        console.log(
          `🔵 [UPDATE] Fetching template with translations for sending...`
        );
        const templateWithTranslations = await this.repo.findOne({
          where: { id: updatedTemplate.id },
          relations: [
            'translations',
            'translations.image',
            'categoryTypeEntity',
          ],
        });
        console.log(`🔵 [UPDATE] Template with translations:`, {
          id: templateWithTranslations?.id,
          hasTranslations: !!templateWithTranslations?.translations,
          translationsCount:
            templateWithTranslations?.translations?.length || 0,
          approvalStatus: templateWithTranslations?.approvalStatus,
          isSent: templateWithTranslations?.isSent,
        });
        if (templateWithTranslations && templateWithTranslations.translations) {
          console.log(
            `🔵 [UPDATE] ✅ Template has translations, proceeding with send logic`
          );
          const canBypassApproval =
            currentUser?.role === UserRole.ADMINISTRATOR ||
            currentUser?.role === UserRole.APPROVAL;
          if (
            !canBypassApproval &&
            templateWithTranslations.approvalStatus !== ApprovalStatus.APPROVED
          ) {
            throw new BadRequestException(
              new BaseResponseDto({
                responseCode: 1,
                errorCode: ErrorCode.NO_PERMISSION,
                responseMessage: 'Template must be approved before sending',
                data: {
                  approvalStatus: templateWithTranslations.approvalStatus,
                  templateId: templateWithTranslations.id,
                },
              })
            );
          }
          console.log(`🔵 [UPDATE] Checking auto-approval conditions:`, {
            userRole: currentUser?.role,
            isApproval: currentUser?.role === UserRole.APPROVAL,
            approvalStatus: templateWithTranslations.approvalStatus,
            isPending:
              templateWithTranslations.approvalStatus ===
              ApprovalStatus.PENDING,
            isSent: isSent,
            isApproverPublishNow,
          });
          if (
            currentUser?.role === UserRole.APPROVAL &&
            isSent === true // Only auto-approve when actually sending
          ) {
            console.log(
              `✅ [UPDATE] APPROVAL role auto-approving template ${templateWithTranslations.id} before sending (current status: ${templateWithTranslations.approvalStatus})`
            );
            const approvalUpdate = {
              approvalStatus: ApprovalStatus.APPROVED,
              approvedBy: currentUser?.username,
              approvedAt: new Date(),
            };
            console.log(
              `🔵 [UPDATE] Auto-approval update fields:`,
              approvalUpdate
            );
            const updateResult = await this.repo.update(
              templateWithTranslations.id,
              approvalUpdate
            );
            console.log(
              `🔵 [UPDATE] Auto-approval update result:`,
              updateResult
            );
            console.log(`🔵 [UPDATE] ✅ Auto-approval update completed`);
            const refreshedTemplate = await this.repo.findOne({
              where: { id: templateWithTranslations.id },
              relations: [
                'translations',
                'translations.image',
                'categoryTypeEntity',
              ],
            });
            if (refreshedTemplate) {
              console.log(
                `🔵 [UPDATE] Refreshed template approvalStatus: ${refreshedTemplate.approvalStatus}`
              );
              templateWithTranslations.approvalStatus = ApprovalStatus.APPROVED;
              templateWithTranslations.approvedBy =
                refreshedTemplate.approvedBy;
              templateWithTranslations.approvedAt =
                refreshedTemplate.approvedAt;
              console.log(
                `🔵 [UPDATE] ✅ Template object updated with APPROVED status for sending`
              );
            } else {
              console.error(
                `🔵 [UPDATE] ❌ Failed to refresh template after auto-approval`
              );
            }
          } else {
            console.log(
              `🔵 [UPDATE] ⏭️ Skipping auto-approval (conditions not met)`
            );
          }
          let sendResult: {
            successfulCount: number;
            failedCount: number;
            failedUsers?: string[];
            failedDueToInvalidTokens?: boolean;
          } = { successfulCount: 0, failedCount: 0, failedUsers: [] };
          let noUsersForPlatform = false;
          console.log(
            `🔵 [UPDATE] ========== CALLING sendWithTemplate ==========`
          );
          console.log(`🔵 [UPDATE] Template details for sending:`, {
            id: templateWithTranslations.id,
            approvalStatus: templateWithTranslations.approvalStatus,
            sendType: templateWithTranslations.sendType,
            platforms: templateWithTranslations.platforms,
            bakongPlatform: templateWithTranslations.bakongPlatform,
            translationsCount:
              templateWithTranslations.translations?.length || 0,
          });
          try {
            sendResult = await this.notificationService.sendWithTemplate(
              templateWithTranslations
            );
            console.log(
              `🔵 [UPDATE] ✅ sendWithTemplate completed successfully:`,
              {
                successfulCount: sendResult.successfulCount,
                failedCount: sendResult.failedCount,
                failedUsers: sendResult.failedUsers?.length || 0,
                failedDueToInvalidTokens: sendResult.failedDueToInvalidTokens,
              }
            );
            if (sendResult.failedCount > 0 && sendResult.failedUsers?.length) {
              console.log(
                `⚠️ [UPDATE] Failed to send to ${sendResult.failedCount} user(s):`,
                sendResult.failedUsers
              );
              if (sendResult.failedDueToInvalidTokens) {
                console.log(
                  `⚠️ [UPDATE] Some failures were due to invalid tokens. Users should update tokens via mobile app.`
                );
              }
            }
          } catch (error: any) {
            console.error(`🔵 [UPDATE] ❌ ERROR in sendWithTemplate:`, {
              message: error?.message,
              stack: error?.stack,
              code: error?.code,
              response: error?.response?.data,
            });
            if (
              error?.message &&
              error.message.includes('No users found for')
            ) {
              noUsersForPlatform = true;
              console.log(
                `🔵 [UPDATE] ⚠️ No users found for bakongPlatform - keeping as draft`
              );
            } else {
              console.error(
                `🔵 [UPDATE] ❌ Unexpected error during send - not related to no users`
              );
            }
          }
          if (noUsersForPlatform) {
            await this.repo.update(updatedTemplate.id, {
              isSent: false,
              updatedAt: new Date(),
            });
            console.log(
              `[UPDATE] Template kept as draft due to no users for target platform`
            );
            (updatedTemplate as any).savedAsDraftNoUsers = true;
            const reloadedTemplate = await this.findOneRaw(id);
            (reloadedTemplate as any).savedAsDraftNoUsers = true;
            return this.formatTemplateResponse(reloadedTemplate, req);
          } else if (sendResult.successfulCount > 0 || isApproverPublishNow) {
            const wasApproverAction =
              isApproverPublishNow && sendResult.successfulCount === 0;
            console.log(
              `[UPDATE] ✅ Template ${updatedTemplate.id
              } published successfully - sent to ${sendResult.successfulCount
              } user(s)${sendResult.failedCount > 0
                ? ` (${sendResult.failedCount} failed)`
                : ''
              }${wasApproverAction
                ? ' (Approver published, marking as published)'
                : ''
              }`
            );
            console.log(
              `🔵 [UPDATE] ========== MARKING AS PUBLISHED ==========`
            );
            const publishUpdateFields: any = {
              isSent: true,
              updatedAt: new Date(),
            };
            if (currentUser?.username) {
              publishUpdateFields.publishedBy = currentUser.username;
            }
            if (isApproverPublishNow) {
              publishUpdateFields.approvalStatus = ApprovalStatus.APPROVED;
              publishUpdateFields.approvedBy = currentUser?.username;
              publishUpdateFields.approvedAt = new Date();
              publishUpdateFields.sendType = SendType.SEND_NOW;
              publishUpdateFields.sendSchedule = null;
              console.log(
                `🔵 [UPDATE] ✅ Setting approvalStatus to APPROVED and changing sendType to SEND_NOW for approver publish action on template ${updatedTemplate.id}`
              );
              console.log(
                `🔵 [UPDATE] ✅ Clearing sendSchedule since approver chose to send immediately (not waiting for scheduled time)`
              );
            }
            console.log(
              `🔵 [UPDATE] Publish update fields:`,
              publishUpdateFields
            );
            const publishUpdateResult = await this.repo.update(
              updatedTemplate.id,
              publishUpdateFields
            );
            console.log(
              `🔵 [UPDATE] Publish update result:`,
              publishUpdateResult
            );
            console.log(
              `🔵 [UPDATE] ✅ Template marked as published in database`
            );
            const verifyAfterPublish = await this.repo.findOne({
              where: { id: updatedTemplate.id },
            });
            console.log(`🔵 [UPDATE] Verification after publish update:`, {
              id: verifyAfterPublish?.id,
              isSent: verifyAfterPublish?.isSent,
              approvalStatus: verifyAfterPublish?.approvalStatus,
              approvedBy: verifyAfterPublish?.approvedBy,
              approvedAt: verifyAfterPublish?.approvedAt,
            });
            if (
              isApproverPublishNow &&
              verifyAfterPublish?.approvalStatus !== ApprovalStatus.APPROVED
            ) {
              console.error(
                `🔵 [UPDATE] ❌ approvalStatus not set correctly, forcing update again`
              );
              await this.repo.update(updatedTemplate.id, {
                approvalStatus: ApprovalStatus.APPROVED,
                approvedBy: currentUser?.username,
                approvedAt: new Date(),
              });
              console.log(
                `🔵 [UPDATE] ✅ Forced approvalStatus update completed`
              );
            }
            console.log(
              `[UPDATE] Template published successfully, sent to ${sendResult.successfulCount} users`
            );
            (updatedTemplate as any).successfulCount =
              sendResult.successfulCount;
            (updatedTemplate as any).failedCount = sendResult.failedCount;
            (updatedTemplate as any).failedUsers = sendResult.failedUsers || [];
            (updatedTemplate as any).failedDueToInvalidTokens =
              sendResult.failedDueToInvalidTokens || false;
          } else {
            console.warn(
              `[UPDATE] No notifications were sent (successfulCount = 0, failedCount = ${sendResult.failedCount}) - reverting to draft`
            );
            await this.repo.update(updatedTemplate.id, {
              isSent: false,
              updatedAt: new Date(),
            });
            if (sendResult.failedCount > 0 && sendResult.failedUsers?.length) {
              console.warn(
                `[UPDATE] All ${sendResult.failedCount
                } user(s) failed: ${sendResult.failedUsers.join(
                  ', '
                )}. Users may need to update their FCM tokens via mobile app.`
              );
            } else {
              console.warn(
                `[UPDATE] No matching users found. Check platform filters and ensure users exist for bakongPlatform: ${templateWithTranslations.bakongPlatform || 'ALL'
                }`
              );
            }
            const reloadedTemplate = await this.findOneRaw(id);
            if (sendResult.failedCount > 0) {
              (reloadedTemplate as any).savedAsDraftNoUsers = false;
            } else {
              (reloadedTemplate as any).savedAsDraftNoUsers =
                sendResult.successfulCount === 0 &&
                sendResult.failedCount === 0;
            }
            (reloadedTemplate as any).successfulCount =
              sendResult.successfulCount;
            (reloadedTemplate as any).failedCount = sendResult.failedCount;
            (reloadedTemplate as any).failedUsers =
              sendResult.failedUsers || [];
            (reloadedTemplate as any).failedDueToInvalidTokens =
              sendResult.failedDueToInvalidTokens || false;
            return this.formatTemplateResponse(reloadedTemplate, req);
          }
        }
      }
      const wasSentByApprover =
        currentUser?.role === UserRole.APPROVAL &&
        updatedTemplate.isSent === true &&
        (updatedTemplate as any).successfulCount > 0;
      if (
        updatedTemplate.sendType === SendType.SEND_SCHEDULE &&
        updatedTemplate.sendSchedule &&
        !wasSentByApprover
      ) {
        if (this.schedulerRegistry.doesExist('cron', id.toString())) {
          this.schedulerRegistry.deleteCronJob(id.toString());
        }
        this.addScheduleNotification(updatedTemplate);
      }
      console.log(`🔵 [UPDATE] ========== FINAL TEMPLATE STATE ==========`);
      const finalTemplate = await this.repo.findOne({
        where: { id },
        relations: ['translations', 'translations.image', 'categoryTypeEntity'],
      });
      if (!finalTemplate) {
        console.error(`🔵 [UPDATE] ❌ Failed to load final template`);
        throw new Error(`Template ${id} not found after update`);
      }
      console.log(`🔵 [UPDATE] Final template state from DB:`, {
        id: finalTemplate.id,
        isSent: finalTemplate.isSent,
        approvalStatus: finalTemplate.approvalStatus,
        sendType: finalTemplate.sendType,
        approvedBy: finalTemplate.approvedBy,
        approvedAt: finalTemplate.approvedAt,
        publishedBy: finalTemplate.publishedBy,
      });
      if (
        isApproverPublishNow &&
        finalTemplate.approvalStatus !== ApprovalStatus.APPROVED
      ) {
        console.error(
          `🔵 [UPDATE] ❌ CRITICAL: approvalStatus still not APPROVED in final state (${finalTemplate.approvalStatus}), fixing now`
        );
        await this.repo.update(id, {
          approvalStatus: ApprovalStatus.APPROVED,
          approvedBy: currentUser?.username,
          approvedAt: new Date(),
        });
        const fixedTemplate = await this.repo.findOne({
          where: { id },
          relations: [
            'translations',
            'translations.image',
            'categoryTypeEntity',
          ],
        });
        if (fixedTemplate) {
          console.log(
            `🔵 [UPDATE] ✅ Fixed approvalStatus in final template:`,
            fixedTemplate.approvalStatus
          );
          if ((updatedTemplate as any).savedAsDraftNoUsers) {
            (fixedTemplate as any).savedAsDraftNoUsers = true;
          }
          if ((updatedTemplate as any).successfulCount !== undefined) {
            (fixedTemplate as any).successfulCount = (
              updatedTemplate as any
            ).successfulCount;
            (fixedTemplate as any).failedCount = (
              updatedTemplate as any
            ).failedCount;
            (fixedTemplate as any).failedUsers = (
              updatedTemplate as any
            ).failedUsers;
          }
          console.log(`🔵 [UPDATE] ========== END UPDATE REQUEST ==========\n`);
          return this.formatTemplateResponse(fixedTemplate, req);
        }
      }
      if ((updatedTemplate as any).savedAsDraftNoUsers) {
        (finalTemplate as any).savedAsDraftNoUsers = true;
      }
      if ((updatedTemplate as any).successfulCount !== undefined) {
        (finalTemplate as any).successfulCount = (
          updatedTemplate as any
        ).successfulCount;
        (finalTemplate as any).failedCount = (
          updatedTemplate as any
        ).failedCount;
        (finalTemplate as any).failedUsers = (
          updatedTemplate as any
        ).failedUsers;
        (finalTemplate as any).failedDueToInvalidTokens = (
          updatedTemplate as any
        ).failedDueToInvalidTokens;
      }
      if (
        isApproverPublishNow &&
        (finalTemplate as any).successfulCount === undefined
      ) {
        if (
          finalTemplate.isSent === true &&
          finalTemplate.approvalStatus === ApprovalStatus.APPROVED
        ) {
          (finalTemplate as any).successfulCount = 0; // Will be updated by frontend if needed
          (finalTemplate as any).failedCount = 0;
          (finalTemplate as any).failedUsers = [];
          (finalTemplate as any).failedDueToInvalidTokens = false;
          console.log(
            `🔵 [UPDATE] ⚠️ Approver publish: send results not preserved, setting defaults for response`
          );
        }
      }
      console.log(`🔵 [UPDATE] ========== END UPDATE REQUEST ==========\n`);
      return this.formatTemplateResponse(finalTemplate, req);
    } catch (error) {
      console.error('Error updating template:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      const errorMessage =
        error?.message || error?.toString() || 'Bad Request Exception';
      throw new BadRequestException({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage: errorMessage,
        data: error?.data || null,
      });
    }
  }

  async submitForApproval(id: number, currentUser?: any): Promise<Template> {
    const template = await this.repo.findOne({ where: { id } });
    if (!template) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.RECORD_NOT_FOUND,
          responseMessage: 'Template not found',
        })
      );
    }
    if (template.approvalStatus === ApprovalStatus.PENDING) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.VALIDATION_FAILED,
          responseMessage: 'Notification is already pending approval',
        })
      );
    }
    if (template.approvalStatus === ApprovalStatus.APPROVED) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.VALIDATION_FAILED,
          responseMessage: 'Notification is already published',
        })
      );
    }
    if (template.approvalStatus === ApprovalStatus.EXPIRED) {
      if (template.sendSchedule) {
        const scheduleDate = new Date(template.sendSchedule);
        const nowUTC = new Date();
        if (scheduleDate.getTime() <= nowUTC.getTime()) {
          const scheduleDateObj = new Date(template.sendSchedule);
          const datePart = scheduleDateObj.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Phnom_Penh',
          });
          const timePart = scheduleDateObj.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Phnom_Penh',
          });
          const scheduleTimeDisplay = `${datePart} at ${timePart}`;
          this.logger.warn(
            `⏰ [SUBMIT] Blocking submission of expired template ${id}: scheduled time ${template.sendSchedule} has passed`
          );
          throw new BadRequestException(
            new BaseResponseDto({
              responseCode: 1,
              errorCode: ErrorCode.VALIDATION_FAILED,
              responseMessage: `The request was not approved in time, and the scheduled time <strong>${scheduleTimeDisplay}</strong> has already passed. Please update the schedule and resubmit.`,
              data: {
                scheduleTimeDisplay: scheduleTimeDisplay,
              },
            })
          );
        }
      } else {
        this.logger.warn(
          `⏰ [SUBMIT] Blocking submission of expired template ${id} (no sendSchedule)`
        );
        throw new BadRequestException(
          new BaseResponseDto({
            responseCode: 1,
            errorCode: ErrorCode.VALIDATION_FAILED,
            responseMessage:
              'This template has expired. Please update the schedule time before resubmitting.',
          })
        );
      }
    }
    console.log(
      `🔵 [SUBMIT] Validating users for platform before allowing submission...`
    );
    const hasMatchingUsers = await this.validateMatchingUsers(template);
    if (!hasMatchingUsers) {
      const platformInfo = `OS platform: ${template.platforms?.join(', ') || 'ALL'
        }, Bakong platform: ${template.bakongPlatform}`;
      const platformName =
        template.bakongPlatform === 'BAKONG_TOURIST'
          ? 'Bakong Tourist'
          : template.bakongPlatform === 'BAKONG_JUNIOR'
            ? 'Bakong Junior'
            : 'Bakong';
      const osPlatforms =
        template.platforms?.filter((p) => p !== 'ALL').join(', ') || 'ALL';
      const errorMessage = `No users found for Using ${osPlatforms} on ${platformName} app.`;
      this.logger.error(
        `❌ [SUBMIT] No users match platform requirements (${platformInfo}). Preventing submission, keeping template in draft.`
      );
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
          responseMessage: errorMessage,
        })
      );
    }
    console.log(`🔵 [SUBMIT] ✅ Users validated - submission can proceed`);
    await this.repo.update(id, {
      approvalStatus: ApprovalStatus.PENDING,
      updatedBy: currentUser?.username,
      reasonForRejection: null, // Clear any previous rejection reason
    });
    return await this.findOneRaw(id);
  }

  async approve(id: number, currentUser?: any): Promise<Template> {
    const template = await this.repo.findOne({ where: { id } });
    if (!template) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.RECORD_NOT_FOUND,
          responseMessage: 'Template not found',
        })
      );
    }
    if (template.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.VALIDATION_FAILED,
          responseMessage: `Cannot approve notification with status: ${template.approvalStatus}. Only PENDING notifications can be approved.`,
        })
      );
    }
    const wasPending = template.approvalStatus === ApprovalStatus.PENDING;
    const originalIsSent = template.isSent;
    if (template.sendSchedule && template.sendType === SendType.SEND_SCHEDULE) {
      const scheduledTime = moment.utc(template.sendSchedule);
      const now = moment.utc();
      this.logger.log(
        `⏰ [APPROVE] Checking scheduled time for template ${id}:`,
        {
          scheduledTimeUTC: scheduledTime.toISOString(),
          scheduledTimeCambodia: scheduledTime
            .clone()
            .utcOffset(7)
            .format('YYYY-MM-DD HH:mm:ss'),
          currentTimeUTC: now.toISOString(),
          currentTimeCambodia: now
            .clone()
            .utcOffset(7)
            .format('YYYY-MM-DD HH:mm:ss'),
          timeDifferenceMinutes: scheduledTime.diff(now, 'minutes'),
          hasPassed: scheduledTime.isBefore(now.clone().subtract(1, 'minute')),
        }
      );
      if (scheduledTime.isBefore(now.clone().subtract(1, 'minute'))) {
        this.logger.warn(
          `⏰ [APPROVE] Template ${id} scheduled time ${scheduledTime.toISOString()} (${scheduledTime
            .clone()
            .utcOffset(7)
            .format(
              'YYYY-MM-DD HH:mm:ss'
            )} Cambodia) has passed (current: ${now.toISOString()} / ${now
              .clone()
              .utcOffset(7)
              .format('YYYY-MM-DD HH:mm:ss')} Cambodia). Marking as expired.`
        );
        const expiredReason =
          'Scheduled time has passed. Please contact team member to update the schedule first.';
        const templateToExpire = await this.repo.findOne({ where: { id } });
        if (!templateToExpire) {
          throw new BadRequestException(
            new BaseResponseDto({
              responseCode: 1,
              errorCode: ErrorCode.TEMPLATE_NOT_FOUND,
              responseMessage: ResponseMessage.TEMPLATE_NOT_FOUND,
            })
          );
        }
        templateToExpire.approvalStatus = 'EXPIRED' as ApprovalStatus;
        templateToExpire.approvedBy = currentUser?.username;
        templateToExpire.approvedAt = new Date();
        templateToExpire.reasonForRejection = expiredReason;
        await this.repo.save(templateToExpire);
        this.logger.log(
          `✅ [APPROVE] Template ${id} marked as expired due to passed scheduled time (data preserved)`
        );
        throw new BadRequestException(
          new BaseResponseDto({
            responseCode: 1,
            errorCode: ErrorCode.VALIDATION_FAILED,
            responseMessage: expiredReason,
            data: {
              autoExpired: true,
              expiredReason: expiredReason,
            },
          })
        );
      } else {
        this.logger.log(
          `✅ [APPROVE] Template ${id} scheduled time is valid (not passed yet)`
        );
      }
    }
    await this.repo.update(id, {
      approvalStatus: ApprovalStatus.APPROVED,
      approvedBy: currentUser?.username,
      approvedAt: new Date(),
    });
    const updatedTemplate = await this.findOneRaw(id);
    const isScheduledNotification =
      updatedTemplate.sendSchedule !== null &&
      updatedTemplate.sendSchedule !== undefined &&
      updatedTemplate.sendType === SendType.SEND_SCHEDULE;
    this.logger.log(`🔍 [APPROVE] Template ${id} check:`, {
      sendSchedule: updatedTemplate.sendSchedule,
      sendType: updatedTemplate.sendType,
      isSent: updatedTemplate.isSent,
      isScheduledNotification,
      approvalStatus: updatedTemplate.approvalStatus,
    });
    if (isScheduledNotification) {
      this.logger.log(
        `📅 [APPROVE] Template ${id} is scheduled for ${updatedTemplate.sendSchedule.toISOString()} - keeping in Scheduled tab until scheduled time`
      );
      await this.repo.update(id, { isSent: false });
      const templateForScheduler = await this.findOneRaw(id);
      this.addScheduleNotification(templateForScheduler);
      this.logger.log(
        `✅ [APPROVE] Scheduled notification job registered for template ${id} - will auto-send at scheduled time`
      );
    } else if (
      updatedTemplate.sendType === SendType.SEND_NOW &&
      !updatedTemplate.sendSchedule
    ) {
      this.logger.log(
        `📤 [APPROVE] Template ${id} is SEND_NOW - checking if needs to send:`,
        {
          wasPending,
          originalIsSent,
          currentIsSent: updatedTemplate.isSent,
          willSend: wasPending || !updatedTemplate.isSent,
        }
      );
      if (wasPending || !updatedTemplate.isSent) {
        this.logger.log(
          `📤 [APPROVE] Template ${id} is ready to send after approval - sending automatically`
        );
        this.logger.log(
          `📤 [APPROVE] Template ${id} platform info: OS platforms: ${updatedTemplate.platforms?.join(', ') || 'ALL'
          }, Bakong platform: ${updatedTemplate.bakongPlatform}`
        );
        try {
          const sendResult = await this.notificationService.sendWithTemplate(
            updatedTemplate
          );
          this.logger.log(
            `📤 [APPROVE] Template ${id} send result: successfulCount: ${sendResult.successfulCount}, failedCount: ${sendResult.failedCount}`
          );
          if (sendResult.successfulCount === 0) {
            const platformInfo = `OS platform: ${updatedTemplate.platforms?.join(', ') || 'ALL'
              }, Bakong platform: ${updatedTemplate.bakongPlatform}`;
            const rejectionReason =
              sendResult.failedCount === 0
                ? `No users found matching the platform requirements (${platformInfo}). Please ensure there are registered users for the specified platforms before approving.`
                : `No users received the notification. ${sendResult.failedCount} user(s) matched the platform requirements but all failed (likely invalid tokens). Please ensure there are registered users with valid tokens for the specified platforms before approving.`;
            if (sendResult.failedCount === 0) {
              this.logger.error(
                `❌ [APPROVE] Failed to send template ${id} - no users match platform requirements (${platformInfo}). Rejecting template.`
              );
            } else {
              this.logger.error(
                `❌ [APPROVE] Failed to send template ${id} - ${sendResult.failedCount} user(s) matched but all failed. No users received the notification. Rejecting template.`
              );
            }
            await this.repo.update(id, {
              approvalStatus: ApprovalStatus.REJECTED,
              isSent: false,
              approvedBy: null,
              approvedAt: null,
              reasonForRejection: rejectionReason,
            });
            throw new BadRequestException(
              new BaseResponseDto({
                responseCode: 1,
                errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
                responseMessage: rejectionReason,
              })
            );
          }
          await this.repo.update(id, { isSent: true });
          this.logger.log(
            `✅ [APPROVE] Template ${id} sent and published successfully to ${sendResult.successfulCount} user(s)`
          );
        } catch (error: any) {
          const errorResponse = error?.response || error;
          const errorCode = errorResponse?.errorCode;
          const errorMessage =
            errorResponse?.responseMessage || error?.message || String(error);
          const isNoUsersError =
            errorCode === ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM ||
            errorMessage.includes(
              'No users found matching the platform requirements'
            ) ||
            errorMessage.includes('No users found for') ||
            errorMessage.includes('no users found') ||
            errorMessage.includes('No users match');
          if (isNoUsersError) {
            const rejectionReason =
              errorResponse?.responseMessage ||
              errorMessage ||
              'No users found for the specified platform. Please ensure there are registered users for this platform before approving.';
            this.logger.error(
              `❌ [APPROVE] Failed to send template ${id} - no users found for platform. Rejecting template.`
            );
            await this.repo.update(id, {
              approvalStatus: ApprovalStatus.REJECTED,
              isSent: false,
              approvedBy: null,
              approvedAt: null,
              reasonForRejection: rejectionReason,
            });
            throw new BadRequestException(
              new BaseResponseDto({
                responseCode: 1,
                errorCode: ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM,
                responseMessage: rejectionReason,
              })
            );
          } else {
            this.logger.error(
              `❌ [APPROVE] Failed to send template ${id} after approval:`,
              error
            );
            throw error;
          }
        }
      } else {
        this.logger.log(
          `✅ [APPROVE] Template ${id} was already sent (not pending), keeping published status`
        );
        await this.repo.update(id, { isSent: true });
      }
    } else if (
      updatedTemplate.isSent === true &&
      updatedTemplate.sendType !== SendType.SEND_SCHEDULE
    ) {
      this.logger.log(
        `✅ [APPROVE] Template ${id} was already sent, keeping published status`
      );
    } else if (updatedTemplate.sendType !== SendType.SEND_SCHEDULE) {
      this.logger.log(
        `✅ [APPROVE] Template ${id} marking as sent (non-scheduled notification)`
      );
      await this.repo.update(id, { isSent: true });
    } else {
      this.logger.warn(
        `⚠️ [APPROVE] Template ${id} is scheduled but isSent is true - this shouldn't happen`
      );
    }
    return await this.findOneRaw(id);
  }

  async reject(
    id: number,
    dto: RejectTemplateDto,
    currentUser?: any
  ): Promise<Template> {
    const template = await this.repo.findOne({ where: { id } });
    if (!template) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.RECORD_NOT_FOUND,
          responseMessage: 'Template not found',
        })
      );
    }
    if (template.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.VALIDATION_FAILED,
          responseMessage: `Cannot reject notification with status: ${template.approvalStatus}. Only PENDING notifications can be rejected.`,
        })
      );
    }
    await this.repo.update(id, {
      approvalStatus: ApprovalStatus.REJECTED,
      approvedBy: currentUser?.username,
      approvedAt: new Date(),
      reasonForRejection: dto.reasonForRejection,
    });
    return await this.findOneRaw(id);
  }

  async editPublishedNotification(
    id: number,
    dto: UpdateTemplateDto,
    currentUser?: any,
    req?: any
  ) {
    const oldTemplate = await this.findOneRaw(id);
    try {
      const isEditingPublished = oldTemplate.isSent === true;
      const updateFields: any = {};
      if (dto.platforms !== undefined) {
        updateFields.platforms = ValidationHelper.parsePlatforms(dto.platforms);
      }
      if (dto.bakongPlatform !== undefined) {
        updateFields.bakongPlatform = dto.bakongPlatform;
      }
      if (isEditingPublished) {
        updateFields.sendType = dto.sendType ?? SendType.SEND_NOW;
        updateFields.isSent = true;
        updateFields.sendInterval = null; // Clear any interval to keep in published tab
      } else {
        if (dto.sendType !== undefined) updateFields.sendType = dto.sendType;
        if (dto.isSent !== undefined) updateFields.isSent = dto.isSent;
      }

      if (dto.sendSchedule !== undefined) {
        if (dto.sendSchedule) {
          const scheduledTime = moment.utc(dto.sendSchedule);
          if (!scheduledTime.isValid()) {
            throw new BadRequestException({
              responseCode: 1,
              errorCode: ErrorCode.VALIDATION_FAILED,
              responseMessage: 'Invalid sendSchedule date format',
              data: {
                providedDate: dto.sendSchedule,
                expectedFormat: 'ISO 8601 format (e.g., 2025-10-06T09:30:00)',
              },
            });
          }

          // Suppress past date validation if already published
          if (!isEditingPublished) {
            const now = moment.utc();
            if (scheduledTime.isBefore(now.clone().subtract(1, 'minute'))) {
              throw new BadRequestException(
                new BaseResponseDto({
                  responseCode: 1,
                  errorCode: ErrorCode.TEMPLATE_SEND_SCHEDULE_IN_PAST,
                  responseMessage:
                    ResponseMessage.TEMPLATE_SEND_SCHEDULE_IN_PAST,
                  data: {
                    scheduledTime: scheduledTime.format('h:mm A MMM D, YYYY'),
                    currentTime: now.format('h:mm A MMM D, YYYY'),
                  },
                })
              );
            }
          }
          updateFields.sendSchedule = scheduledTime.toDate();
        } else {
          updateFields.sendSchedule = null;
        }
      }
      if (dto.notificationType !== undefined) {
        updateFields.notificationType = dto.notificationType;
      }
      if (dto.categoryTypeId !== undefined) {
        updateFields.categoryTypeId = dto.categoryTypeId;
      }
      if (currentUser?.username) {
        updateFields.updatedBy = currentUser.username;
      }
      updateFields.updatedAt = new Date();
      if (Object.keys(updateFields).length > 0) {
        await this.repo.update(id, updateFields);
      }
      if (dto.translations && dto.translations.length > 0) {
        // --- Translation deletion logic ---
        const translationsToDelete = [];
        for (const translation of dto.translations) {
          const existingTranslation = await this.translationRepo.findOne({
            where: {
              templateId: id,
              language: translation.language,
            },
          });
          const allEmpty =
            (!translation.title || String(translation.title).trim() === '') &&
            (!translation.content || String(translation.content).trim() === '') &&
            (!translation.image || String(translation.image).trim() === '') &&
            (!translation.linkPreview || String(translation.linkPreview).trim() === '');
          if (allEmpty && existingTranslation) {
            console.log(
              `🗑️ [editPublishedNotification] Translation for template ${id}, language ${translation.language} is empty and exists in DB. Deleting it.`
            );
            await this.translationRepo.delete({ id: existingTranslation.id });
            translationsToDelete.push(translation.language);
          }
        }

        // Remove deleted translations from the local array so they aren't re-saved below
        const filteredTranslations = dto.translations.filter(
          (t) => !translationsToDelete.includes(t.language)
        );

        for (const translation of filteredTranslations) {
          const {
            language,
            title,
            content,
            image,
            linkPreview,
            id: translationId,
          } = translation;
          const titleValue =
            title !== undefined && title !== null ? String(title) : '';
          const contentValue =
            content !== undefined && content !== null ? String(content) : '';
          let existingTranslation = null;
          if (translationId) {
            existingTranslation = await this.translationRepo.findOne({
              where: { id: translationId, templateId: id },
            });
            if (!existingTranslation) {
              this.logger.warn(
                `⚠️ [editPublishedNotification] Translation ID ${translationId} not found for template ${id}, falling back to language matching`
              );
            }
          }
          if (!existingTranslation) {
            existingTranslation = await this.translationRepo.findOneBy({
              templateId: id,
              language: language,
            });
          }
          let imageId = null;
          if (translation.image !== undefined) {
            if (image && String(image).trim() !== '') {
              const imageExists = await this.imageService.validateImageExists(
                image
              );
              if (imageExists) {
                imageId = image;
              }
            } else {
              imageId = null;
            }
          } else if (existingTranslation) {
            imageId = existingTranslation.imageId;
          }
          if (existingTranslation) {
            await this.translationRepo.update(existingTranslation.id, {
              title: titleValue,
              content: contentValue,
              imageId: imageId,
              linkPreview: linkPreview,
              updatedAt: new Date(),
            });
          } else {
            await this.translationRepo.save({
              templateId: id,
              language: translation.language,
              title: titleValue,
              content: contentValue,
              imageId: imageId,
              linkPreview: translation.linkPreview,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }
      if (isEditingPublished) {
        console.log(
          `📝 [editPublishedNotification] Editing published notification - updating data without resending FCM`
        );
        console.log(
          `✅ [editPublishedNotification] Template ${id} updated and marked as published (no FCM resend, kept in published tab)`
        );
        const templateToReturn = await this.findOneRaw(id);
        return this.formatTemplateResponse(templateToReturn, req);
      } else {
        const updatedTemplate = await this.findOneRaw(id);
        const isApproverPublishingScheduled =
          currentUser?.role === UserRole.APPROVAL &&
          oldTemplate.approvalStatus === ApprovalStatus.APPROVED &&
          oldTemplate.sendType === SendType.SEND_SCHEDULE &&
          oldTemplate.isSent === false &&
          dto.isSent === true; // Approver clicked "Publish Now"
        const isConvertingToImmediateSend =
          (updatedTemplate.sendType === SendType.SEND_NOW &&
            updatedTemplate.isSent === true &&
            oldTemplate.isSent === false) || // Was not sent before
          isApproverPublishingScheduled; // OR approver publishing scheduled template
        if (isConvertingToImmediateSend) {
          if (isApproverPublishingScheduled) {
            console.log(
              `🚀 [editPublishedNotification] Approver clicking "Publish Now" on APPROVED scheduled template ${id} - sending immediately`
            );
          } else {
            console.log(
              `🚀 [editPublishedNotification] Converting scheduled notification ${id} to immediate send - sending now`
            );
          }
          const templateWithTranslations = await this.repo.findOne({
            where: { id },
            relations: [
              'translations',
              'translations.image',
              'categoryTypeEntity',
            ],
          });
          if (
            templateWithTranslations &&
            templateWithTranslations.translations
          ) {
            try {
              const sendResult =
                await this.notificationService.sendWithTemplate(
                  templateWithTranslations
                );
              if (sendResult && sendResult.successfulCount > 0) {
                if (isApproverPublishingScheduled) {
                  await this.repo.update(id, {
                    sendType: SendType.SEND_NOW,
                    sendSchedule: null,
                    isSent: true,
                    publishedBy: currentUser?.username,
                    updatedAt: new Date(),
                  });
                  console.log(
                    `✅ [editPublishedNotification] Template ${id} sent immediately and changed to SEND_NOW (schedule cleared)`
                  );
                } else {
                  await this.markAsPublished(id);
                }
                console.log(
                  `✅ [editPublishedNotification] Template ${id} sent immediately to ${sendResult.successfulCount
                  } user(s)${sendResult.failedCount > 0
                    ? ` (${sendResult.failedCount} failed)`
                    : ''
                  }`
                );
              } else {
                console.log(
                  `⚠️ [editPublishedNotification] Template ${id} updated but no notifications sent`
                );
              }
            } catch (error) {
              console.error(
                `❌ [editPublishedNotification] Failed to send template ${id} immediately:`,
                error
              );
            }
          } else {
            console.error(
              `❌ [editPublishedNotification] Template ${id} has no translations, cannot send`
            );
          }
        } else if (
          updatedTemplate.sendType === 'SEND_SCHEDULE' &&
          updatedTemplate.sendSchedule
        ) {
          console.log(
            `Scheduling updated notification for template ${id} at ${updatedTemplate.sendSchedule}`
          );
          if (updatedTemplate.isSent === true) {
            const hasMatchingUsers = await this.validateMatchingUsers(
              updatedTemplate
            );
            if (!hasMatchingUsers) {
              console.log(
                `🔵 [EDIT PUBLISHED] ⚠️ No matching users found for scheduled notification - keeping as draft`
              );
              await this.repo.update(id, {
                isSent: false,
                updatedAt: new Date(),
              });
              console.log('✅ Template kept as draft due to no matching users');
            }
          }
          this.addScheduleNotification(updatedTemplate);
        } else if (
          updatedTemplate.sendType === 'SEND_INTERVAL' &&
          updatedTemplate.sendInterval
        ) {
          console.log(
            `Scheduling updated notification with interval for template ${id}`
          );
          this.addIntervalNotification(updatedTemplate);
        }
        console.log(`📝 [editPublishedNotification] Template ${id} updated`);
        const templateToReturn = await this.findOneRaw(id);
        return this.formatTemplateResponse(templateToReturn, req);
      }
    } catch (error) {
      console.error('Error editing published notification:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      if (error instanceof BaseResponseDto) {
        throw new BadRequestException(error);
      }
      const errorMessage =
        error?.message || error?.toString() || 'Bad Request Exception';
      throw new BadRequestException({
        responseCode: 1,
        errorCode: ErrorCode.VALIDATION_FAILED,
        responseMessage: errorMessage,
        data: error?.data || null,
      });
    }
  }

  async remove(id: number, req?: any) {
    const template = await this.findOneRaw(id);
    this.validateModificationTemplate(template, true);
    if (template.isSent) {
      await this.notificationService.deleteNotificationsByTemplateId(id);
    }
    await this.repo.delete(id);
    return this.formatTemplateResponse(template, req);
  }

  async forceDeleteTemplate(id: number) {
    const template = await this.findOneRaw(id);
    if (template.isSent) {
      await this.notificationService.deleteNotificationsByTemplateId(id);
    }
    await this.repo.delete(id);
    return this.formatTemplateResponse(template);
  }

  all(language?: string, req?: any) {
    const defaultLanguage = language || 'KM';
    const templates = this.repo
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.translations', 'translation')
      .leftJoinAndSelect('translation.image', 'image')
      .where('translation.language = :language', { language: defaultLanguage })
      .addOrderBy('template.sendSchedule', 'DESC')
      .addOrderBy('template.updatedAt', 'DESC')
      .addOrderBy('template.createdAt', 'DESC')
      .getMany();
    return templates.then((items) => {
      items.sort((a, b) => {
        const dateA =
          a.isSent && a.updatedAt
            ? a.updatedAt
            : a.sendSchedule || a.updatedAt || a.createdAt;
        const dateB =
          b.isSent && b.updatedAt
            ? b.updatedAt
            : b.sendSchedule || b.updatedAt || b.createdAt;
        return dateB.getTime() - dateA.getTime();
      });
      return items.map((item) => this.formatTemplateResponse(item, req));
    });
  }

  async findTemplates(
    page?: number,
    size?: number,
    isAscending?: boolean,
    language?: string,
    req?: any
  ) {
    const { skip, take } = PaginationUtils.normalizePagination(
      page || 1,
      size || 12
    );
    const defaultLanguage = language || 'KM';
    const queryBuilder = this.repo
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.translations', 'translation')
      .leftJoinAndSelect('translation.image', 'image')
      .where('translation.language = :language', { language: defaultLanguage });
    const [allItems, total] = await queryBuilder.getManyAndCount();
    allItems.sort((a, b) => {
      const dateA =
        a.isSent && a.updatedAt
          ? a.updatedAt
          : a.sendSchedule || a.updatedAt || a.createdAt;
      const dateB =
        b.isSent && b.updatedAt
          ? b.updatedAt
          : b.sendSchedule || b.updatedAt || b.createdAt;
      return dateB.getTime() - dateA.getTime();
    });
    const items = allItems.slice(skip, skip + take);
    const formattedItems = items.map((item) =>
      this.formatTemplateResponse(item, req)
    );
    const paginationMeta = PaginationUtils.calculatePaginationMeta(
      page || 1,
      size || 12,
      total,
      items.length
    );
    return {
      responseCode: 0,
      errorCode: ErrorCode.REQUEST_SUCCESS,
      responseMessage: ResponseMessage.REQUEST_SUCCESS,
      data: formattedItems,
      meta: paginationMeta,
    };
  }

  async findTemplatesAsNotifications(
    page?: number,
    size?: number,
    _isAscending?: boolean,
    _language?: string,
    req?: any
  ) {
    try {
      const { skip, take } = PaginationUtils.normalizePagination(
        page || 1,
        size || 100
      );
      const queryBuilder = this.repo
        .createQueryBuilder('template')
        .leftJoinAndSelect('template.translations', 'translation')
        .leftJoinAndSelect('translation.image', 'image');
      const [items, total] = await queryBuilder.getManyAndCount();
      items.sort((a, b) => {
        const dateA =
          a.isSent && a.updatedAt
            ? a.updatedAt
            : a.sendSchedule || a.updatedAt || a.createdAt;
        const dateB =
          b.isSent && b.updatedAt
            ? b.updatedAt
            : b.sendSchedule || b.updatedAt || b.createdAt;
        return dateB.getTime() - dateA.getTime();
      });
      const paginatedItems = items.slice(skip, skip + take);
      const usernames = new Set<string>();
      paginatedItems.forEach((template) => {
        if (template.publishedBy) usernames.add(template.publishedBy);
        if (template.updatedBy) usernames.add(template.updatedBy);
        if (template.createdBy) usernames.add(template.createdBy);
      });
      const displayNameMap = new Map<string, string>();
      if (usernames.size > 0) {
        const usernameArray = Array.from(usernames);
        const users = await this.userRepo.find({
          where: { username: In(usernameArray) },
          select: ['username', 'displayName'],
        });
        users.forEach((user) => {
          displayNameMap.set(user.username, user.displayName);
        });
      }
      const notifications = paginatedItems
        .map((template) => {
          const sortedTranslations = template.translations?.sort((a, b) => {
            const priority = { KM: 1, EN: 2, JP: 3 };
            return (
              (priority[a.language] || 999) - (priority[b.language] || 999)
            );
          });
          if (sortedTranslations && sortedTranslations.length > 0) {
            template.translations = [sortedTranslations[0]];
          }
          if (
            template.translations?.[0]?.image &&
            'file' in template.translations[0].image
          ) {
            delete (template.translations[0].image as any).file;
          }
          return this.formatTemplateAsNotification(template, displayNameMap);
        })
        .filter((notification) => notification !== null);
      const paginationMeta = PaginationUtils.calculatePaginationMeta(
        page || 1,
        size || 100,
        total,
        paginatedItems.length
      );
      return {
        responseCode: 0,
        errorCode: ErrorCode.REQUEST_SUCCESS,
        responseMessage: ResponseMessage.REQUEST_SUCCESS,
        data: notifications,
        meta: paginationMeta,
      };
    } catch (error: any) {
      console.error(
        '❌ [TEMPLATE SERVICE] Error in findTemplatesAsNotifications:',
        {
          message: error?.message,
          stack: error?.stack,
          name: error?.name,
          code: error?.code,
        }
      );
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
          responseMessage: error?.message || 'Failed to fetch templates',
          data: {
            error: error?.message,
            context: 'findTemplatesAsNotifications',
          },
        })
      );
    }
  }

  async findOne(id: number, req?: any) {
    const template = await this.repo.findOne({
      where: { id },
      relations: ['translations', 'translations.image'],
    });
    if (!template) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.RECORD_NOT_FOUND,
          responseMessage: ResponseMessage.RECORD_NOT_FOUND + id,
        })
      );
    }
    return this.formatTemplateResponse(template, req);
  }

  async findOneRaw(id: number) {
    const template = await this.repo
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.translations', 'translations')
      .leftJoinAndSelect('translations.image', 'image')
      .where('template.id = :id', { id })
      .getOne();
    if (!template) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.RECORD_NOT_FOUND,
          responseMessage: ResponseMessage.RECORD_NOT_FOUND + id,
        })
      );
    }
    return template;
  }

  private formatTemplateResponse(template: Template, req?: any) {
    const parsedPlatforms = ValidationHelper.parsePlatforms(template.platforms);
    const baseUrl = this.baseFunctionHelper
      ? this.baseFunctionHelper.getBaseUrl(req)
      : 'http://localhost:4005';
    const isV2 =
      (req as any)?.version === '2' ||
      req?.url?.includes('/v2/') ||
      req?.originalUrl?.includes('/v2/');
    const categoryIcon =
      isV2 && template.categoryTypeId
        ? `${baseUrl}/api/v2/category-type/${template.categoryTypeId}/icon`
        : undefined;
    const language = (req?.query?.language ||
      req?.body?.language ||
      'EN') as Language;
    const formattedTemplate: any = {
      templateId: template.id,
      platforms: parsedPlatforms, // Always return as array for frontend
      bakongPlatform: template.bakongPlatform,
      sendType: template.sendType,
      notificationType: template.notificationType,
      categoryType: isV2
        ? InboxResponseDto.getCategoryDisplayName(
          template.categoryTypeEntity,
          language
        ) || 'Other'
        : template.categoryTypeEntity?.name,
      categoryTypeId: template.categoryTypeId,
      categoryIcon: categoryIcon,
      priority: template.priority,
      sendInterval: template.sendInterval
        ? {
          cron: template.sendInterval.cron,
          startAt: moment(template.sendInterval.startAt).toISOString(),
          endAt: moment(template.sendInterval.endAt).toISOString(),
        }
        : null,
      isSent: template.isSent,
      sendSchedule: template.sendSchedule
        ? moment(template.sendSchedule).toISOString()
        : null,
      createdAt: moment(template.createdAt).toISOString(),
      updatedAt: template.updatedAt
        ? moment(template.updatedAt).toISOString()
        : null,
      deletedAt: template.deletedAt
        ? moment(template.deletedAt).toISOString()
        : null,
      approvalStatus: template.approvalStatus,
      approvedBy: template.approvedBy,
      approvedAt: template.approvedAt
        ? moment(template.approvedAt).toISOString()
        : null,
      reasonForRejection: template.reasonForRejection || null,
      successfulCount: (template as any).successfulCount,
      failedCount: (template as any).failedCount,
      failedUsers: (template as any).failedUsers,
      failedDueToInvalidTokens: (template as any).failedDueToInvalidTokens,
      failedUserDetails: (template as any).failedUserDetails, // Include detailed error info for debugging
      savedAsDraftNoUsers:
        (template as any).savedAsDraftNoUsers === true &&
        ((template as any).failedCount === undefined ||
          (template as any).failedCount === 0),
      translations: template.translations
        ? template.translations.map((translation) => ({
          id: translation.id,
          language: translation.language,
          title: translation.title,
          content: translation.content,
          linkPreview: translation.linkPreview,
          image: translation.image
            ? {
              fileId: translation.image.fileId,
              mimeType: translation.image.mimeType
                ? translation.image.mimeType.substring(0, 100)
                : null,
              originalFileName: translation.image.originalFileName
                ? translation.image.originalFileName.substring(0, 100)
                : null,
            }
            : translation.imageId
              ? {
                fileId: translation.imageId,
                mimeType: null,
                originalFileName: null,
              }
              : null,
        }))
        : [],
    };
    if (
      (template as any).savedAsDraftNoUsers === true &&
      ((template as any).failedCount === undefined ||
        (template as any).failedCount === 0)
    ) {
      formattedTemplate.savedAsDraftNoUsers = true;
    } else {
      formattedTemplate.savedAsDraftNoUsers = false;
    }
    if ((template as any).successfulCount !== undefined) {
      formattedTemplate.successfulCount = (template as any).successfulCount;
      formattedTemplate.failedCount = (template as any).failedCount;
      formattedTemplate.failedUsers = (template as any).failedUsers || [];
      formattedTemplate.failedDueToInvalidTokens =
        (template as any).failedDueToInvalidTokens || false;
      formattedTemplate.failedUserDetails =
        (template as any).failedUserDetails || []; // Include detailed error info for debugging
    }
    return formattedTemplate;
  }

  private formatTemplateAsNotification(
    template: Template,
    displayNameMap?: Map<string, string>
  ) {
    const translation = template.translations?.[0];
    if (!translation) {
      return null;
    }
    let status: string;
    if (template.isSent) {
      status = 'published';
    } else if (
      (template.sendType === 'SEND_SCHEDULE' ||
        template.sendType === 'SEND_INTERVAL') &&
      template.approvalStatus === ApprovalStatus.APPROVED
    ) {
      status = 'scheduled';
    } else {
      status = 'draft';
    }
    const username =
      template.publishedBy ||
      template.updatedBy ||
      template.createdBy ||
      'System';
    const author = displayNameMap?.get(username) || username;
    let dateToShow: Date;
    if (template.sendSchedule) {
      dateToShow = template.sendSchedule;
    } else if (template.isSent && template.updatedAt) {
      dateToShow = template.updatedAt;
    } else {
      dateToShow = template.createdAt;
    }
    const datePart = dateToShow.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Phnom_Penh',
    });
    const isDraftWithoutSchedule = status === 'draft' && !template.sendSchedule;
    const date = isDraftWithoutSchedule
      ? datePart
      : `${datePart} | ${dateToShow.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Phnom_Penh',
      })}`;
    const platforms = ValidationHelper.parsePlatforms(template.platforms);
    return {
      id: template.id,
      author: author,
      language: translation.language,
      title: translation.title,
      content: translation.content,
      image: translation.imageId ? `/api/v1/image/${translation.imageId}` : '',
      linkPreview: translation.linkPreview,
      date: date,
      status: status,
      type: template.notificationType,
      createdAt: template.createdAt,
      templateId: template.id,
      isSent: template.isSent,
      sendType: template.sendType,
      updatedAt: template.updatedAt,
      scheduledTime: template.sendSchedule
        ? (() => {
          const scheduleDate =
            template.sendSchedule instanceof Date
              ? template.sendSchedule
              : new Date(template.sendSchedule);
          const utcISOString = scheduleDate.toISOString();
          return TimezoneUtils.formatCambodiaTime(utcISOString);
        })()
        : null,
      platforms: platforms,
      bakongPlatform: template.bakongPlatform || null,
      approvalStatus: template.approvalStatus,
      approvedBy: template.approvedBy,
      approvedAt: template.approvedAt,
    };
  }

  validateModificationTemplate(template: Template, allowDelete = false) {
    if (
      template.isSent &&
      template.approvalStatus === ApprovalStatus.APPROVED &&
      !allowDelete
    ) {
      throw new BadRequestException(
        new BaseResponseDto({
          responseCode: 1,
          errorCode: ErrorCode.SENT_TEMPLATE,
          responseMessage: ResponseMessage.SENT_TEMPLATE,
        })
      );
    }
  }

  async pickPendingSchedule() {
    const pendingTemplate = await this.repo
      .createQueryBuilder('template')
      .where('template.isSent = :isSent', { isSent: false })
      .andWhere('template.sendSchedule >= :now', {
        now: moment().utc().toDate(),
      })
      .select([
        'template.id',
        'template.sendType',
        'template.isSent',
        'template.sendSchedule',
      ])
      .getMany();

    if (pendingTemplate && pendingTemplate.length > 0) {
      for (const template of pendingTemplate) {
        switch (template.sendType) {
          case SendType.SEND_SCHEDULE:
            this.addScheduleNotification(template);
            break;
          case SendType.SEND_INTERVAL:
            this.addIntervalNotification(template);
            break;
        }
      }
    }
  }

  /**
   * Validate if there are matching users for the template
   * Checks platform and bakongPlatform filters
   */
  private async validateMatchingUsers(template: Template): Promise<boolean> {
    try {
      const platformsArray = ValidationHelper.parsePlatforms(
        template.platforms
      );
      const normalizedPlatforms = platformsArray
        .map((p) => ValidationHelper.normalizeEnum(p))
        .filter((p) => p === 'ALL' || p === 'IOS' || p === 'ANDROID');
      if (normalizedPlatforms.length === 0) {
        normalizedPlatforms.push('ALL');
      }
      const tempTemplate = { ...template } as Template;
      const bkUserRepo = (this.notificationService as any).bkUserRepo;
      if (!bkUserRepo) {
        console.error('🔵 [validateMatchingUsers] bkUserRepo not available');
        return false;
      }
      let users = await bkUserRepo.find();
      if (template.bakongPlatform) {
        users = users.filter(
          (user) => user.bakongPlatform === template.bakongPlatform
        );
        if (users.length === 0) {
          console.log(
            `🔵 [validateMatchingUsers] No users found for bakongPlatform: ${template.bakongPlatform}`
          );
          return false;
        }
      }
      const targetsAllPlatforms = normalizedPlatforms.includes('ALL');
      if (!targetsAllPlatforms) {
        const matchingUsers = users.filter((user) => {
          if (!user.platform) return false;
          const normalizedUserPlatform = ValidationHelper.normalizeEnum(
            user.platform
          );
          return normalizedPlatforms.some((p) => normalizedUserPlatform === p);
        });
        if (matchingUsers.length === 0) {
          console.log(
            `🔵 [validateMatchingUsers] No users match platform filter: ${normalizedPlatforms.join(
              ', '
            )}`
          );
          return false;
        }
      }
      console.log(
        `🔵 [validateMatchingUsers] Found matching users for template ${template.id}`
      );
      return true;
    } catch (error: any) {
      console.error(
        '🔵 [validateMatchingUsers] Error validating users:',
        error
      );
      return false;
    }
  }

  addScheduleNotification(template: Template) {
    if (!template.sendSchedule) {
      return;
    }
    if (!this.schedulerRegistry.doesExist('cron', template.id.toString())) {
      const scheduledDate = new Date(template.sendSchedule);
      const now = new Date();
      const timeUntilSchedule = scheduledDate.getTime() - now.getTime();
      const minutesUntilSchedule = timeUntilSchedule / (1000 * 60);
      if (timeUntilSchedule < -2 * 60 * 1000) {
        console.log(
          `Scheduled time ${scheduledDate.toISOString()} is more than 2 minutes in the past, will be handled by periodic cron job`
        );
        return;
      }
      if (timeUntilSchedule <= 2 * 60 * 1000 && timeUntilSchedule >= 0) {
        console.log(
          `Scheduled time ${scheduledDate.toISOString()} is within 2 minutes (${minutesUntilSchedule.toFixed(
            2
          )} min), will be handled by periodic cron job`
        );
        return;
      }
      if (timeUntilSchedule > 2 * 60 * 1000) {
        const job = new CronJob(scheduledDate, async () => {
          try {
            console.log(
              `[CronJob] Executing scheduled notification for template ${template.id
              } at ${new Date()}`
            );
            const updateResult = await this.repo
              .createQueryBuilder()
              .update(Template)
              .set({
                isSent: true,
              })
              .where('id = :id', { id: template.id })
              .andWhere('isSent = :isSent', { isSent: false })
              .execute();
            if (updateResult.affected === 0) {
              console.log(
                `[CronJob] Template ${template.id} was already claimed by another process, skipping to prevent duplicate send`
              );
              return;
            }
            console.log(
              `[CronJob] Successfully claimed template ${template.id} for sending`
            );
            const templateWithTranslations = await this.repo.findOne({
              where: { id: template.id },
              relations: [
                'translations',
                'translations.image',
                'categoryTypeEntity',
              ],
            });
            if (
              templateWithTranslations &&
              templateWithTranslations.translations
            ) {
              const sentCount = await this.notificationService.sendWithTemplate(
                templateWithTranslations
              );
              if (typeof sentCount === 'number' && sentCount > 0) {
                await this.markAsPublished(template.id);
                console.log(
                  `[CronJob] Scheduled notification sent successfully for template ${template.id} to ${sentCount} users`
                );
              } else {
                console.log(
                  `[CronJob] No notifications sent for template ${template.id}`
                );
              }
            } else {
              console.error(
                `[CronJob] Template ${template.id} has no translations, cannot send`
              );
              await this.repo.update(template.id, { isSent: false });
            }
          } catch (error) {
            console.error(
              `[CronJob] Error executing scheduled notification for template ${template.id}:`,
              error
            );
            await this.repo.update(template.id, { isSent: false }).catch(() => {
              console.error(
                `[CronJob] Failed to update template ${template.id}`
              );
            });
          }
        });
        this.schedulerRegistry.addCronJob(template.id.toString(), job);
        job.start();
        console.log(
          `Scheduled notification CronJob created for template ${template.id
          } at ${scheduledDate.toISOString()} (${minutesUntilSchedule.toFixed(
            2
          )} minutes from now)`
        );
      }
    }
  }

  addIntervalNotification(template: Template) {
    const frontendControlled =
      process.env.FRONTEND_CONTROLLED_SENDING === 'true';
    if (frontendControlled) {
      return;
    }
    const { cron, startAt, endAt } = template.sendInterval;
    if (
      !this.schedulerRegistry.doesExist('cron', template.id.toString()) &&
      moment(startAt).startOf('day').isBefore() &&
      moment(endAt).endOf('day').isAfter()
    ) {
      const job = new CronJob(cron, async () => {
        try {
          const templateWithTranslations = await this.repo.findOne({
            where: { id: template.id },
            relations: [
              'translations',
              'translations.image',
              'categoryTypeEntity',
            ],
          });
          if (
            templateWithTranslations &&
            templateWithTranslations.translations
          ) {
            const sentCount = await this.notificationService.sendWithTemplate(
              templateWithTranslations
            );
            if (typeof sentCount === 'number' && sentCount > 0) {
              await this.markAsPublished(template.id);
            }
          }
        } catch (error) {
          throw new Error(error);
        }
      });
      const startJob = new CronJob(startAt, () => {
        this.schedulerRegistry.addCronJob(template.id.toString(), job);
        job.start();
      });
      const endJob = new CronJob(endAt, () => {
        job.stop();
        this.schedulerRegistry.deleteCronJob(template.id.toString());
      });
      this.schedulerRegistry.addCronJob(
        template.id.toString() + '-start',
        startJob
      );
      this.schedulerRegistry.addCronJob(
        template.id.toString() + '-end',
        endJob
      );
      startJob.start();
    }
  }

  getCronJob() {
    const jobs = this.schedulerRegistry.getCronJobs();
    return {
      responseCode: 0,
      responseMessage: 'Cron jobs retrieved successfully',
      errorCode: 0,
      data: Array.from(jobs.keys()),
    };
  }

  async findNotificationTemplate(dto: any): Promise<any> {
    if (dto.templateId) {
      const template = await this.findTemplateById(dto.templateId.toString());
      if (template && !template.isSent) {
        throw new Error(
          `Template ${dto.templateId} is a draft and cannot be sent. Please publish it first.`
        );
      }
      return { template, notificationType: template.notificationType };
    }
    if (dto.notificationType === NotificationType.FLASH_NOTIFICATION) {
      const templates = await this.repo.find({
        where: {
          notificationType: NotificationType.FLASH_NOTIFICATION,
          isSent: true, // Only published templates, exclude drafts
        },
        relations: ['translations', 'translations.image', 'categoryTypeEntity'],
        order: { priority: 'DESC', createdAt: 'DESC' },
      });
      const template =
        templates.find((t) => t.translations && t.translations.length > 0) ||
        null;
      if (!template) {
        throw new Error(
          `No published templates found for type ${NotificationType.FLASH_NOTIFICATION}`
        );
      }
      return {
        template,
        notificationType: NotificationType.FLASH_NOTIFICATION,
      };
    }
    const validatedRequest = dto.notificationType || dto.type;
    const templates = await this.repo.find({
      where: {
        notificationType: validatedRequest,
        isSent: true, // Only published templates, exclude drafts
      },
      relations: ['translations', 'translations.image', 'categoryTypeEntity'],
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
    const template =
      templates.find((t) => t.translations && t.translations.length > 0) ||
      null;
    if (!template) {
      throw new Error(
        `No published templates found for type ${validatedRequest}`
      );
    }
    return { template, notificationType: validatedRequest };
  }

  async findTemplateById(templateId: string): Promise<Template> {
    const template = await this.repo.findOne({
      where: { id: Number(templateId) },
      relations: ['translations', 'translations.image', 'categoryTypeEntity'],
    });
    if (!template) {
      throw new Error(`Template not found with id ${templateId}`);
    }
    return template;
  }

  async findBestTemplateForUser(
    accountId: string,
    language: string,
    notificationRepo: any,
    userBakongPlatform?: string
  ): Promise<{ template: Template; translation: TemplateTranslation } | null> {
    const userNotifications = await notificationRepo.find({
      where: {
        accountId,
      },
      select: ['templateId', 'sendCount', 'createdAt'],
    });
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );
    const todayNotifications = userNotifications.filter((notif) => {
      const createdAt = new Date(notif.createdAt);
      return createdAt >= todayStart && createdAt <= todayEnd;
    });
    const templateViewCounts = todayNotifications.reduce((acc, notif) => {
      const templateId = notif.templateId;
      if (templateId) {
        acc[templateId] = (acc[templateId] || 0) + 1;
      }
      return acc;
    }, {} as Record<number, number>);
    const templateDaysCounts = new Map<number, Set<string>>();
    userNotifications.forEach((notif) => {
      if (notif.templateId) {
        const createdAt = new Date(notif.createdAt);
        const dayKey = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;
        if (!templateDaysCounts.has(notif.templateId)) {
          templateDaysCounts.set(notif.templateId, new Set());
        }
        templateDaysCounts.get(notif.templateId)?.add(dayKey);
      }
    });
    const allTemplatesWhere: any = {
      notificationType: NotificationType.FLASH_NOTIFICATION,
      isSent: true,
    };
    if (userBakongPlatform) {
      allTemplatesWhere.bakongPlatform = userBakongPlatform;
    }
    const allTemplates = await this.repo.find({
      where: allTemplatesWhere,
      relations: ['translations'],
      select: ['id', 'showPerDay', 'maxDayShowing'],
    });
    const excludedTemplateIds: number[] = [];
    allTemplates.forEach((template) => {
      const templateId = template.id;
      const showPerDay = template.showPerDay ?? 1;
      const maxDayShowing = template.maxDayShowing ?? 1;
      const todayCount = templateViewCounts[templateId] || 0;
      const daysCount = templateDaysCounts.get(templateId)?.size || 0;
      if (todayCount >= showPerDay) {
        excludedTemplateIds.push(templateId);
        console.log(
          `📋 [findBestTemplateForUser] Excluding template ${templateId}: reached daily limit (${todayCount}/${showPerDay})`
        );
        return;
      }
      if (daysCount >= maxDayShowing) {
        excludedTemplateIds.push(templateId);
        console.log(
          `📋 [findBestTemplateForUser] Excluding template ${templateId}: reached max days limit (${daysCount}/${maxDayShowing})`
        );
        return;
      }
    });
    if (excludedTemplateIds.length > 0) {
      console.log(
        `📋 [findBestTemplateForUser] Templates excluded due to limits: ${excludedTemplateIds.join(
          ', '
        )}`
      );
    } else {
      console.log(
        `📋 [findBestTemplateForUser] No templates excluded due to limits`
      );
    }
    const whereClause: any = {
      notificationType: NotificationType.FLASH_NOTIFICATION,
      isSent: true, // Only published templates, exclude drafts
      ...(excludedTemplateIds.length > 0 && {
        id: Not(In(excludedTemplateIds)),
      }),
    };
    if (userBakongPlatform) {
      whereClause.bakongPlatform = userBakongPlatform;
      console.log(
        `📋 [findBestTemplateForUser] Filtering templates by bakongPlatform: ${userBakongPlatform}`
      );
    }
    console.log(
      `📋 [findBestTemplateForUser] Excluding templates due to limits: ${excludedTemplateIds.length > 0 ? excludedTemplateIds.join(', ') : 'none'
      }`
    );
    console.log(
      `📋 [findBestTemplateForUser] Only including published templates (isSent: true)`
    );
    const availableTemplates = await this.repo.find({
      where: whereClause,
      relations: ['translations'],
      order: { createdAt: 'DESC' },
    });
    if (availableTemplates.length === 0) {
      const allTemplatesWhere: any = {
        notificationType: NotificationType.FLASH_NOTIFICATION,
        isSent: true,
      };
      if (userBakongPlatform) {
        allTemplatesWhere.bakongPlatform = userBakongPlatform;
      }
      const allTemplates = await this.repo.find({
        where: allTemplatesWhere,
        select: ['id'],
      });
      if (
        allTemplates.length > 0 &&
        excludedTemplateIds.length === allTemplates.length
      ) {
        console.warn(
          `⚠️ [findBestTemplateForUser] All templates have reached their limits for user ${accountId}. Limit reached.`
        );
        return null; // Return null to trigger limit error in handleFlashNotification
      }
      if (userBakongPlatform) {
        console.warn(
          `⚠️ [findBestTemplateForUser] No templates found for bakongPlatform: ${userBakongPlatform}, trying without bakongPlatform filter`
        );
        const fallbackTemplates = await this.repo.find({
          where: {
            notificationType: NotificationType.FLASH_NOTIFICATION,
            isSent: true, // Still exclude drafts
            ...(excludedTemplateIds.length > 0 && {
              id: Not(In(excludedTemplateIds)),
            }),
          },
          relations: ['translations'],
          order: { createdAt: 'DESC' },
        });
        if (fallbackTemplates.length > 0) {
          const selectedTemplate = fallbackTemplates[0];
          const translation = this.findBestTranslation(
            selectedTemplate,
            language
          );
          if (translation) {
            console.log(
              `📋 [findBestTemplateForUser] Using fallback template ${selectedTemplate.id
              } (bakongPlatform: ${selectedTemplate.bakongPlatform || 'NULL'})`
            );
            return { template: selectedTemplate, translation };
          }
        }
      }
      console.warn(
        `⚠️ [findBestTemplateForUser] No available templates found for user ${accountId}`
      );
      return null;
    }
    const selectedTemplate = availableTemplates[0];
    const translation = this.findBestTranslation(selectedTemplate, language);
    if (!translation) return null;
    console.log(
      `✅ [findBestTemplateForUser] Found template ${selectedTemplate.id
      } with bakongPlatform: ${selectedTemplate.bakongPlatform || 'NULL'}`
    );
    return { template: selectedTemplate, translation };
  }

  public findBestTranslation(
    template: Template,
    language?: string
  ): TemplateTranslation | null {
    if (!template.translations || template.translations.length === 0) {
      return null;
    }
    if (language) {
      const requestedTranslation = template.translations.find(
        (t) => t.language === language
      );
      if (requestedTranslation) {
        return requestedTranslation;
      }
    }
    const sortedTranslations = template.translations.sort((a, b) => {
      const priority = { KM: 1, EN: 2, JP: 3 };
      return (priority[a.language] || 999) - (priority[b.language] || 999);
    });
    return sortedTranslations[0] || null;
  }

  async markAsPublished(templateId: number, currentUser?: any): Promise<void> {
    const updateFields: any = {
      isSent: true,
      updatedAt: new Date(),
    };
    if (currentUser?.username) {
      updateFields.publishedBy = currentUser.username;
    }
    await this.repo.update(templateId, updateFields);
  }
}
