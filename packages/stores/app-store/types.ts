/**
 * App Store Connect API Types
 *
 * Type definitions for App Store Connect operations
 */

export interface AppStoreClientConfig {
  issuerId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
}

export interface ApiResponse<T> {
  data: T;
  links?: { self?: string; next?: string };
}

export interface AppStoreApp {
  id: string;
  attributes: { name: string; bundleId: string; sku: string };
}

export interface AppInfo {
  id: string;
  attributes: { appStoreState?: string };
}

export interface AppInfoLocalization {
  id: string;
  attributes: {
    locale?: string;
    name?: string;
    subtitle?: string;
    privacyPolicyUrl?: string;
  };
}

export interface AppStoreVersion {
  id: string;
  attributes: {
    versionString: string;
    platform: string;
    appStoreState?: string;
    releaseType?: string;
  };
}

export interface AppStoreScreenshotSet {
  id: string;
  attributes: { screenshotDisplayType: string };
}

export interface AppStoreScreenshot {
  id: string;
  attributes: {
    imageUrl?: string;
    fileName?: string;
    fileSize?: number;
    imageAsset?: { width?: number; height?: number; templateUrl?: string };
  };
}

export interface AppStoreLocalization {
  id: string;
  attributes: {
    locale?: string;
    description?: string;
    keywords?: string;
    marketingUrl?: string;
    promotionalText?: string;
    supportUrl?: string;
    whatsNew?: string;
  };
}
