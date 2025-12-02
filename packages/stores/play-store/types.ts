/**
 * Google Play Console API Types
 *
 * Type definitions for Google Play Store operations
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface GooglePlayClientConfig {
  packageName: string;
  serviceAccountKeyPath?: string;
  serviceAccountKey?: object;
}

export interface EditSession {
  auth: any;
  packageName: string;
  editId: string;
}

export interface ScreenshotUrls {
  phone: string[];
  tablet7: string[];
  tablet10: string[];
  tv: string[];
  wear: string[];
}

export interface AppAccessInfo {
  packageName: string;
  title?: string;
  defaultLanguage?: string;
  supportedLocales?: string[];
}

export interface LatestReleaseInfo {
  versionCodes: number[];
  status?: string;
  versionName?: string;
  releaseName?: string;
  releaseDate?: string;
}

export interface ReleaseUpdateResult {
  updated: string[];
  failed: Array<{ locale: string; error: string }>;
}

export interface CreateReleaseOptions {
  versionCodes: number[];
  releaseName?: string;
  status?: "draft" | "inProgress" | "completed" | "halted";
}

export interface UploadScreenshotOptions {
  imagePath: string;
  imageType:
    | "phoneScreenshots"
    | "sevenInchScreenshots"
    | "tenInchScreenshots"
    | "tvScreenshots"
    | "wearScreenshots"
    | "featureGraphic";
  language?: string;
}

export interface UpdateReleaseNotesOptions {
  releaseNotes: Record<string, string>;
  track?: string;
}

export interface AppDetailsData {
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
  defaultLanguage?: string;
}
