/**
 * 공용 앱 정보 조회 헬퍼 함수
 * App Store와 Google Play에서 앱 정보 및 지원 언어 정보를 가져옵니다.
 */

import { getAppStoreClient, type AppStoreClient } from "@packages/app-store";
import { GooglePlayClient } from "@packages/play-store";
import type { AppStoreConfig, PlayStoreConfig } from "./config";
import type {
  RegisteredAppStoreInfo,
  RegisteredGooglePlayInfo,
} from "./registered-apps";

export interface AppStoreAppInfo {
  found: boolean;
  appId?: string;
  name?: string;
  supportedLocales?: string[];
}

export interface GooglePlayAppInfo {
  found: boolean;
  name?: string;
  supportedLocales?: string[];
}

/**
 * App Store에서 앱 정보 및 지원 언어 정보 가져오기
 */
export async function fetchAppStoreAppInfo({
  bundleId,
  config,
  client,
}: {
  bundleId: string;
  config?: AppStoreConfig;
  client?: AppStoreClient;
}): Promise<AppStoreAppInfo> {
  if (!config && !client) {
    return { found: false };
  }

  try {
    const appStoreClient =
      client ||
      getAppStoreClient({
        ...config!,
        bundleId: "dummy", // listAllApps() does not use bundleId
      });

    const apps = await appStoreClient.listAllApps({ onlyReleased: true });
    const app = apps.find((a) => a.bundleId === bundleId);

    if (!app) {
      return { found: false };
    }

    // 지원 언어 정보 가져오기
    const supportedLocales = await appStoreClient.getSupportedLocales(app.id);

    return {
      found: true,
      appId: app.id,
      name: app.name,
      supportedLocales,
    };
  } catch {
    return { found: false };
  }
}

/**
 * Google Play에서 앱 정보 및 지원 언어 정보 가져오기
 */
export async function fetchGooglePlayAppInfo({
  packageName,
  config,
}: {
  packageName: string;
  config?: PlayStoreConfig;
}): Promise<GooglePlayAppInfo> {
  if (!config?.serviceAccountJson) {
    return { found: false };
  }

  try {
    const serviceAccount = JSON.parse(config.serviceAccountJson);
    const client = new GooglePlayClient({
      packageName,
      serviceAccountKey: serviceAccount,
    });

    const appInfo = await client.verifyAppAccess();

    return {
      found: true,
      name: appInfo.title,
      supportedLocales: appInfo.supportedLocales,
    };
  } catch {
    return { found: false };
  }
}

/**
 * App Store 정보를 RegisteredAppStoreInfo 형식으로 변환
 */
export function toRegisteredAppStoreInfo({
  bundleId,
  appInfo,
}: {
  bundleId: string;
  appInfo: AppStoreAppInfo;
}): RegisteredAppStoreInfo | undefined {
  if (!appInfo.found) {
    return undefined;
  }

  return {
    bundleId,
    appId: appInfo.appId,
    name: appInfo.name,
    supportedLocales: appInfo.supportedLocales,
  };
}

/**
 * Google Play 정보를 RegisteredGooglePlayInfo 형식으로 변환
 */
export function toRegisteredGooglePlayInfo({
  packageName,
  appInfo,
}: {
  packageName: string;
  appInfo: GooglePlayAppInfo;
}): RegisteredGooglePlayInfo | undefined {
  if (!appInfo.found) {
    return undefined;
  }

  return {
    packageName,
    name: appInfo.name,
    supportedLocales: appInfo.supportedLocales,
  };
}








