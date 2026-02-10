import { BakongUser } from 'src/entities/bakong-user.entity';
import { Logger } from '@nestjs/common';
import { ValidationHelper } from './validation.helper';
import { Repository } from 'typeorm';
import { cert, initializeApp, getApps } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';
import { BakongApp } from '@bakong/shared';
type SingleUserSyncResult = {
  isNewUser: boolean;
  savedUser: BakongUser;
  dataUpdated?: boolean;
};
type AllUsersSyncResult = {
  updatedCount: number;
  totalCount: number;
  platformUpdates: number;
  languageUpdates: number;
  invalidTokens: number;
  updatedIds: string[];
};
export class BaseFunctionHelper {
  bkUserRepo: Repository<BakongUser>;
  logger: Logger;
  constructor(bkUserRepo: Repository<BakongUser>, logger: Logger) {
    this.bkUserRepo = bkUserRepo;
    this.logger = logger;
  }

  truncateText(field: 'title' | 'content', text: string): string {
    const length = field === 'title' ? 60 : 90;
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  getBaseUrl(req?: any): string {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const defaultBaseUrl =
      nodeEnv === 'development'
        ? 'http://localhost:4005'
        : nodeEnv === 'staging'
        ? 'http://10.20.6.57:4002'
        : 'https://10.20.6.58:8080';
    let baseUrl = defaultBaseUrl;
    if (req) {
      let protocol = req.protocol || (req.secure ? 'https' : 'http');
      const host = req.get('host') || req.headers?.host;
      if (host) {
        const isProductionDomain =
          host.includes('nbc.gov.kh') ||
          host.includes('bakong-notification') ||
          nodeEnv === 'production' ||
          nodeEnv === 'staging';
        if (isProductionDomain && protocol === 'http') {
          const forwardedProto =
            req.get('x-forwarded-proto') || req.headers?.['x-forwarded-proto'];
          if (forwardedProto === 'https' || nodeEnv === 'production') {
            protocol = 'https';
          }
        }
        baseUrl = `${protocol}://${host}`;
      }
    }
    if (!baseUrl || baseUrl === defaultBaseUrl) {
      baseUrl =
        process.env.HOSTING_BASE_URL ||
        process.env.API_BASE_URL ||
        defaultBaseUrl;
    }
    if (
      baseUrl.includes('nbc.gov.kh') ||
      baseUrl.includes('bakong-notification')
    ) {
      baseUrl = baseUrl.replace(/^http:/, 'https:');
    }
    return baseUrl;
  }

  async findUserByAccountId(accountId: string): Promise<BakongUser | null> {
    return this.bkUserRepo
      .createQueryBuilder('user')
      .where('user.accountId = :accountId', { accountId })
      .getOne();
  }

  async updateUserData(
    updateData?: Partial<BakongUser>
  ): Promise<SingleUserSyncResult | AllUsersSyncResult> {
    return updateData ? this.syncUser(updateData) : this.syncAllUsers();
  }

  async syncUser(
    updateData: Partial<BakongUser>
  ): Promise<SingleUserSyncResult> {
    const { accountId } = updateData;
    if (!accountId)
      throw new Error('accountId is required for single-user sync');
    let user = await this.findUserByAccountId(accountId);
    const isNewUser = !user;
    if (user) {
      const updatesToApply: any = {};
      if (
        updateData.fcmToken !== undefined &&
        updateData.fcmToken !== null &&
        updateData.fcmToken !== '' &&
        updateData.fcmToken.length >= 30
      ) {
        const currentToken = user.fcmToken || '';
        const newToken = updateData.fcmToken;
        if (newToken.length < 50) {
          console.warn(
            `⚠️ [syncUser] User ${accountId} provided suspiciously short fcmToken: "${newToken}" (length: ${newToken.length}). This might be invalid!`
          );
        }
        updatesToApply.fcmToken = updateData.fcmToken;
        console.log(
          `📝 [syncUser] fcmToken WILL BE UPDATED for user ${accountId}:`,
          {
            current: currentToken
              ? `${currentToken.substring(0, 30)}... (length: ${
                  currentToken.length
                })`
              : 'EMPTY',
            new: newToken
              ? `${newToken.substring(0, 30)}... (length: ${newToken.length})`
              : 'EMPTY',
            tokensMatch: currentToken.trim() === newToken.trim(),
            willUpdate: true,
          }
        );
      } else if (updateData.fcmToken !== undefined) {
        console.log(
          `⏭️ [syncUser] Skipping fcmToken update for user ${accountId} (null, empty, or too short - preserving existing token)`
        );
      } else {
        console.log(
          `⏭️ [syncUser] Skipping fcmToken update for user ${accountId} (not provided in sync data - undefined)`
        );
      }
      if (
        updateData.participantCode !== undefined &&
        updateData.participantCode !== null &&
        updateData.participantCode !== ''
      ) {
        updatesToApply.participantCode = updateData.participantCode;
      } else if (updateData.participantCode !== undefined) {
        console.log(
          `⏭️ [syncUser] Skipping participantCode update for user ${accountId} (null or empty - preserving existing value)`
        );
      }
      if (updateData.platform !== undefined && updateData.platform !== null) {
        updatesToApply.platform = this.normalizePlatform(updateData.platform);
      } else if (updateData.platform !== undefined) {
        console.log(
          `⏭️ [syncUser] Skipping platform update for user ${accountId} (null - preserving existing value)`
        );
      }
      if (updateData.language !== undefined && updateData.language !== null) {
        updatesToApply.language = this.normalizeLanguage(updateData.language);
      } else if (updateData.language !== undefined) {
        console.log(
          `⏭️ [syncUser] Skipping language update for user ${accountId} (null - preserving existing value)`
        );
      }
      if (
        updateData.bakongPlatform !== undefined &&
        updateData.bakongPlatform !== null
      ) {
        updatesToApply.bakongPlatform = updateData.bakongPlatform;
        console.log(
          `📝 [syncUser] Updating user ${accountId} bakongPlatform: ${
            user.bakongPlatform || 'NULL'
          } -> ${updateData.bakongPlatform}`
        );
      } else if (updateData.bakongPlatform !== undefined) {
        console.log(
          `⏭️ [syncUser] Skipping bakongPlatform update for user ${accountId} (null or empty - preserving existing value)`
        );
      }
      try {
        const isTouristPlatform =
          updatesToApply.bakongPlatform === BakongApp.BAKONG_TOURIST ||
          user?.bakongPlatform === BakongApp.BAKONG_TOURIST ||
          updateData.bakongPlatform === BakongApp.BAKONG_TOURIST;
        if (isTouristPlatform) {
          updatesToApply.language = this.normalizeLanguage('EN');
          console.log(
            `🔒 [syncUser] Coerced language to EN for BAKONG_TOURIST user ${accountId}`
          );
        }
      } catch (e) {
        console.error(
          `❌ [syncUser] Error coercing language for ${accountId}:`,
          e
        );
      }
      console.log(
        `🔍 [syncUser] About to call updateUserFields with updatesToApply:`,
        {
          accountId,
          updatesToApply: {
            fcmToken: updatesToApply.fcmToken
              ? `${updatesToApply.fcmToken.substring(0, 30)}... (length: ${
                  updatesToApply.fcmToken.length
                })`
              : updatesToApply.fcmToken === ''
              ? 'EMPTY STRING'
              : 'NOT IN updatesToApply',
            participantCode:
              updatesToApply.participantCode || 'NOT IN updatesToApply',
            platform: updatesToApply.platform || 'NOT IN updatesToApply',
            language: updatesToApply.language || 'NOT IN updatesToApply',
            bakongPlatform:
              updatesToApply.bakongPlatform || 'NOT IN updatesToApply',
          },
          currentUserState: {
            fcmToken: user.fcmToken
              ? `${user.fcmToken.substring(0, 30)}... (length: ${
                  user.fcmToken.length
                })`
              : 'EMPTY',
            participantCode: user.participantCode || 'NULL',
            platform: user.platform || 'NULL',
            language: user.language || 'NULL',
            bakongPlatform: user.bakongPlatform || 'NULL',
          },
        }
      );
      ValidationHelper.updateUserFields(user, updatesToApply);
      console.log(`🔍 [syncUser] After updateUserFields (in-memory):`, {
        accountId,
        userStateAfterUpdate: {
          fcmToken: user.fcmToken
            ? `${user.fcmToken.substring(0, 30)}... (length: ${
                user.fcmToken.length
              })`
            : 'EMPTY',
          participantCode: user.participantCode || 'NULL',
          platform: user.platform || 'NULL',
          language: user.language || 'NULL',
          bakongPlatform: user.bakongPlatform || 'NULL',
        },
      });
      let dataChanged = false;
      if (Object.keys(updatesToApply).length > 0) {
        if (updatesToApply.fcmToken !== undefined) {
          const currentToken = (user.fcmToken || '').trim();
          const newToken = (updatesToApply.fcmToken || '').trim();
          if (currentToken !== newToken) {
            dataChanged = true;
          }
        }
        if (
          updatesToApply.platform !== undefined &&
          user.platform !== updatesToApply.platform
        ) {
          dataChanged = true;
        }
        if (
          updatesToApply.language !== undefined &&
          user.language !== updatesToApply.language
        ) {
          dataChanged = true;
        }
        if (
          updatesToApply.bakongPlatform !== undefined &&
          user.bakongPlatform !== updatesToApply.bakongPlatform
        ) {
          dataChanged = true;
        }
        if (
          updatesToApply.participantCode !== undefined &&
          user.participantCode !== updatesToApply.participantCode
        ) {
          dataChanged = true;
        }
      }
      if (Object.keys(updatesToApply).length > 0) {
        console.log(
          `💾 [syncUser] Updating user ${accountId} in database with:`,
          Object.keys(updatesToApply),
          `(dataChanged: ${dataChanged})`
        );
        try {
          const fieldsUpdated = Object.keys(updatesToApply).filter(
            (key) => key !== 'syncStatus'
          );
          const hasRealUpdates = fieldsUpdated.length > 0;
          let syncMessage = '';
          if (hasRealUpdates) {
            if (dataChanged) {
              syncMessage = `Existing user updated: ${fieldsUpdated.join(
                ', '
              )} changed`;
            } else {
              syncMessage = `Existing user updated: ${fieldsUpdated.join(
                ', '
              )} synced`;
            }
          } else {
            syncMessage = 'Existing user synced: no data changes';
          }
          const syncStatusUpdate = {
            status: 'SUCCESS' as const,
            lastSyncAt: new Date().toISOString(),
            lastSyncMessage: syncMessage,
          };
          updatesToApply.syncStatus = syncStatusUpdate;
          if (hasRealUpdates) {
            dataChanged = true;
          }
          const updateResult = await this.bkUserRepo.update(
            { accountId },
            updatesToApply
          );
          console.log(
            `✅ [syncUser] Direct update() executed for ${accountId}. Rows affected: ${
              updateResult.affected || 0
            }`
          );
          await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay to ensure DB commit
          user = await this.bkUserRepo
            .createQueryBuilder('user')
            .where('user.accountId = :accountId', { accountId })
            .getOne();
          if (!user) {
            throw new Error(`User ${accountId} not found after update`);
          }
          console.log(
            `✅ [syncUser] Successfully updated and reloaded user ${accountId}. Current fcmToken: ${
              user.fcmToken
                ? `${user.fcmToken.substring(0, 30)}... (length: ${
                    user.fcmToken.length
                  })`
                : 'EMPTY'
            }, bakongPlatform: ${user.bakongPlatform || 'NULL'}`
          );
          const expectedToken = updatesToApply.fcmToken;
          if (expectedToken !== undefined) {
            const actualToken = user.fcmToken;
            if (actualToken !== expectedToken) {
              console.error(
                `❌ [syncUser] CRITICAL: Token mismatch after update! Expected: ${
                  expectedToken
                    ? `${expectedToken.substring(0, 30)}...`
                    : 'EMPTY'
                }, Got: ${
                  actualToken ? `${actualToken.substring(0, 30)}...` : 'EMPTY'
                }`
              );
              console.log(
                `🔄 [syncUser] Retrying update with explicit fcmToken for ${accountId}...`
              );
              await this.bkUserRepo.update(
                { accountId },
                { fcmToken: expectedToken }
              );
              await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay
              user = await this.bkUserRepo
                .createQueryBuilder('user')
                .where('user.accountId = :accountId', { accountId })
                .getOne();
              console.log(
                `🔄 [syncUser] Retry update completed. Final fcmToken: ${
                  user?.fcmToken
                    ? `${user.fcmToken.substring(0, 30)}... (length: ${
                        user.fcmToken.length
                      })`
                    : 'EMPTY'
                }`
              );
            } else {
              console.log(
                `✅ [syncUser] Token verification passed: ${
                  actualToken ? `${actualToken.substring(0, 30)}...` : 'EMPTY'
                }`
              );
            }
          }
        } catch (updateError: any) {
          console.error(
            `❌ [syncUser] ERROR updating user ${accountId} in database:`,
            updateError.message,
            updateError.stack
          );
          try {
            await this.bkUserRepo.update(
              { accountId },
              {
                syncStatus: {
                  status: 'FAILED',
                  lastSyncAt: new Date().toISOString(),
                  lastSyncMessage: `Database error: ${updateError.message}`,
                },
              }
            );
          } catch (statusUpdateError) {
            console.error(
              `❌ [syncUser] Failed to update sync status for ${accountId}:`,
              statusUpdateError
            );
          }
          throw updateError;
        }
      } else {
        console.log(
          `⏭️ [syncUser] No updates to apply for user ${accountId} (updatesToApply is empty)`
        );
        dataChanged = false;
        try {
          await this.bkUserRepo.update(
            { accountId },
            {
              syncStatus: {
                status: 'SUCCESS',
                lastSyncAt: new Date().toISOString(),
                lastSyncMessage: 'Existing user synced: no data changes',
              },
            }
          );
        } catch (statusUpdateError) {
          console.error(
            `❌ [syncUser] Failed to update sync status for ${accountId}:`,
            statusUpdateError
          );
        }
      }
      return { isNewUser, savedUser: user, dataUpdated: dataChanged };
    }
    try {
      const created = this.bkUserRepo.create({
        accountId,
        fcmToken: updateData.fcmToken || '', // Use empty string as placeholder if not provided
        participantCode: updateData.participantCode,
        platform: this.normalizePlatform(updateData.platform),
        language:
          updateData.bakongPlatform === BakongApp.BAKONG_TOURIST
            ? this.normalizeLanguage('EN')
            : this.normalizeLanguage(updateData.language),
        bakongPlatform: updateData.bakongPlatform, // Only set if explicitly provided
        syncStatus: {
          status: 'SUCCESS',
          lastSyncAt: new Date().toISOString(),
          lastSyncMessage: `New user created: ${
            updateData.bakongPlatform || 'no platform'
          } platform`,
        },
      });
      console.log(
        `📝 [syncUser] Creating new user ${accountId} with bakongPlatform: ${
          updateData.bakongPlatform || 'NULL'
        }`
      );
      const savedUser = await this.bkUserRepo.save(created);
      console.log(
        `✅ [syncUser] Created user ${accountId} with bakongPlatform: ${
          savedUser.bakongPlatform || 'NULL'
        }`
      );
      return { isNewUser, savedUser };
    } catch (createError: any) {
      console.error(
        `❌ [syncUser] ERROR creating new user ${accountId}:`,
        createError.message,
        createError.stack
      );
      try {
        const existingUser = await this.findUserByAccountId(accountId);
        if (existingUser) {
          await this.bkUserRepo.update(
            { accountId },
            {
              syncStatus: {
                status: 'FAILED',
                lastSyncAt: new Date().toISOString(),
                lastSyncMessage: `Failed to create user: ${createError.message}`,
              },
            }
          );
        }
      } catch (statusUpdateError) {}
      throw createError;
    }
  }

  async syncAllUsers(): Promise<AllUsersSyncResult> {
    const users = await this.bkUserRepo.find();
    const stats: Omit<AllUsersSyncResult, 'updatedIds'> = {
      updatedCount: 0,
      totalCount: users.length,
      platformUpdates: 0,
      languageUpdates: 0,
      invalidTokens: 0,
    };
    const updatedIds: string[] = [];
    const cleanedTokens: string[] = [];
    for (const user of users) {
      let userChanged = false;
      const changed = ValidationHelper.normalizeUserFields(user, stats);
      if (changed) {
        userChanged = true;
      }
      if (user.fcmToken?.trim()) {
        const isTooShort = user.fcmToken.length < 50;
        const hasInvalidFormat = !ValidationHelper.isValidFCMTokenFormat(
          user.fcmToken
        );
        if (isTooShort || hasInvalidFormat) {
          stats.invalidTokens++;
          const reason = isTooShort
            ? `too short (${user.fcmToken.length} chars)`
            : 'invalid format';
          console.log(
            `🧹 [syncAllUsers] Warn: user ${user.accountId} has invalid token format (${reason}). PRESERVING for historical data.`
          );
        } else {
        }
      }
      if (userChanged) {
        try {
          await this.bkUserRepo.save(user);
          stats.updatedCount++;
          updatedIds.push(user.accountId);
        } catch (e) {
          this.logger.error(`Failed to save user ${user.accountId}`, e as any);
        }
      }
    }
    if (cleanedTokens.length > 0) {
      console.log(
        `✅ [syncAllUsers] Cleaned up ${cleanedTokens.length} invalid token(s):`,
        cleanedTokens
      );
    }
    return { ...stats, updatedIds };
  }

  filterValidFCMUsers(
    validUsers: BakongUser[],
    mode: 'individual' | 'shared'
  ): BakongUser[] {
    if (mode === 'shared') {
      return validUsers.filter((user) => {
        const isValidToken =
          user.fcmToken &&
          user.fcmToken.length > 50 &&
          !user.fcmToken.startsWith('Bearer') &&
          !user.fcmToken.startsWith('eyJ');
        if (!isValidToken) {
          this.logger.warn(`⚠️ Skip ${user.accountId}: invalid FCM token`);
        }
        return isValidToken;
      });
    }
    return validUsers;
  }

  normalizeUserFields(
    user: any,
    result?: { platformUpdates: number; languageUpdates: number }
  ): boolean {
    return ValidationHelper.normalizeUserFields(user, result);
  }

  updateUserFields(user: any, updates: any): boolean {
    return ValidationHelper.updateUserFields(user, updates);
  }

  private normalizePlatform(platform?: any) {
    const res = ValidationHelper.validatePlatform(platform);
    return res.isValid ? res.normalizedValue : platform;
  }

  private normalizeLanguage(language?: any) {
    const res = ValidationHelper.validateLanguage(language);
    return res.isValid ? res.normalizedValue : language;
  }

  static getFirebaseServiceAccountPaths(): string[] {
    const cwd = process.cwd();
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isStaging = nodeEnv === 'staging';
    const isProduction = nodeEnv === 'production';
    let envSpecificFileName = 'firebase-service-account.json'; // default for development
    if (isStaging) {
      envSpecificFileName = 'bakong-sit-firebase-service-account.json';
    } else if (isProduction) {
      envSpecificFileName = 'bakong-uat-firebase-service-account.json';
    }
    const paths = [
      `/opt/bk_notification_service/${envSpecificFileName}`,
      path.join(cwd, `../../${envSpecificFileName}`),
      path.join(cwd, `../${envSpecificFileName}`),
      path.join(cwd, envSpecificFileName),
      path.join(__dirname, `../${envSpecificFileName}`),
      path.join(__dirname, `../../${envSpecificFileName}`),
      path.join(__dirname, `../../../${envSpecificFileName}`),
      path.join(__dirname, `../../../../${envSpecificFileName}`),
      path.join(__dirname, envSpecificFileName),
      '/opt/bk_notification_service/firebase-service-account.json',
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.join(cwd, '../../firebase-service-account.json'),
      path.join(cwd, '../firebase-service-account.json'),
      path.join(cwd, 'firebase-service-account.json'),
      path.join(__dirname, '../firebase-service-account.json'),
      path.join(__dirname, '../../firebase-service-account.json'),
      path.join(__dirname, '../../../firebase-service-account.json'),
      path.join(__dirname, '../../../../firebase-service-account.json'),
      path.join(__dirname, 'firebase-service-account.json'),
    ];
    return paths.filter((p) => p != null) as string[];
  }

  static findFirebaseServiceAccountPath(): string | null {
    const possiblePaths = this.getFirebaseServiceAccountPaths();
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }
    return null;
  }

  /**
   * Safely serialize an object for logging by truncating buffers and large arrays
   * @param obj The object to serialize
   * @param maxArrayLength Maximum length for arrays before truncation (default: 10)
   * @param maxBufferPreview Maximum bytes to show from buffers (default: 50)
   * @returns A safe object for logging
   */
  static safeLogObject(
    obj: any,
    maxArrayLength = 10,
    maxBufferPreview = 50
  ): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (Buffer.isBuffer(obj)) {
      const preview = obj.slice(0, maxBufferPreview);
      return `<Buffer[${obj.length} bytes]: ${Array.from(preview).join(',')}${
        obj.length > maxBufferPreview ? '...' : ''
      }>`;
    }
    if (Array.isArray(obj)) {
      if (obj.length > maxArrayLength) {
        return [
          ...obj
            .slice(0, maxArrayLength)
            .map((item) =>
              this.safeLogObject(item, maxArrayLength, maxBufferPreview)
            ),
          `... (${obj.length - maxArrayLength} more items)`,
        ];
      }
      return obj.map((item) =>
        this.safeLogObject(item, maxArrayLength, maxBufferPreview)
      );
    }
    if (typeof obj === 'object' && obj.constructor === Object) {
      const safeObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'file' && Buffer.isBuffer(value)) {
          safeObj[key] = `<Buffer[${value.length} bytes] (truncated)>`;
        } else if (Array.isArray(value) && value.length > 100) {
          safeObj[key] = `<Array[${value.length} items] (truncated)>`;
        } else {
          safeObj[key] = this.safeLogObject(
            value,
            maxArrayLength,
            maxBufferPreview
          );
        }
      }
      return safeObj;
    }
    return obj;
  }

  static async initializeFirebase(): Promise<boolean> {
    try {
      const possiblePaths = this.getFirebaseServiceAccountPaths();
      console.log(
        '[Firebase Init] Checking service account paths:',
        possiblePaths
      );
      const serviceAccountPath = this.findFirebaseServiceAccountPath();
      if (!serviceAccountPath) {
        console.error(
          '[Firebase Init] No service account JSON found at any candidate paths.'
        );
        console.error(
          '[Firebase Init] Current working directory:',
          process.cwd()
        );
        console.error('[Firebase Init] __dirname:', __dirname);
        return false;
      }
      try {
        const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
        let serviceAccount;
        try {
          serviceAccount = JSON.parse(fileContent);
        } catch (parseErr) {
          console.error('[Firebase Init] Failed to parse JSON:', parseErr);
          console.error(
            '[Firebase Init] JSON parse error details:',
            parseErr instanceof Error ? parseErr.message : String(parseErr)
          );
          return false;
        }
        if (!serviceAccount.project_id) {
          console.error(
            '[Firebase Init] Service account file missing project_id field'
          );
          return false;
        }
        if (!serviceAccount.private_key) {
          console.error(
            '[Firebase Init] Service account file missing private_key field'
          );
          return false;
        }
        if (!serviceAccount.client_email) {
          console.error(
            '[Firebase Init] Service account file missing client_email field'
          );
          return false;
        }
        try {
          const apps = getApps();
          if (apps.length === 0) {
            initializeApp({
              credential: cert(serviceAccount),
              projectId: serviceAccount.project_id,
            });
          } else {
          }
          return true;
        } catch (initError: any) {
          console.error('[Firebase Init] Failed to initialize Firebase app');
          console.error(
            '[Firebase Init] Error message:',
            initError?.message || String(initError)
          );
          console.error(
            '[Firebase Init] Error code:',
            initError?.code || 'N/A'
          );
          if (initError?.stack) {
            console.error('[Firebase Init] Stack trace:', initError.stack);
          }
          return false;
        }
      } catch (readFileError: any) {
        console.error('[Firebase Init] Could not read service account file');
        console.error(
          '[Firebase Init] Error:',
          readFileError?.message || String(readFileError)
        );
        console.error('[Firebase Init] File path:', serviceAccountPath);
        return false;
      }
    } catch (error: any) {
      console.error(
        '[Firebase Init] Unexpected error:',
        error?.message || String(error)
      );
      if (error?.stack) {
        console.error('[Firebase Init] Stack trace:', error.stack);
      }
      return false;
    }
  }
}
