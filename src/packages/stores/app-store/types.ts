/**
 * App Store Connect API Types
 *
 * Type definitions for App Store Connect operations.
 * Response types are from OpenAPI, Request attribute types are extracted.
 *
 * @see https://developer.apple.com/documentation/appstoreconnectapi
 */

import type {
  App as AppModel,
  AppInfo as AppInfoModel,
  AppInfoLocalization as AppInfoLocalizationModel,
  AppScreenshot as AppScreenshotModel,
  AppScreenshotSet as AppScreenshotSetModel,
  AppStoreVersion as AppStoreVersionModel,
  AppStoreVersionLocalization as AppStoreVersionLocalizationModel,
  AppStoreVersionLocalizationUpdateRequestDataAttributes,
  AppInfoLocalizationUpdateRequestDataAttributes,
} from "appstore-connect-sdk/openapi";

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

export type AppStoreApp = AppModel;
export type AppInfo = AppInfoModel;
export type AppInfoLocalization = AppInfoLocalizationModel;
export type AppStoreVersion = AppStoreVersionModel;
export type AppStoreLocalization = AppStoreVersionLocalizationModel;
export type AppStoreScreenshotSet = AppScreenshotSetModel;
export type AppStoreScreenshot = AppScreenshotModel;

// ============================================================================
// Request Attribute Types (extracted from OpenAPI)
// ============================================================================

/**
 * App Info Localization Update Request Attributes
 * @see https://developer.apple.com/documentation/appstoreconnectapi/appinfolocalizationupdaterequest/data/attributes
 */
export type AppInfoLocalizationUpdateAttributes =
  AppInfoLocalizationUpdateRequestDataAttributes;

/**
 * App Store Version Localization Update Request Attributes
 * @see https://developer.apple.com/documentation/appstoreconnectapi/appstoreversionlocalizationupdaterequest/data/attributes
 */
export type AppStoreVersionLocalizationUpdateAttributes =
  AppStoreVersionLocalizationUpdateRequestDataAttributes;
