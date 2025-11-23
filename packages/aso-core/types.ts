/**
 * ASO (App Store Optimization) data type definitions
 */

// ============================================================================
// Supported Language Lists
// ============================================================================

/**
 * App Store Connect supported locale list
 * Reference: https://developer.apple.com/documentation/appstoreconnectapi
 */
export const APP_STORE_SUPPORTED_LOCALES = [
  "en-US",
  "en-AU",
  "en-CA",
  "en-GB",
  "ko-KR",
  "ja-JP",
  "zh-Hans",
  "zh-Hant",
  "zh-HK",
  "fr-FR",
  "fr-CA",
  "de-DE",
  "it-IT",
  "es-ES",
  "es-MX",
  "pt-BR",
  "pt-PT",
  "ru-RU",
  "ar-SA",
  "nl-NL",
  "sv-SE",
  "da-DK",
  "no-NO",
  "fi-FI",
  "pl-PL",
  "tr-TR",
  "vi-VN",
  "th-TH",
  "id-ID",
  "ms-MY",
  "hi-IN",
  "cs-CZ",
  "sk-SK",
  "hu-HU",
  "ro-RO",
  "uk-UA",
  "he-IL",
  "el-GR",
] as const;

/**
 * Google Play Console supported language list
 * Reference: https://support.google.com/googleplay/android-developer/answer/9844778
 */
export const GOOGLE_PLAY_SUPPORTED_LANGUAGES = [
  "en-US",
  "en-AU",
  "en-CA",
  "en-GB",
  "en-IN",
  "en-SG",
  "ko-KR",
  "ja-JP",
  "zh-CN",
  "zh-TW",
  "zh-HK",
  "fr-FR",
  "fr-CA",
  "de-DE",
  "it-IT",
  "es-ES",
  "es-419",
  "es-US",
  "pt-BR",
  "pt-PT",
  "ru-RU",
  "ar-SA",
  "nl-NL",
  "sv-SE",
  "da-DK",
  "no-NO",
  "fi-FI",
  "pl-PL",
  "tr-TR",
  "vi-VN",
  "th-TH",
  "id-ID",
  "ms-MY",
  "hi-IN",
  "cs-CZ",
  "sk-SK",
  "hu-HU",
  "ro-RO",
  "uk-UA",
  "he-IL",
  "el-GR",
  "bg-BG",
  "hr-HR",
  "sr-RS",
  "sl-SI",
  "et-EE",
  "lv-LV",
  "lt-LT",
] as const;

export type AppStoreLocale = (typeof APP_STORE_SUPPORTED_LOCALES)[number];
export type GooglePlayLanguage =
  (typeof GOOGLE_PLAY_SUPPORTED_LANGUAGES)[number];
export type SupportedLocale = AppStoreLocale | GooglePlayLanguage;

export const DEFAULT_LOCALE = "en-US" as const;

// ============================================================================
// Type Guards
// ============================================================================

export function isAppStoreLocale(locale: string): locale is AppStoreLocale {
  return APP_STORE_SUPPORTED_LOCALES.includes(locale as AppStoreLocale);
}

export function isGooglePlayLanguage(
  language: string
): language is GooglePlayLanguage {
  return GOOGLE_PLAY_SUPPORTED_LANGUAGES.includes(
    language as GooglePlayLanguage
  );
}

// ============================================================================
// Google Play ASO Types
// ============================================================================

export interface GooglePlayScreenshots {
  phone: string[];
  tablet?: string[];
  tablet7?: string[];
  tablet10?: string[];
  tv?: string[];
  wear?: string[];
}

export interface GooglePlayAsoData {
  title: string;
  shortDescription: string;
  fullDescription: string;
  screenshots: GooglePlayScreenshots;
  featureGraphic?: string;
  promoGraphic?: string;
  category?: string;
  contentRating?: string;
  keywords?: string[];
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
  packageName: string;
  defaultLanguage: string;
}

export interface GooglePlayMultilingualAsoData {
  locales: Record<string, GooglePlayAsoData>;
  defaultLocale?: string;
}

export interface GooglePlayReleaseNote {
  versionCode: number;
  versionName: string;
  releaseNotes: Record<string, string>;
  track: string;
  status: string;
  releaseDate?: string;
}

// ============================================================================
// App Store ASO Types
// ============================================================================

export interface AppStoreScreenshots {
  iphone65?: string[];
  iphone61?: string[];
  iphone58?: string[];
  iphone55?: string[];
  iphone47?: string[];
  iphone40?: string[];
  ipadPro129?: string[];
  ipadPro11?: string[];
  ipad105?: string[];
  ipad97?: string[];
  appleWatch?: string[];
}

export interface AppStoreAsoData {
  name: string;
  subtitle?: string;
  description: string;
  keywords?: string;
  promotionalText?: string;
  screenshots: AppStoreScreenshots;
  appPreview?: string[];
  primaryCategory?: string;
  secondaryCategory?: string;
  contentRightId?: string;
  supportUrl?: string;
  marketingUrl?: string;
  privacyPolicyUrl?: string;
  bundleId: string;
  locale: string;
  whatsNew?: string;
}

export interface AppStoreMultilingualAsoData {
  locales: Record<string, AppStoreAsoData>;
  defaultLocale?: string;
}

export interface AppStoreReleaseNote {
  versionString: string;
  releaseNotes: Record<string, string>;
  platform: string;
  releaseDate?: string;
}

// ============================================================================
// Unified ASO Types
// ============================================================================

export interface AsoData {
  googlePlay?: GooglePlayAsoData | GooglePlayMultilingualAsoData;
  appStore?: AppStoreAsoData | AppStoreMultilingualAsoData;
  lastSynced?: {
    googlePlay?: string;
    appStore?: string;
  };
}

export function isGooglePlayMultilingual(
  data: GooglePlayAsoData | GooglePlayMultilingualAsoData | undefined
): data is GooglePlayMultilingualAsoData {
  return data !== undefined && "locales" in data;
}

export function isAppStoreMultilingual(
  data: AppStoreAsoData | AppStoreMultilingualAsoData | undefined
): data is AppStoreMultilingualAsoData {
  return data !== undefined && "locales" in data;
}

// ============================================================================
// Sync Options
// ============================================================================

import { type StoreType } from "@packages/shared/types";

export type SyncDirection = "pull" | "push" | "sync";

export interface SyncOptions {
  direction: SyncDirection;
  productSlug: string;
  store?: StoreType;
  dryRun?: boolean;
  uploadImages?: boolean;
}

// Re-export StoreType for backward compatibility
export type { StoreType } from "@packages/shared/types";
