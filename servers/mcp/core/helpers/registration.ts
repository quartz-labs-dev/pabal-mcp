import type {
  RegisteredAppStoreInfo,
  RegisteredGooglePlayInfo,
} from "@/packages/configs/secrets-config/registered-apps";

type AppStoreAppInfo = {
  found: boolean;
  appId?: string;
  name?: string;
  supportedLocales?: string[];
};

type GooglePlayAppInfo = {
  found: boolean;
  name?: string;
  supportedLocales?: string[];
};

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
