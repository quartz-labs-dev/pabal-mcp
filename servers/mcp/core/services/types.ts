import type { RegisteredApp } from "@/packages/configs/secrets-config/registered-apps";

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type MaybeResult<T> =
  | ({ found: true } & T)
  | { found: false; error?: string };

export interface StoreAppSummary {
  id: string;
  name: string;
  bundleId: string;
  sku: string;
  isReleased: boolean;
}

export interface AppStoreVersionInfo {
  versionString: string;
  state: string;
}

export interface GooglePlayReleaseInfo {
  versionName?: string;
  releaseName?: string;
  status?: string;
  versionCodes: number[];
}

export interface CreatedAppStoreVersion {
  id: string;
  versionString: string;
  state?: string;
}

export interface CreatedGooglePlayVersion {
  versionName: string;
  versionCodes: number[];
  status: string;
  releaseName?: string;
}

export interface UpdatedReleaseNotesResult {
  updated: string[];
  failed: Array<{ locale: string; error: string }>;
}

export interface PushFailedFields {
  locale: string;
  fields: string[];
}

export type PushAsoResult =
  | {
      success: true;
      localesPushed: string[];
      failedFields?: PushFailedFields[];
    }
  | {
      success: false;
      error: string;
      needsNewVersion?: boolean;
      versionInfo?: {
        versionId: string;
        versionString: string;
        locales: string[];
      };
    };

export interface VerifyAuthResult<TPayload = Record<string, unknown>> {
  success: boolean;
  error?: string;
  data?: TPayload;
}

export interface ResolvedAppContext {
  app: RegisteredApp;
  slug: string;
  bundleId?: string;
  packageName?: string;
  hasAppStore: boolean;
  hasGooglePlay: boolean;
}
