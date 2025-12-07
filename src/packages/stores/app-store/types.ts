/**
 * App Store Connect API Types
 *
 * Type definitions for App Store Connect operations.
 * Response types are from OpenAPI, Request attribute types are extracted.
 *
 * @see https://developer.apple.com/documentation/appstoreconnectapi
 */

import type { components } from "./generated-types";

// Schema type alias for convenience
type Schemas = components["schemas"];

// ============================================================================
// Custom Types (not from OpenAPI)
// ============================================================================

export interface AppStoreClientConfig {
  issuerId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
}

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
  links?: { self?: string; next?: string };
}

// ============================================================================
// Response Types (from OpenAPI)
// ============================================================================

export type AppStoreApp = Schemas["App"];
export type AppInfo = Schemas["AppInfo"];
export type AppInfoLocalization = Schemas["AppInfoLocalization"];
export type AppStoreVersion = Schemas["AppStoreVersion"];
export type AppStoreLocalization = Schemas["AppStoreVersionLocalization"];
export type AppStoreScreenshotSet = Schemas["AppScreenshotSet"];
export type AppStoreScreenshot = Schemas["AppScreenshot"];

// ============================================================================
// Request Attribute Types (extracted from OpenAPI)
// ============================================================================

/**
 * App Info Localization Update Request Attributes
 * @see https://developer.apple.com/documentation/appstoreconnectapi/appinfolocalizationupdaterequest/data/attributes
 */
export type AppInfoLocalizationUpdateAttributes = NonNullable<
  Schemas["AppInfoLocalizationUpdateRequest"]["data"]["attributes"]
>;

/**
 * App Store Version Localization Update Request Attributes
 * @see https://developer.apple.com/documentation/appstoreconnectapi/appstoreversionlocalizationupdaterequest/data/attributes
 */
export type AppStoreVersionLocalizationUpdateAttributes = NonNullable<
  Schemas["AppStoreVersionLocalizationUpdateRequest"]["data"]["attributes"]
>;
