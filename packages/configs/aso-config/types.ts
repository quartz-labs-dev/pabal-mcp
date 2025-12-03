import {
  APP_STORE_SUPPORTED_LOCALES,
  GOOGLE_PLAY_SUPPORTED_LANGUAGES,
} from "./constants";

export type AppStoreLocale = (typeof APP_STORE_SUPPORTED_LOCALES)[number];
export type GooglePlayLanguage =
  (typeof GOOGLE_PLAY_SUPPORTED_LANGUAGES)[number];
export type SupportedLocale = AppStoreLocale | GooglePlayLanguage;

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

// ============================================================================
// Sync Options
// ============================================================================

export type StoreType = "googlePlay" | "appStore" | "both";

export type SyncDirection = "pull" | "push" | "sync";

export interface SyncOptions {
  direction: SyncDirection;
  productSlug: string;
  store?: StoreType;
  dryRun?: boolean;
  uploadImages?: boolean;
}

// Re-export StoreType for backward compatibility
