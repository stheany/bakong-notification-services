import { ValidationUtils, ErrorCode, ResponseMessage } from '@bakong/shared';

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
            } catch (e: unknown) {
              return str;
            }
          }
          return str;
        })
        .filter((p) => p);
    } else {
      parsedArray = [String(platforms).trim()];
    }
    return parsedArray;
  }

  static handleDatabaseError(exception: unknown, context: string) {
    return {
      responseMessage: `${context} failed due to a database error.`,
      errorCode: ErrorCode.DATABASE_QUERY_FAILED,
    };
  }

  static getHttpStatusFromErrorCode(errorCode: number): number {
    switch (errorCode) {
      case ErrorCode.REQUEST_SUCCESS:
        return 200;
      case ErrorCode.API_NOT_FOUND:
        return 404;
      case ErrorCode.SERVICE_UNHEALTHY:
        return 503;
      case ErrorCode.DATABASE_QUERY_FAILED:
        return 500;
      default:
        return 400;
    }
  }

  static createErrorResponse(exception: unknown, context: string) {
    return {
      responseCode: 1,
      responseMessage: `${context} encountered an unexpected error.`,
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
    };
  }
}
