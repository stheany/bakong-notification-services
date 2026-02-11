import {
  NotificationType,
  ResponseMessage,
  ErrorCode,
  ValidationUtils,
} from '@bakong/shared';
import SentNotificationDto from 'src/modules/notification/dto/send-notification.dto';
import { BaseResponseDto } from '../base-response.dto';
import { getAuth } from 'firebase-admin/auth';
import { BakongUser } from 'src/entities/bakong-user.entity';
export class ValidationHelper {
  static validateLanguage = ValidationUtils.validateLanguage;
  static validatePlatform = ValidationUtils.validatePlatform;
  static validateNotificationType = ValidationUtils.validateNotificationType;
  static validateUserRole = ValidationUtils.validateUserRole;
  static validateSendType = ValidationUtils.validateSendType;
  static normalizeEnum = ValidationUtils.normalizeEnum;
  static languagesMatch = ValidationUtils.languagesMatch;
  static isPlatform = ValidationUtils.isPlatform;
  static parsePlatforms(
    platforms: string | string[] | undefined | null
  ): string[] {
    if (!platforms) {
      return ['ALL'];
    }
    let parsedArray: string[] = [];
    if (Array.isArray(platforms)) {
      parsedArray = platforms
        .map((p) => {
          if (p == null) return '';
          const str = String(p).trim();
          if (
            (str.startsWith('{') && str.endsWith('}')) ||
            (str.startsWith('["') && str.endsWith('"]'))
          ) {
            try {
              const parsed = JSON.parse(str);
              if (typeof parsed === 'object' && parsed !== null) {
                return (
                  parsed.ALL || parsed.platform || parsed[0] || String(parsed)
                );
              }
              if (Array.isArray(parsed) && parsed.length > 0) {
                return String(parsed[0]);
              }
              return String(parsed);
            } catch (e) {
              return str;
            }
          }
          return str;
        })
        .map((p) => this.normalizeEnum(p))
        .filter((p) => p.length > 0);
    } else if (typeof platforms === 'string') {
      const platformsStr = platforms.trim();
      if (platformsStr.startsWith('{') && platformsStr.endsWith('}')) {
        try {
          const content = platformsStr.slice(1, -1); // Remove { and }
          if (content.length === 0) {
            parsedArray = ['ALL'];
          } else {
            parsedArray = content
              .split(',')
              .map((p) => p.trim().replace(/^["']|["']$/g, '')) // Remove surrounding quotes
              .map((p) => (p != null ? String(p) : '')) // Ensure string
              .map((p) => this.normalizeEnum(p)) // Normalize each platform
              .filter((p) => p.length > 0);
            if (parsedArray.length === 0) {
              parsedArray = ['ALL'];
            }
          }
        } catch (e) {
          parsedArray = ['ALL'];
        }
      } else {
        try {
          const parsed = JSON.parse(platformsStr);
          if (Array.isArray(parsed)) {
            parsedArray = parsed
              .map((p) => (p != null ? String(p) : ''))
              .map((p) => this.normalizeEnum(p))
              .filter((p) => p.length > 0);
          } else if (typeof parsed === 'object' && parsed !== null) {
            if (Array.isArray(parsed.platforms)) {
              parsedArray = parsed.platforms
                .map((p) => (p != null ? String(p) : ''))
                .map((p) => this.normalizeEnum(p))
                .filter((p) => p.length > 0);
            } else {
              parsedArray = ['ALL'];
            }
          } else {
            parsedArray = ['ALL'];
          }
        } catch (e) {
          parsedArray = ['ALL'];
        }
      }
    } else {
      parsedArray = ['ALL'];
    }
    const hasIOS = parsedArray.includes('IOS');
    const hasANDROID = parsedArray.includes('ANDROID');
    const hasALL = parsedArray.includes('ALL');
    if (hasALL) {
      return ['ALL'];
    } else if (hasIOS && hasANDROID) {
      return ['ALL'];
    }
    const validPlatforms = parsedArray.filter(
      (p) => p === 'ALL' || p === 'IOS' || p === 'ANDROID'
    );
    return validPlatforms.length > 0 ? validPlatforms : ['ALL'];
  }

  static handleDatabaseError(error: any, context?: string): BaseResponseDto {
    const driverError = error.driverError || {};
    const constraint =
      driverError.constraint || error.constraint || 'unknown_constraint';
    const table = driverError.table || error.table || 'unknown_table';
    const detail = driverError.detail || driverError.message || error.message;
    const column = driverError.column || error.column;
    let specificMessage: string = ResponseMessage.DATABASE_QUERY_FAILED;
    let errorLocation = 'Unknown location';
    let errorCode = ErrorCode.DATABASE_QUERY_FAILED;
    if (error.code) {
      switch (error.code) {
        case '23505':
          specificMessage =
            ResponseMessage.DATABASE_UNIQUE_CONSTRAINT_VIOLATION;
          errorLocation = `Table: ${table}, Constraint: ${constraint}`;
          errorCode = ErrorCode.DATABASE_UNIQUE_CONSTRAINT_VIOLATION;
          break;
        case '23503':
          specificMessage = ResponseMessage.DATABASE_FOREIGN_KEY_VIOLATION;
          errorLocation = `Table: ${table}, Constraint: ${constraint}`;
          errorCode = ErrorCode.DATABASE_FOREIGN_KEY_VIOLATION;
          break;
        case '23514':
          specificMessage = ResponseMessage.DATABASE_CHECK_CONSTRAINT_VIOLATION;
          errorLocation = `Table: ${table}, Constraint: ${constraint}`;
          errorCode = ErrorCode.DATABASE_CHECK_CONSTRAINT_VIOLATION;
          break;
        case '23502':
          specificMessage = ResponseMessage.DATABASE_NOT_NULL_VIOLATION;
          errorLocation = `Table: ${table}, Column: ${column}`;
          errorCode = ErrorCode.DATABASE_NOT_NULL_VIOLATION;
          break;
        case '22P02':
          specificMessage =
            ResponseMessage.DATABASE_INVALID_TEXT_REPRESENTATION;
          errorLocation = `Table: ${table}, Operation: ${context || 'unknown'}`;
          errorCode = ErrorCode.DATABASE_INVALID_TEXT_REPRESENTATION;
          break;
      }
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      specificMessage = ResponseMessage.DATABASE_CONNECTION_ERROR;
      errorLocation = `Database Connection`;
      errorCode = ErrorCode.DATABASE_CONNECTION_ERROR;
    }
    if (errorCode === ErrorCode.DATABASE_QUERY_FAILED) {
      specificMessage = ResponseMessage.DATABASE_QUERY_FAILED;
      errorLocation = `Table: ${table || 'unknown'}, Operation: ${context || 'unknown'
        }`;
    }
    return new BaseResponseDto({
      responseCode: 1,
      responseMessage: specificMessage,
      errorCode: errorCode,
      data: {
        constraint,
        table,
        detail,
        context,
        errorLocation,
        originalError: error.message,
        errorCode: error.code,
      },
    });
  }

  static getHttpStatusFromErrorCode(errorCode: ErrorCode): number {
    switch (errorCode) {
      case ErrorCode.VALIDATION_FAILED:
      case ErrorCode.TEMPLATE_SEND_SCHEDULE_IN_PAST:
      case ErrorCode.TEMPLATE_SEND_INTERVAL_INVAILD_DURATION:
      case ErrorCode.API_NOT_FOUND:
      case ErrorCode.FILE_NOT_FOUND:
      case ErrorCode.IMAGE_NOT_FOUND:
      case ErrorCode.TEMPLATE_NOT_FOUND:
      case ErrorCode.USER_NOT_FOUND:
      case ErrorCode.RECORD_NOT_FOUND:
      case ErrorCode.NOTIFICATION_NOT_FOUND:
      case ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM:
        return 404;
      case ErrorCode.DATABASE_UNIQUE_CONSTRAINT_VIOLATION:
        return 409;
      case ErrorCode.FLASH_LIMIT_REACHED_IN_TODAY:
        return 429;
      case ErrorCode.SERVICE_UNHEALTHY:
      case ErrorCode.DATABASE_CONNECTION_ERROR:
        return 503;
      default:
        return 500;
    }
  }

  static getReadableErrorMessage(error: any): string {
    if (!error) return 'Unknown error occurred';
    if (error.message) {
      const message = error.message.toLowerCase();
      if (message.includes('duplicate key'))
        return 'This record already exists in the database';
      if (message.includes('foreign key constraint'))
        return 'Cannot delete this record as it is referenced by other records';
      if (message.includes('invalid input value for enum'))
        return 'Invalid value provided for the specified field';
      if (message.includes('column') && message.includes('does not exist'))
        return 'Database column not found - please contact administrator';
      if (message.includes('404') || message.includes('not found')) {
        if (
          message.includes('firebase') ||
          message.includes('fcm') ||
          message.includes('messaging')
        ) {
          return 'Firebase messaging service temporarily unavailable';
        }
        return error.message;
      }
      if (
        (message.includes('unauthorized') ||
          message.includes('permission denied')) &&
        (message.includes('firebase') ||
          message.includes('fcm') ||
          message.includes('messaging') ||
          error.code?.includes('firebase'))
      ) {
        return 'Firebase authentication failed - please check configuration';
      }
      if (
        message.includes('unauthorized') ||
        message.includes('permission denied')
      ) {
        if (
          message.includes('jwt') ||
          message.includes('token') ||
          message.includes('authentication required') ||
          error.name === 'UnauthorizedException'
        ) {
          return 'Authentication failed. Please login again.';
        }
        return error.message;
      }
      if (message.includes('quota exceeded')) {
        if (
          message.includes('firebase') ||
          message.includes('fcm') ||
          message.includes('messaging')
        ) {
          return 'Firebase messaging quota exceeded - please try again later';
        }
        return error.message;
      }
      if (message.includes('network') || message.includes('timeout'))
        return 'Network connection issue - please try again';
      if (message.includes('connection refused'))
        return 'Service temporarily unavailable - please try again later';
      if (message.includes('validation failed'))
        return 'Please check your input data and try again';
      if (message.includes('required')) return 'Required field is missing';
      if (message.includes('invalid format')) return 'Data format is invalid';
      return error.message;
    }
    if (typeof error === 'string') return error;
    if (typeof error === 'object') return JSON.stringify(error);
    return 'An unexpected error occurred';
  }

  static getErrorCode(error: any): ErrorCode {
    if (!error) return ErrorCode.INTERNAL_SERVER_ERROR;
    const message = error.message?.toLowerCase() || '';
    if (message.includes('duplicate key'))
      return ErrorCode.DATABASE_UNIQUE_CONSTRAINT_VIOLATION;
    if (message.includes('foreign key constraint'))
      return ErrorCode.DATABASE_FOREIGN_KEY_VIOLATION;
    if (message.includes('invalid input value for enum'))
      return ErrorCode.VALIDATION_FAILED;
    if (message.includes('column') && message.includes('does not exist'))
      return ErrorCode.INTERNAL_SERVER_ERROR;
    if (message.includes('404') || message.includes('not found'))
      return ErrorCode.SERVICE_UNHEALTHY;
    if (
      message.includes('unauthorized') ||
      message.includes('permission denied')
    )
      return ErrorCode.FAILED_AUTHENTICATION;
    if (message.includes('quota exceeded'))
      return ErrorCode.FLASH_LIMIT_REACHED_IN_TODAY;
    if (message.includes('network') || message.includes('timeout'))
      return ErrorCode.SERVICE_UNHEALTHY;
    if (message.includes('connection refused'))
      return ErrorCode.SERVICE_UNHEALTHY;
    if (message.includes('validation failed'))
      return ErrorCode.VALIDATION_FAILED;
    if (message.includes('required')) return ErrorCode.VALIDATION_FAILED;
    if (message.includes('invalid format')) return ErrorCode.VALIDATION_FAILED;
    if (message.includes('invalid fcm token'))
      return ErrorCode.INVALID_FCM_TOKEN;
    if (
      message.includes(
        'sendSchedule is required when sendType is SEND_SCHEDULE'
      )
    )
      return ErrorCode.VALIDATION_FAILED;
    if (
      message.includes(
        'sendSchedule must be a number conforming to the specified constraints'
      )
    )
      return ErrorCode.TEMPLATE_SEND_SCHEDULE_IN_PAST;
    if (
      message.includes(
        'sendInterval is required when sendType is SEND_INTERVAL'
      )
    )
      return ErrorCode.VALIDATION_FAILED;
    if (message.includes('startAt must be before endAt'))
      return ErrorCode.TEMPLATE_SEND_INTERVAL_INVAILD_DURATION;
    return ErrorCode.INTERNAL_SERVER_ERROR;
  }

  static async validateFCMTokens(
    users: BakongUser[],
    fcm: any
  ): Promise<BakongUser[]> {
    const validUsers = [];
    const invalidUsers = [];
    const formatInvalidUsers = [];
    if (!fcm) {
      for (const user of users) {
        if (this.isValidFCMTokenFormat(user.fcmToken)) {
          validUsers.push(user);
        } else {
          formatInvalidUsers.push(user.accountId);
        }
      }
      return validUsers;
    }
    for (const user of users) {
      if (!this.isValidFCMTokenFormat(user.fcmToken)) {
        formatInvalidUsers.push(user.accountId);
        continue;
      }
      try {
        const isValid = await this.validateFCMTokenWithFirebase(
          user.fcmToken,
          fcm
        );
        if (isValid) {
          validUsers.push(user);
        } else {
          invalidUsers.push(user.accountId);
        }
      } catch (error: any) {
        invalidUsers.push(user.accountId);
      }
    }
    return validUsers;
  }

  static isValidFCMTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }
    return token.length >= 30 && /^[A-Za-z0-9:_-]+$/.test(token);
  }

  static async validateFCMTokenWithFirebase(
    token: string,
    fcm: any
  ): Promise<boolean> {
    if (!this.isValidFCMTokenFormat(token)) {
      console.warn(
        `❌ [validateFCMTokenWithFirebase] Invalid token format: ${token.substring(
          0,
          30
        )}...`
      );
      return false;
    }
    return true;
  }

  static validateFirebaseMessageId(response: string): number {
    const parts = response.split('/');
    let messageId = parts[parts.length - 1];
    if (messageId.includes(':')) {
      messageId = messageId.split(':')[1];
    }
    if (messageId.includes('%')) {
      messageId = messageId.split('%')[0];
    }
    const numericId = parseInt(messageId, 10);
    return isNaN(numericId) ? 0 : numericId;
  }

  static validateTranslation(
    template: any,
    language: string
  ): { isValid: boolean; translation?: any; errorMessage?: string } {
    const templateValidation = this.validateTemplate(template);
    if (!templateValidation.isValid) {
      return { isValid: false, errorMessage: templateValidation.errorMessage };
    }
    if (
      !template.translations ||
      !Array.isArray(template.translations) ||
      template.translations.length === 0
    ) {
      return { isValid: false, errorMessage: 'Template has no translations' };
    }
    let translation = template.translations.find(
      (t) => t.language === language
    );
    if (!translation) {
      translation = template.translations[0];
    }
    if (!translation) {
      return {
        isValid: false,
        errorMessage: 'No translation found for the requested language',
      };
    }
    return { isValid: true, translation };
  }

  static validateTemplate(template: any): {
    isValid: boolean;
    errorMessage?: string;
  } {
    if (!template) {
      return { isValid: false, errorMessage: 'Template not found' };
    }
    if (
      !template.translations ||
      !Array.isArray(template.translations) ||
      template.translations.length === 0
    ) {
      return { isValid: false, errorMessage: 'Template has no translations' };
    }
    return { isValid: true };
  }

  static updateUserFields(user: any, updates: any): boolean {
    let hasChanges = false;
    if (updates.fcmToken !== undefined) {
      const currentToken = user.fcmToken || '';
      const newToken = updates.fcmToken || '';
      const tokensAreDifferent = currentToken.trim() !== newToken.trim();
      if (
        currentToken.length >= 30 &&
        (newToken === '' || newToken.length < 30)
      ) {
      } else {
        user.fcmToken = updates.fcmToken;
        hasChanges = true;
      }
      if (hasChanges) {
        if (tokensAreDifferent) {
          hasChanges = true;
        } else {
          hasChanges = true;
        }
      }
    }
    if (updates.platform !== undefined) {
      const platformValidation = this.validatePlatform(updates.platform);
      if (platformValidation.isValid) {
        const normalizedPlatform = platformValidation.normalizedValue;
        if (user.platform !== normalizedPlatform) {
          console.log(
            `🔄 [updateUserFields] platform changed for user ${user.accountId
            }: ${user.platform || 'NULL'} -> ${normalizedPlatform}`
          );
        }
        user.platform = normalizedPlatform;
        hasChanges = true;
      }
    }
    if (updates.language !== undefined) {
      const languageValidation = this.validateLanguage(updates.language);
      if (languageValidation.isValid) {
        const normalizedLanguage = languageValidation.normalizedValue;
        if (user.language !== normalizedLanguage) {
          console.log(
            `🔄 [updateUserFields] language changed for user ${user.accountId
            }: ${user.language || 'NULL'} -> ${normalizedLanguage}`
          );
        }
        user.language = normalizedLanguage;
        hasChanges = true;
      }
    }
    if (updates.participantCode !== undefined) {
      if (user.participantCode !== updates.participantCode) {
        console.log(
          `🔄 [updateUserFields] participantCode changed for user ${user.accountId
          }: ${user.participantCode || 'NULL'} -> ${updates.participantCode}`
        );
      }
      user.participantCode = updates.participantCode;
      hasChanges = true;
    }
    if (updates.bakongPlatform !== undefined) {
      if (user.bakongPlatform !== updates.bakongPlatform) {
        console.log(
          `🔄 [updateUserFields] bakongPlatform changed for user ${user.accountId
          }: ${user.bakongPlatform || 'NULL'} -> ${updates.bakongPlatform}`
        );
      }
      user.bakongPlatform = updates.bakongPlatform;
      hasChanges = true;
    }
    return hasChanges;
  }

  static normalizeUserFields(
    user: any,
    result?: { platformUpdates: number; languageUpdates: number }
  ): boolean {
    let hasChanges = false;
    const normalizedPlatform = this.normalizeEnum(user.platform);
    if (user.platform !== normalizedPlatform) {
      user.platform = normalizedPlatform;
      hasChanges = true;
      if (result) result.platformUpdates++;
    }
    const normalizedLanguage = this.normalizeEnum(user.language);
    if (user.language !== normalizedLanguage) {
      user.language = normalizedLanguage;
      hasChanges = true;
      if (result) result.languageUpdates++;
    }
    return hasChanges;
  }

  static checkValidationViewCount(dto: SentNotificationDto): NotificationType {
    const { notificationType } = dto;
    if (notificationType) {
      const validation =
        ValidationHelper.validateNotificationType(notificationType);
      if (!validation.isValid) {
        throw new Error(
          `Notification type validation failed: ${validation.errorMessage}`
        );
      }
      return validation.normalizedValue;
    }
    return NotificationType.NOTIFICATION;
  }

  static createErrorResponse(error: any, context?: string): any {
    const message = ValidationHelper.getReadableErrorMessage(error);
    const errorCode = ValidationHelper.getErrorCode(error);
    const httpStatus = ValidationHelper.getHttpStatusFromErrorCode(errorCode);
    return {
      responseCode: 1,
      responseMessage: message,
      errorCode: errorCode,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        context: context || 'Unknown',
        originalError:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
        httpStatus: httpStatus,
      },
    };
  }

  static isRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection refused') ||
      message.includes('quota exceeded') ||
      (message.includes('connection') && message.includes('failed'))
    );
  }

  static getRetryDelay(error: any, attempt: number): number {
    const baseDelay = 1000;
    const maxDelay = 30000;
    if (error.message?.includes('quota exceeded')) {
      return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    }
    return Math.min(baseDelay * attempt, maxDelay);
  }
}
