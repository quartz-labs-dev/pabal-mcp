/**
 * Google Play Console API Types
 *
 * Type definitions for Google Play Store operations.
 * Types are derived from googleapis library types.
 *
 * @see https://developers.google.com/android-publisher
 */

import type { androidpublisher_v3 } from "googleapis";

// ============================================================================
// Type Aliases (for convenience and internal use)
// ============================================================================

/**
 * Auth type from googleapis
 * Used internally for EditSession
 */
type AuthType = androidpublisher_v3.Params$Resource$Edits$Insert["auth"];

/**
 * Schema types from googleapis
 * Re-exported for use across the codebase
 */
export type AppEdit = androidpublisher_v3.Schema$AppEdit;
export type AppDetails = androidpublisher_v3.Schema$AppDetails;
export type Listing = androidpublisher_v3.Schema$Listing;
export type Image = androidpublisher_v3.Schema$Image;
export type Track = androidpublisher_v3.Schema$Track;
export type TrackRelease = androidpublisher_v3.Schema$TrackRelease;
export type ListingsListResponse =
  androidpublisher_v3.Schema$ListingsListResponse;
export type ImagesListResponse = androidpublisher_v3.Schema$ImagesListResponse;
export type TracksListResponse = androidpublisher_v3.Schema$TracksListResponse;
export type ImagesUploadResponse =
  androidpublisher_v3.Schema$ImagesUploadResponse;

// ============================================================================
// Custom Types (not from Discovery Document)
// ============================================================================

/**
 * Google Play Client Configuration
 * Internal type for client initialization
 */
export interface GooglePlayClientConfig {
  packageName: string;
  serviceAccountKeyPath?: string;
  serviceAccountKey?: object;
}

/**
 * Edit Session
 * Internal helper type that extends AppEdit with auth and packageName
 * for convenience in API calls
 */
export interface EditSession extends Pick<AppEdit, "id"> {
  auth: AuthType;
  packageName: string;
  editId: string; // Alias for AppEdit.id
}

/**
 * Screenshot URLs grouped by device type
 * Internal type for organizing screenshots by device category
 */
export interface ScreenshotUrls {
  phone: string[];
  tablet7: string[];
  tablet10: string[];
  tv: string[];
  wear: string[];
}

/**
 * App Access Information
 * Internal type for app verification results
 */
export interface AppAccessInfo {
  packageName: string;
  title?: string;
  defaultLanguage?: string;
  supportedLocales?: string[];
}

/**
 * Latest Release Information
 * Internal type derived from TrackRelease for convenience
 * Extracts and transforms TrackRelease data for easier consumption
 */
export interface LatestReleaseInfo {
  versionCodes: number[]; // Converted from TrackRelease.versionCodes (string[] -> number[])
  status?: NonNullable<TrackRelease["status"]>;
  versionName?: string; // Derived from TrackRelease.name
  releaseName?: NonNullable<TrackRelease["name"]>;
  releaseDate?: string; // Extracted from releaseDate.seconds if available
}

/**
 * Release Update Result
 * Internal type for tracking release note update operations
 */
export interface ReleaseUpdateResult {
  updated: string[];
  failed: Array<{ locale: string; error: string }>;
}

/**
 * Create Release Options
 * Internal type for creating a new release
 * Based on TrackRelease but with simplified versionCodes (number[])
 */
export interface CreateReleaseOptions {
  versionCodes: number[]; // Will be converted to string[] for TrackRelease
  releaseName?: NonNullable<TrackRelease["name"]>;
  status?: NonNullable<TrackRelease["status"]>;
}

/**
 * Upload Screenshot Options
 * Internal type for screenshot upload operations
 */
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

/**
 * Batch Upload Screenshots Options
 * Internal type for uploading multiple screenshots in a single edit session
 * Replaces existing screenshots (deletes all before upload)
 */
export interface BatchUploadScreenshotsOptions {
  language: string;
  phoneScreenshots?: string[];
  sevenInchScreenshots?: string[];
  tenInchScreenshots?: string[];
  featureGraphic?: string;
  imageUploadTimeoutMs?: number;
}

/**
 * Batch Upload Screenshots Result
 * Internal type for tracking batch upload results
 */
export interface BatchUploadScreenshotsResult {
  language: string;
  uploaded: {
    phoneScreenshots: number;
    sevenInchScreenshots: number;
    tenInchScreenshots: number;
    featureGraphic: boolean;
  };
}

/**
 * Update Release Notes Options
 * Internal type for updating release notes
 */
export interface UpdateReleaseNotesOptions {
  releaseNotes: Record<string, string>; // Will be converted to LocalizedText[]
  track?: string;
}

/**
 * App Details Data
 * Internal type for app details update operations
 * Based on AppDetails but with optional fields for partial updates
 * Note: YouTube URLs are managed at listing level, not app details level
 */
export interface AppDetailsData {
  contactEmail?: NonNullable<AppDetails["contactEmail"]>;
  contactPhone?: NonNullable<AppDetails["contactPhone"]>;
  contactWebsite?: NonNullable<AppDetails["contactWebsite"]>;
  defaultLanguage?: NonNullable<AppDetails["defaultLanguage"]>;
}

// ============================================================================
// Enum Types
// ============================================================================

export type ImageType =
  | "appImageTypeUnspecified"
  | "phoneScreenshots"
  | "sevenInchScreenshots"
  | "tenInchScreenshots"
  | "tvScreenshots"
  | "wearScreenshots"
  | "icon"
  | "featureGraphic"
  | "tvBanner";

// ============================================================================
// Request Attribute Types
// ============================================================================

/**
 * Listing Update Request Attributes
 * @see https://developers.google.com/android-publisher/api-ref/rest/v3/edits.listings#Listing
 */
export type ListingUpdateAttributes = Partial<
  Pick<
    androidpublisher_v3.Schema$Listing,
    "language" | "title" | "shortDescription" | "fullDescription" | "video"
  >
>;

/**
 * App Details Update Request Attributes
 * @see https://developers.google.com/android-publisher/api-ref/rest/v3/edits.details#AppDetails
 */
export type AppDetailsUpdateAttributes = Partial<
  Pick<
    androidpublisher_v3.Schema$AppDetails,
    "defaultLanguage" | "contactEmail" | "contactPhone" | "contactWebsite"
  >
>;

/**
 * Track Update Request Attributes
 * @see https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks#Track
 */
export type TrackUpdateAttributes = Partial<
  Pick<androidpublisher_v3.Schema$Track, "track" | "releases">
>;
