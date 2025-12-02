/**
 * Google Play Console API Constants
 *
 * Constant values for Google Play Store operations
 */

export const IMAGE_TYPES = [
  "phoneScreenshots",
  "sevenInchScreenshots",
  "tenInchScreenshots",
  "tvScreenshots",
  "wearScreenshots",
  "featureGraphic",
] as const;

export type ImageType = (typeof IMAGE_TYPES)[number];

export const DEFAULT_TRACK = "production";
export const DEFAULT_LANGUAGE = "en-US";
export const DEFAULT_RELEASE_STATUS = "draft";
