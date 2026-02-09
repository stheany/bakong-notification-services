import { DateUtils } from '@bakong/shared';

export enum NotificationType {
  NOTIFICATION = 'NOTIFICATION',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  FLASH_NOTIFICATION = 'FLASH_NOTIFICATION',
}

// CategoryType enum removed - use categoryTypeId from API instead

export enum Platform {
  ALL = 'ALL',
  IOS = 'IOS',
  ANDROID = 'ANDROID',
}

export enum Language {
  KM = 'KM',
  EN = 'EN',
  JP = 'JP',
}

export enum SendType {
  SEND_NOW = 'SEND_NOW',
  SEND_SCHEDULE = 'SEND_SCHEDULE',
  SEND_INTERVAL = 'SEND_INTERVAL',
}

export enum BakongApp {
  BAKONG = 'BAKONG',
  BAKONG_TOURIST = 'BAKONG_TOURIST',
  BAKONG_JUNIOR = 'BAKONG_JUNIOR',
}

export const formatNotificationType = (type: string): string => {
  switch (type?.toUpperCase()) {
    case NotificationType.NOTIFICATION:
      return 'Notification';
    case NotificationType.ANNOUNCEMENT:
      return 'Announcement';
    case NotificationType.FLASH_NOTIFICATION:
      return 'Flash Notification';
    default:
      return type || 'Notification';
  }
};

export const formatCategoryType = (
  category: string | number | undefined
): string => {
  if (!category) return 'Other';

  // If it's a number (categoryTypeId), we'll need the name from API
  // For now, just return the string value or formatted version
  const categoryStr = String(category).toUpperCase();

  switch (categoryStr) {
    case 'EVENT':
      return 'Event';
    case 'PRODUCT_AND_FEATURE':
      return 'Product & features';
    case 'NEWS':
      return 'News';
    case 'OTHER':
      return 'Other';
    default:
      // Try to format common patterns
      return (
        categoryStr
          .split('_')
          .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
          .join(' ') || 'Other'
      );
  }
};

export const formatPlatform = (platform: string): string => {
  switch (platform?.toUpperCase()) {
    case Platform.IOS:
      return 'iOS';
    case Platform.ANDROID:
      return 'Android';
    case Platform.ALL:
      return 'ALL';
    default:
      return platform || 'ALL';
  }
};

export const formatBakongApp = (app: string | undefined | null): string => {
  if (!app) return 'Bakong';
  switch (app.toUpperCase()) {
    case BakongApp.BAKONG:
      return 'Bakong';
    case BakongApp.BAKONG_TOURIST:
      return 'Bakong Tourist';
    case BakongApp.BAKONG_JUNIOR:
      return 'Bakong Junior';
    default:
      return app || 'Bakong';
  }
};

/**
 * Extracts and formats the Bakong platform name from various sources
 * @param sources - Object containing possible sources for platform name
 * @returns Formatted platform name or 'this platform' as fallback
 */
export const getFormattedPlatformName = (sources: {
  platformName?: string;
  bakongPlatform?: string;
  notification?: { bakongPlatform?: string };
}): string => {
  if (sources.platformName) {
    return sources.platformName;
  }
  if (sources.bakongPlatform) {
    return formatBakongApp(sources.bakongPlatform);
  }
  if (sources.notification?.bakongPlatform) {
    return formatBakongApp(sources.notification.bakongPlatform);
  }
  return 'this platform';
};

/**
 * Creates a formatted message for "no users available" notification
 * @param platformName - The formatted platform name (e.g., "Bakong Tourist")
 * @returns HTML-formatted message string
 */
export const getNoUsersAvailableMessage = (platformName: string): string => {
  return `No users are available yet for <strong>${platformName}</strong>, so it will be saved as a draft and sent once users are available.`;
};

/**
 * Parses backend error message to extract platform information
 * @param backendErrorMessage - The error message from backend
 * @returns Object with formatted OS platform and Bakong app, or null if parsing fails
 */
const parsePlatformFromErrorMessage = (
  backendErrorMessage: string
): { osPlatform: string; bakongApp: string } | null => {
  if (!backendErrorMessage || typeof backendErrorMessage !== 'string') {
    return null;
  }

  // Parse backend message format: "No users found for Using {Platform} on {Bakong App} app."
  // Examples:
  // - "No users found for Using ANDROID on Bakong app."
  // - "No users found for Using IOS on Bakong Tourist app."
  // - "No users found for Using ALL on Bakong Junior app."

  const match = backendErrorMessage.match(
    /No users found for Using (.+?) on (.+?) app\.?/i
  );

  if (match) {
    const osPlatform = match[1].trim();
    const bakongApp = match[2].trim();
    return { osPlatform, bakongApp };
  }

  return null;
};

/**
 * Formats OS platform name for display
 * @param osPlatform - Raw OS platform (e.g., "ANDROID", "IOS", "ALL")
 * @returns Formatted platform name (e.g., "Android", "iOS", "All Platforms")
 */
const formatOSPlatform = (osPlatform: string): string => {
  const upper = osPlatform.toUpperCase();
  if (upper === 'ANDROID') {
    return 'Android';
  } else if (upper === 'IOS') {
    return 'iOS';
  } else if (upper === 'ALL') {
    return 'All Platforms';
  }
  return osPlatform;
};

/**
 * Formats the "no users found" error message for submission failures
 * Extracts platform information from backend error message and formats it clearly
 * @param backendErrorMessage - The error message from backend (e.g., "No users found for Using ANDROID on Bakong app.")
 * @returns HTML-formatted message string for "Cannot submit notification" warning
 */
export const formatNoUsersFoundMessage = (
  backendErrorMessage: string
): string => {
  // Default message if parsing fails
  const defaultMessage =
    'No users found matching the selected platform requirements. Please ensure there are registered users for the specified platforms before submitting.';

  const parsed = parsePlatformFromErrorMessage(backendErrorMessage);

  if (parsed) {
    const formattedOSPlatform = formatOSPlatform(parsed.osPlatform);
    const formattedBakongApp = formatBakongApp(parsed.bakongApp);

    return `<strong>Cannot submit notification:</strong> No users found for <strong>${formattedOSPlatform}</strong> on <strong>${formattedBakongApp}</strong> app. The notification has been saved as draft.`;
  }

  // If parsing fails, use the backend message but format it nicely
  if (!backendErrorMessage || typeof backendErrorMessage !== 'string') {
    return `<strong>Cannot submit notification:</strong> ${defaultMessage} The notification has been saved as draft.`;
  }

  return `<strong>Cannot submit notification:</strong> ${backendErrorMessage} The notification has been saved as draft.`;
};

/**
 * Formats the "no users found" error message for approval rejection
 * Extracts platform information from backend error message and formats it clearly
 * @param backendErrorMessage - The error message from backend (e.g., "No users found for Using ANDROID on Bakong app.")
 * @returns HTML-formatted message string for "Notification rejected" warning
 */
export const formatNoUsersFoundRejectionMessage = (
  backendErrorMessage: string
): string => {
  // Default message if parsing fails
  const defaultMessage =
    'No users found matching the platform requirements. Please ensure there are registered users for the specified platforms before approving.';

  const parsed = parsePlatformFromErrorMessage(backendErrorMessage);

  if (parsed) {
    const formattedOSPlatform = formatOSPlatform(parsed.osPlatform);
    const formattedBakongApp = formatBakongApp(parsed.bakongApp);

    return `<strong>Notification rejected:</strong> No users found for <strong>${formattedOSPlatform}</strong> on <strong>${formattedBakongApp}</strong> app. Please ensure there are registered users for this platform before approving.`;
  }

  // If parsing fails, use the backend message but format it nicely
  if (!backendErrorMessage || typeof backendErrorMessage !== 'string') {
    return `<strong>Notification rejected:</strong> ${defaultMessage}`;
  }

  return `<strong>Notification rejected:</strong> ${backendErrorMessage}`;
};

/**
 * Notification message result interface
 */
export interface NotificationMessageResult {
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  duration: number;
  dangerouslyUseHTMLString?: boolean;
}

/**
 * Determines the appropriate notification message based on send result
 * @param result - The API response result data
 * @param platformName - The formatted platform name (optional)
 * @param bakongPlatform - The raw bakongPlatform value (optional, e.g., "BAKONG", "BAKONG_TOURIST")
 * @returns Notification message configuration
 */
export const getNotificationMessage = (
  result: any,
  platformName?: string,
  bakongPlatform?: string,
  devicePlatform?: string // Device platform: "Android", "iOS", or "ALL"
): NotificationMessageResult => {
  const failedDueToInvalidTokens = result?.failedDueToInvalidTokens === true;
  const failedCount = result?.failedCount || 0;
  const successfulCount = result?.successfulCount || 0;
  const savedAsDraftNoUsers = result?.savedAsDraftNoUsers === true;

  // Get formatted platform name with bakongPlatform info
  const formattedPlatform =
    platformName ||
    (bakongPlatform ? formatBakongApp(bakongPlatform) : 'this platform');

  // Format device platform for display (iOS, Android, or empty for ALL)
  const formatDevicePlatform = (platform?: string): string => {
    if (!platform || platform === 'ALL' || platform.toUpperCase() === 'ALL') {
      return '';
    }
    // Normalize platform name: handle both "IOS"/"iOS" and "ANDROID"/"Android"
    const normalized = platform.toUpperCase();
    if (normalized === 'IOS') {
      return 'iOS';
    } else if (normalized === 'ANDROID') {
      return 'Android';
    }
    // If already formatted (iOS/Android), return as-is
    if (platform === 'iOS' || platform === 'Android') {
      return platform;
    }
    return platform;
  };

  const formattedDevicePlatform = formatDevicePlatform(devicePlatform);

  // Standard format: "Notification for **Bakong** sent to **iOS** to X user(s) successfully."
  // Format device platform text: " to **iOS**" or " to **Android**" or "" (for ALL)
  const devicePlatformText = formattedDevicePlatform
    ? ` to <strong>${formattedDevicePlatform}</strong>`
    : '';

  const bakongPlatformText = bakongPlatform
    ? ` for <strong>${formattedPlatform}</strong>`
    : '';

  // Case 1: No users available (only if no failures and savedAsDraftNoUsers is true)
  // IMPORTANT: savedAsDraftNoUsers should only be true when there are literally no users,
  // not when all users failed. Check failedCount === 0 to distinguish.
  if (savedAsDraftNoUsers && failedCount === 0 && successfulCount === 0) {
    return {
      title: 'Info',
      message: getNoUsersAvailableMessage(formattedPlatform),
      type: 'info',
      duration: 3000,
      dangerouslyUseHTMLString: true,
    };
  }

  // Case 2: ALL sends failed (successfulCount === 0 && failedCount > 0)
  // This means we attempted to send but ALL users failed
  if (successfulCount === 0 && failedCount > 0) {
    // Provide more helpful message if failure is due to invalid tokens
    let failureReason = '';
    if (failedDueToInvalidTokens) {
      failureReason = ` All ${failedCount} user(s) have invalid or expired FCM tokens. Users need to open the mobile app to refresh their tokens. You can retry publishing this draft after users update their tokens.`;
    } else {
      failureReason = ` Failed to send to ${failedCount} user(s).`;
    }

    return {
      title: 'Warning',
      message: `Failed to send the${bakongPlatformText} notification${devicePlatformText}.${failureReason} The notification has been saved as a draft.`,
      type: 'warning',
      duration: 8000, // Longer duration for more informative message
      dangerouslyUseHTMLString: true,
    };
  }

  // Case 4: Partial success (SOME succeeded, SOME failed)
  // This means some users received the notification successfully, but some failed
  if (successfulCount > 0 && failedCount > 0) {
    // Standard format: "Notification for **Bakong** sent to **iOS** to X user(s) successfully."
    // Example: "Notification for **Bakong** sent to **iOS** to 2 user(s) successfully."
    // Format: "Notification for **Bakong** sent to X user(s) successfully." (if devicePlatform is ALL)
    const userCountText = formattedDevicePlatform
      ? ` to ${successfulCount} user(s)`
      : ` to ${successfulCount} user(s)`;
    return {
      title: 'Success',
      message: `Notification${bakongPlatformText} sent${devicePlatformText}${userCountText} successfully.`,
      type: 'success',
      duration: 3000,
      dangerouslyUseHTMLString: true,
    };
  }

  // Case 5: Full success (default - should be handled by caller, but included for completeness)
  if (successfulCount > 0 && failedCount === 0) {
    // Standard format: "Notification for **Bakong** sent to **iOS** to X user(s) successfully."
    // Example: "Notification for **Bakong** sent to **iOS** to 2 user(s) successfully."
    // Format: "Notification for **Bakong** sent to X user(s) successfully." (if devicePlatform is ALL)
    const userCountText = formattedDevicePlatform
      ? ` to ${successfulCount} user(s)`
      : ` to ${successfulCount} user(s)`;
    return {
      title: 'Success',
      message: `Notification${bakongPlatformText} sent${devicePlatformText}${userCountText} successfully.`,
      type: 'success',
      duration: 3000,
      dangerouslyUseHTMLString: true,
    };
  }

  // Default fallback
  return {
    title: 'Info',
    message: `Notification${bakongPlatformText} has been saved as a draft.`,
    type: 'info',
    duration: 3000,
    dangerouslyUseHTMLString: true,
  };
};

export const formatFileSize = (size: number) => {
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
};

export const passwordFormat = (password: string, strict?: boolean) => password;
export const emailFormat = (email: string) => email;
export const usernameFormat = (username: string) => username;
export const formatStatus = (status: string) => status;
export const formatDate = (date: Date) => date.toLocaleDateString();
export const getErrorMessage = (error: any) =>
  error?.message || 'An error occurred';
export const ERROR_MESSAGES = {
  VALIDATION_ERROR: 'Validation error',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not found',
  INTERNAL_SERVER_ERROR: 'Internal server error',
};

export const getRules = (rules: any) => {
  return Object.keys(rules).reduce((acc, key) => {
    acc[key] = [
      { required: rules[key].required, message: `${key} is required` },
      { validator: rules[key].customRule, trigger: 'blur' },
    ];
    return acc;
  }, {} as any);
};

export const getCurrentDateTimeInCambodia = () => {
  return {
    date: DateUtils.getCurrentDateString(),
    time: DateUtils.getCurrentTimeString(),
  };
};

export const getCurrentTimePlaceholder = () => {
  return DateUtils.getCurrentTimeString();
};

export const getCurrentDatePlaceholder = () => {
  return DateUtils.getCurrentDateString();
};

export const disabledDate = (time: Date): boolean => {
  const now = DateUtils.nowInCambodia();
  // Get today's date in Cambodia timezone properly (set to midnight)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(0, 0, 0, 0);
  // Compare only the date part (ignore time) - set to midnight for accurate comparison
  const selectedDate = new Date(
    time.getFullYear(),
    time.getMonth(),
    time.getDate()
  );
  selectedDate.setHours(0, 0, 0, 0);
  // Disable dates that are before today (allow today and future dates)
  // Use <= comparison to ensure today is NOT disabled
  return selectedDate.getTime() < today.getTime();
};

export const disabledHours = (scheduleDate: string | null): number[] => {
  if (!scheduleDate) return [];

  try {
    const now = DateUtils.nowInCambodia();
    const today = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

    // Parse M/D/YYYY format properly
    const [month, day, year] = scheduleDate.split('/').map(Number);
    if (isNaN(month) || isNaN(day) || isNaN(year)) return [];

    const selectedDateOnly = new Date(year, month - 1, day);

    // Compare dates (only date, not time)
    if (
      selectedDateOnly.getFullYear() === today.getFullYear() &&
      selectedDateOnly.getMonth() === today.getMonth() &&
      selectedDateOnly.getDate() === today.getDate()
    ) {
      const currentHour = now.getUTCHours();
      return Array.from({ length: currentHour }, (_, i) => i);
    }
    return [];
  } catch (error) {
    // If parsing fails, don't disable any hours (safer for future dates)
    return [];
  }
};

export const disabledMinutes = (
  selectedHour: number,
  scheduleDate: string | null
): number[] => {
  if (!scheduleDate) return [];

  try {
    const now = DateUtils.nowInCambodia();
    const today = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

    // Parse M/D/YYYY format properly
    const [month, day, year] = scheduleDate.split('/').map(Number);
    if (isNaN(month) || isNaN(day) || isNaN(year)) return [];

    const selectedDateOnly = new Date(year, month - 1, day);

    // Compare dates (only date, not time) and check if it's today and same hour
    const isToday =
      selectedDateOnly.getFullYear() === today.getFullYear() &&
      selectedDateOnly.getMonth() === today.getMonth() &&
      selectedDateOnly.getDate() === today.getDate();

    if (isToday && selectedHour === now.getUTCHours()) {
      const currentMinute = now.getUTCMinutes();
      return Array.from({ length: currentMinute }, (_, i) => i);
    }
    return [];
  } catch (error) {
    // If parsing fails, don't disable any minutes (safer for future dates)
    return [];
  }
};

export const mapBackendStatusToFrontend = (
  backendStatus: string
): 'published' | 'scheduled' | 'draft' => {
  switch (backendStatus.toUpperCase()) {
    case 'SENT':
    case 'PUBLISHED':
      return 'published';
    case 'SCHEDULED':
    case 'PENDING':
      return 'scheduled';
    case 'DRAFT':
    case 'UNSENT':
      return 'draft';
    default:
      return 'draft';
  }
};

export const mapNotificationTypeToFormType = (
  type: string
): NotificationType => {
  const typeMap: Record<string, NotificationType> = {
    [NotificationType.NOTIFICATION]: NotificationType.NOTIFICATION,
    [NotificationType.ANNOUNCEMENT]: NotificationType.ANNOUNCEMENT,
    [NotificationType.FLASH_NOTIFICATION]: NotificationType.FLASH_NOTIFICATION,
  };
  return typeMap[type] || NotificationType.NOTIFICATION;
};

export const mapPlatformToFormPlatform = (
  platforms: string | string[]
): Platform => {
  if (Array.isArray(platforms)) {
    if (platforms.includes(Platform.ALL)) return Platform.ALL;
    if (platforms.includes('BAKONG')) return Platform.ALL;
    // If both IOS and ANDROID are present, treat as ALL
    const hasIOS =
      platforms.includes(Platform.IOS) || platforms.includes('IOS');
    const hasAndroid =
      platforms.includes(Platform.ANDROID) || platforms.includes('ANDROID');
    if (hasIOS && hasAndroid) return Platform.ALL;
    // Return the first platform if only one is present, properly convert string to enum
    if (platforms.length > 0) {
      const firstPlatform = platforms[0].toUpperCase();
      if (firstPlatform === Platform.IOS) return Platform.IOS;
      if (firstPlatform === Platform.ANDROID) return Platform.ANDROID;
      if (firstPlatform === Platform.ALL) return Platform.ALL;
    }
    return Platform.ALL;
  }
  // Handle string input
  const platformStr = String(platforms).toUpperCase();
  if (platformStr === Platform.IOS) return Platform.IOS;
  if (platformStr === Platform.ANDROID) return Platform.ANDROID;
  if (platformStr === Platform.ALL) return Platform.ALL;
  return Platform.ALL;
};

export const mapTypeToNotificationType = (type: string): string => {
  return type || NotificationType.ANNOUNCEMENT;
};

export const mapTypeToCategoryType = (
  type: string | number | undefined
): number | string => {
  // Return the type as-is (could be categoryTypeId number or name string)
  return type || 'OTHER';
};

export const mapPlatformToEnum = (platform: string): string => {
  return platform || Platform.ALL;
};

export const mapLanguageToEnum = (language: string): Language => {
  const langUpper = language.toUpperCase();

  if (langUpper === 'KM' || langUpper === 'EN' || langUpper === 'JP') {
    return langUpper as Language;
  }

  switch (language.toLowerCase()) {
    case 'khmer':
      return Language.KM;
    case 'english':
      return Language.EN;
    case 'japan':
      return Language.JP;
    default:
      return Language.EN;
  }
};

/**
 * Detects if text contains Khmer characters
 * Khmer Unicode range: U+1780–U+17FF
 */
export const containsKhmer = (text: string | null | undefined): boolean => {
  if (!text || typeof text !== 'string') return false;

  // Khmer Unicode range: U+1780–U+17FF
  const khmerRegex = /[\u1780-\u17FF]/;
  return khmerRegex.test(text);
};

export const processFile = async (
  file: File,
  onSuccess: (file: File, previewUrl: string, wasConverted?: boolean) => void,
  onError: (error: string) => void,
  validateAspectRatio: boolean = true,
  acceptTypes: string = 'image/*',
  maxSize: number = 2 * 1024 * 1024, // 2MB default (safer for batch uploads)
  autoConvert: boolean = true, // New parameter: automatically convert instead of rejecting
  targetAspectRatio: number = 2 / 1 // Default to 2:1 as shown in UI
) => {
  const acceptedTypes = acceptTypes.split(',').map((type) => type.trim());
  const isValidType = acceptedTypes.some((type) => {
    if (type === 'image/*') return file.type.startsWith('image/');
    const baseType = type.split('/')[0];
    return file.type.startsWith(baseType + '/');
  });
  if (!isValidType) {
    onError(
      `File type ${file.type} is not supported. Please select a valid file.`
    );
    return;
  }

  // If auto-convert is enabled, process the image automatically
  if (autoConvert && file.type.startsWith('image/')) {
    try {
      // Check if conversion is needed
      const needsSizeConversion = file.size > maxSize;
      let needsAspectRatioConversion = false;

      if (validateAspectRatio) {
        const imageCheck = await new Promise<{
          needsConversion: boolean;
          aspectRatio: number;
        }>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const aspectRatio = img.width / img.height;
              // Only accept 2:1 aspect ratio (or 880:440 which is also 2:1)
              const targetRatio = 2 / 1;
              const tolerance = 0.05; // 5% tolerance for rounding
              const isAcceptable =
                Math.abs(aspectRatio - targetRatio) <= tolerance;
              resolve({ needsConversion: !isAcceptable, aspectRatio });
            };
            img.onerror = () =>
              resolve({ needsConversion: false, aspectRatio: 1 });
            img.src = e.target?.result as string;
          };
          reader.readAsDataURL(file);
        });
        needsAspectRatioConversion = imageCheck.needsConversion;
      }

      // If conversion is needed, process the image
      if (needsSizeConversion || needsAspectRatioConversion) {
        const {
          file: convertedFile,
          dataUrl,
          wasConverted,
        } = await compressImage(file, {
          maxBytes: maxSize,
          maxWidth: 2000,
          targetAspectRatio,
          verticalBiasPx: 0, // Center the crop (no vertical bias)
          correctAspectRatio: validateAspectRatio && needsAspectRatioConversion,
          keepOriginalFile: false, // We will return the converted file, not the original
        });

        onSuccess(convertedFile, dataUrl, wasConverted);
        return;
      } else {
        // No conversion needed, just return the original file
        const reader = new FileReader();
        reader.onload = (e) => {
          onSuccess(file, e.target?.result as string, false);
        };
        reader.readAsDataURL(file);
        return;
      }
    } catch (error) {
      console.error('Error processing image:', error);
      onError('Failed to process image. Please try again.');
      return;
    }
  }

  // If no conversion needed or auto-convert is disabled, validate normally
  if (file.size > maxSize && !autoConvert) {
    onError(
      `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds the maximum limit of ${(maxSize / 1024 / 1024).toFixed(2)}MB.`
    );
    return;
  }

  if (validateAspectRatio && file.type.startsWith('image/') && !autoConvert) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        // Only accept 2:1 aspect ratio (or 880:440 which is also 2:1)
        const targetRatio = 2 / 1;
        const tolerance = 0.05; // 5% tolerance for rounding
        const isAcceptable = Math.abs(aspectRatio - targetRatio) <= tolerance;
        if (!isAcceptable) {
          const errorMsg = `Image aspect ratio ${aspectRatio.toFixed(2)}:1 is not supported. Please use images with 2:1 aspect ratio (e.g., 880:440).`;
          onError(errorMsg);
          return;
        }
        onSuccess(file, e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  } else {
    const reader = new FileReader();
    reader.onload = (e) => {
      onSuccess(file, e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }
};

/**
 * Corrects image aspect ratio to target ratio (default 2:1)
 * Uses padding (letterboxing/pillarboxing) to show full image without cropping
 * Returns canvas dimensions and where to draw the original image
 */
export const correctAspectRatio = async (
  img: HTMLImageElement,
  targetRatio: number = 2 / 1
): Promise<{
  canvasWidth: number;
  canvasHeight: number;
  // source crop rect
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  // output draw rect
  dstW: number;
  dstH: number;
  wasCorrected: boolean;
}> => {
  const currentRatio = img.width / img.height;
  const tolerance = 0.05;

  // ✅ already close enough → no crop
  if (Math.abs(currentRatio - targetRatio) <= tolerance) {
    return {
      canvasWidth: img.width,
      canvasHeight: img.height,
      srcX: 0,
      srcY: 0,
      srcW: img.width,
      srcH: img.height,
      dstW: img.width,
      dstH: img.height,
      wasCorrected: false,
    };
  }

  // default crop rect = full image
  let srcX = 0;
  let srcY = 0;
  let srcW = img.width;
  let srcH = img.height;

  if (currentRatio > targetRatio) {
    // too wide → crop left/right (center)
    srcW = Math.floor(img.height * targetRatio);
    srcX = Math.floor((img.width - srcW) / 2);
  } else {
    // too tall → crop top/bottom (TOP-SAFE, avoid cutting head)
    const newH = Math.floor(img.width / targetRatio);

    const topSafeRatio = 0.1; // ✅ keep more top, crop more bottom
    srcY = Math.floor((img.height - newH) * topSafeRatio);
    srcY = Math.max(0, Math.min(srcY, img.height - newH));

    srcH = newH;
  }

  const canvasWidth = srcW;
  const canvasHeight = srcH;

  return {
    canvasWidth,
    canvasHeight,
    srcX,
    srcY,
    srcW,
    srcH,
    dstW: canvasWidth,
    dstH: canvasHeight,
    wasCorrected: true,
  };
};

export const compressImage = async (
  file: File,
  options?: {
    maxBytes?: number;
    maxWidth?: number;
    qualityStep?: number;
    targetAspectRatio?: number;
    correctAspectRatio?: boolean;
    keepOriginalFile?: boolean;
    verticalBiasPx?: number; // optional: move content DOWN in preview
  }
): Promise<{ file: File; dataUrl: string; wasConverted?: boolean }> => {
  const maxBytes = options?.maxBytes ?? 5 * 1024 * 1024;
  const maxWidth = options?.maxWidth ?? 2000;
  const qualityStep = options?.qualityStep ?? 0.08;
  const targetAspectRatio = options?.targetAspectRatio ?? 2 / 1;
  const shouldCorrectAspectRatio = options?.correctAspectRatio ?? false;
  const keepOriginalFile = options?.keepOriginalFile ?? true;

  // Read file -> dataURL
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // dataURL -> <img>
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = originalDataUrl;
  });

  // Optional: shift preview content down slightly (avoid cutting head)
  const verticalBiasPx = options?.verticalBiasPx ?? 0;

  // Decide crop rect (crop like object-cover, no white bars)
  const crop = getCropRectForAspectRatio(
    img.width,
    img.height,
    shouldCorrectAspectRatio ? targetAspectRatio : null,
    verticalBiasPx,
    160 // preview header height (px)
  );

  // Output size (based on crop size) and clamp to maxWidth
  let outW = crop.srcW;
  let outH = crop.srcH;

  if (outW > maxWidth) {
    const scale = maxWidth / outW;
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }

  // Canvas render
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to get canvas context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    img,
    crop.srcX,
    crop.srcY,
    crop.srcW,
    crop.srcH,
    0,
    0,
    outW,
    outH
  );

  // Use JPEG for most cases to reduce size, keep PNG if original was PNG
  const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  let quality = outMime === 'image/png' ? undefined : 0.92;

  const toBlob = (q?: number) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Failed to create blob'));
          resolve(blob);
        },
        outMime,
        q
      );
    });

  let blob = await toBlob(quality);

  // Reduce JPEG quality if still too big
  if (outMime === 'image/jpeg') {
    while (blob.size > maxBytes && (quality ?? 0) > 0.4) {
      quality = Math.max(0.4, (quality ?? 0.92) - qualityStep);
      blob = await toBlob(quality);
    }
  }

  const previewDataUrl = canvas.toDataURL(
    outMime,
    outMime === 'image/jpeg' ? quality : undefined
  );

  const outFile = new File(
    [blob],
    file.name.replace(/\.\w+$/, '') +
      (outMime === 'image/png' ? '.png' : '.jpg'),
    { type: outMime }
  );

  // ✅ Correct wasConverted (no precedence bug)
  const wasConverted =
    (shouldCorrectAspectRatio && crop.wasCropped) ||
    outFile.type !== file.type ||
    blob.size !== file.size;

  return {
    file: keepOriginalFile ? file : outFile, // upload original if true
    dataUrl: previewDataUrl, // preview uses converted
    wasConverted,
  };
};

/**
 * Returns a center-crop rectangle to match target aspect ratio (like object-cover).
 * If targetRatio is null => no cropping.
 */
function getCropRectForAspectRatio(
  srcW: number,
  srcH: number,
  targetRatio: number | null,
  verticalBiasPx: number = 0, // optional (can shift slightly)
  previewHeightPx: number = 160 // mobile header height
): {
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  wasCropped: boolean;
} {
  if (!targetRatio) {
    return { srcX: 0, srcY: 0, srcW, srcH, wasCropped: false };
  }

  const currentRatio = srcW / srcH;
  const tolerance = 0.01;
  if (Math.abs(currentRatio - targetRatio) <= tolerance) {
    return { srcX: 0, srcY: 0, srcW, srcH, wasCropped: false };
  }

  // 1) Too wide -> crop left/right (center)
  if (currentRatio > targetRatio) {
    const newW = Math.floor(srcH * targetRatio);
    const x = Math.floor((srcW - newW) / 2);
    return { srcX: x, srcY: 0, srcW: newW, srcH, wasCropped: true };
  }

  // 2) Too tall -> crop TOP-SAFE (cut bottom instead)
  const newH = Math.floor(srcW / targetRatio);

  // ✅ IMPORTANT: anchor to TOP (no top cut)
  // let y = 0

  // Optional: if you want tiny top cut (like 2%):
  const topCutRatio = 0.1; // 0 = no cut top, 0.02 = cut 2% from top
  // y = Math.floor((srcH - newH) * topCutRatio)

  // Optional: allow shifting DOWN by a few px (very small)
  // Positive verticalBiasPx should reduce y? No—because y=0 already.
  // We keep y=0 always to protect head.

  // Clamp
  let y = Math.floor((srcH - newH) * topCutRatio);

  return { srcX: 0, srcY: y, srcW, srcH: newH, wasCropped: true };
}

export const handleFileSelect = (
  event: Event,
  onFileSelect: (file: File) => void
) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    onFileSelect(file);
  }
};

export const handleFileDrop = (
  event: DragEvent,
  onFileDrop: (file: File) => void
) => {
  event.preventDefault();
  const file = event.dataTransfer?.files[0];
  if (file) {
    onFileDrop(file);
  }
};

export const triggerFileUpload = (fileInput: HTMLInputElement | undefined) => {
  fileInput?.click();
};
