import { Injectable, OnModuleInit } from '@nestjs/common';
import { getApp, initializeApp, App } from 'firebase-admin/app';
import { cert } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import * as fs from 'fs';
import * as path from 'path';
import { BakongApp } from '@bakong/shared';
/**
 * FirebaseManager manages multiple Firebase apps for different Bakong platforms
 * Each platform (BAKONG, BAKONG_JUNIOR, BAKONG_TOURIST) has separate Firebase projects
 * for SIT and Production environments
 */
@Injectable()
export class FirebaseManager implements OnModuleInit {
  private static apps: Map<string, App> = new Map();
  private static messagingInstances: Map<string, Messaging> = new Map();
  private static initialized = false;
  async onModuleInit() {
    await FirebaseManager.initializeAll();
  }

  /**
   * Initialize all Firebase apps for all platforms and environments
   */
  static async initializeAll(): Promise<{ success: number; failed: number }> {
    if (FirebaseManager.initialized) {
      // Logging removed
      return { success: FirebaseManager.apps.size, failed: 0 };
    }
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isStaging = nodeEnv === 'staging';
    const isProduction = nodeEnv === 'production';
    // Logging removed
    const platforms: BakongApp[] = [
      BakongApp.BAKONG,
      BakongApp.BAKONG_JUNIOR,
      BakongApp.BAKONG_TOURIST,
    ];
    let successCount = 0;
    let failedCount = 0;
    for (const platform of platforms) {
      try {
        const appName = FirebaseManager.getAppName(platform);
        const serviceAccountPath =
          FirebaseManager.getServiceAccountPath(platform);
        if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
          // Logging removed
          failedCount++;
          continue;
        }
        try {
          const existingApp = getApp(appName);
          // Logging removed
          FirebaseManager.apps.set(appName, existingApp);
          successCount++;
          continue;
        } catch (e) {}
        const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        if (
          !serviceAccount.project_id ||
          !serviceAccount.private_key ||
          !serviceAccount.client_email
        ) {
          // Logging removed
          failedCount++;
          continue;
        }
        const app = initializeApp(
          {
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id,
          },
          appName
        );
        FirebaseManager.apps.set(appName, app);
        const messaging = getMessaging(app);
        FirebaseManager.messagingInstances.set(appName, messaging);
        // Logging removed
        successCount++;
      } catch (error: any) {
        // Logging removed
        failedCount++;
      }
    }
    FirebaseManager.initialized = true;
    // Logging removed
    return { success: successCount, failed: failedCount };
  }

  /**
   * Get Firebase Messaging instance for a specific Bakong platform
   * Falls back to default app if platform-specific app is not available
   */
  static getMessaging(bakongPlatform?: string | null): Messaging | null {
    if (!bakongPlatform) {
      try {
        return getMessaging();
      } catch (e) {
        // Logging removed
        return null;
      }
    }
    const appName = FirebaseManager.getAppName(bakongPlatform);
    const messaging = FirebaseManager.messagingInstances.get(appName);
    if (messaging) {
      return messaging;
    }
    const app = FirebaseManager.apps.get(appName);
    if (app) {
      try {
        const messagingInstance = getMessaging(app);
        FirebaseManager.messagingInstances.set(appName, messagingInstance);
        return messagingInstance;
      } catch (e) {
        // Logging removed
      }
    }
    // Logging removed
    try {
      return getMessaging();
    } catch (e) {
      // Logging removed
      return null;
    }
  }

  /**
   * Get Firebase app name for a Bakong platform
   */
  static getAppName(bakongPlatform: string): string {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isStaging = nodeEnv === 'staging';
    const isProduction = nodeEnv === 'production';
    let envSuffix = 'dev';
    if (isStaging) envSuffix = 'sit';
    if (isProduction) envSuffix = 'uat';
    const platformKey = bakongPlatform.toLowerCase().replace('_', '-');
    return `${platformKey}-${envSuffix}`;
  }

  /**
   * Get service account file path for a Bakong platform
   */
  static getServiceAccountPath(bakongPlatform: string): string | null {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isStaging = nodeEnv === 'staging';
    const isProduction = nodeEnv === 'production';
    let fileName: string;
    if (isStaging) {
      switch (bakongPlatform) {
        case BakongApp.BAKONG:
          fileName = 'bakong-sit-firebase-service-account.json';
          break;
        case BakongApp.BAKONG_JUNIOR:
          fileName = 'bakong-junior-sit-firebase-service-account.json';
          break;
        case BakongApp.BAKONG_TOURIST:
          fileName = 'bakong-tourists-sit-firebase-service-account.json';
          break;
        default:
          fileName = 'bakong-sit-firebase-service-account.json';
      }
    } else if (isProduction) {
      switch (bakongPlatform) {
        case BakongApp.BAKONG:
          fileName = 'bakong-uat-firebase-service-account.json';
          break;
        case BakongApp.BAKONG_JUNIOR:
          fileName = 'bakong-junior-uat-firebase-service-account.json';
          break;
        case BakongApp.BAKONG_TOURIST:
          fileName = 'bakong-tourist-uat-firebase-service-account.json';
          break;
        default:
          fileName = 'bakong-uat-firebase-service-account.json';
      }
    } else {
      switch (bakongPlatform) {
        case BakongApp.BAKONG:
          fileName = 'bakong-sit-firebase-service-account.json';
          break;
        case BakongApp.BAKONG_JUNIOR:
          fileName = 'bakong-junior-sit-firebase-service-account.json';
          break;
        case BakongApp.BAKONG_TOURIST:
          fileName = 'bakong-tourists-sit-firebase-service-account.json';
          break;
        default:
          fileName = 'firebase-service-account.json';
      }
      const cwd = process.cwd();
      const searchPaths = [
        path.join(cwd, fileName),
        path.join(cwd, `../../${fileName}`),
        path.join(cwd, `../${fileName}`),
        path.join(__dirname, `../${fileName}`),
        path.join(__dirname, `../../${fileName}`),
        path.join(__dirname, `../../../${fileName}`),
      ];
      let foundPath: string | null = null;
      for (const p of searchPaths) {
        if (fs.existsSync(p)) {
          foundPath = p;
          break;
        }
      }
      if (!foundPath) {
        fileName = 'firebase-service-account.json';
      }
    }
    const cwd = process.cwd();
    const possiblePaths = [
      `/opt/bk_notification_service/${fileName}`,
      path.join(cwd, `../../${fileName}`),
      path.join(cwd, `../${fileName}`),
      path.join(cwd, fileName),
      path.join(__dirname, `../${fileName}`),
      path.join(__dirname, `../../${fileName}`),
      path.join(__dirname, `../../../${fileName}`),
      path.join(__dirname, `../../../../${fileName}`),
    ];
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }
    return null;
  }

  /**
   * Get all initialized Firebase apps
   */
  static getInitializedApps(): string[] {
    return Array.from(FirebaseManager.apps.keys());
  }

  /**
   * Check if a specific platform's Firebase app is initialized
   */
  static isPlatformInitialized(bakongPlatform: string): boolean {
    const appName = FirebaseManager.getAppName(bakongPlatform);
    return FirebaseManager.apps.has(appName);
  }
}
