/**
 * Screenshot upload helper utilities
 * Shared logic for Google Play and App Store screenshot operations
 */

import { existsSync, readdirSync } from "node:fs";

/**
 * Device type mappings for App Store screenshots
 */
export const APP_STORE_DEVICE_TYPES = {
  iphone67: "APP_IPHONE_67",
  iphone65: "APP_IPHONE_65",
  iphone61: "APP_IPHONE_61",
  iphone58: "APP_IPHONE_58",
  iphone55: "APP_IPHONE_55",
  iphone47: "APP_IPHONE_47",
  iphone40: "APP_IPHONE_40",
  ipad13: "APP_IPAD_PRO_3GEN_129",
  ipadPro129: "APP_IPAD_PRO_3GEN_129",
  ipadPro11: "APP_IPAD_PRO_11",
  ipad105: "APP_IPAD_105",
  ipad97: "APP_IPAD_97",
} as const;

export type AppStoreDeviceType = keyof typeof APP_STORE_DEVICE_TYPES;
export type AppStoreScreenshotDisplayType =
  (typeof APP_STORE_DEVICE_TYPES)[AppStoreDeviceType];

/**
 * Screenshot file info parsed from filename
 */
export interface ParsedScreenshotFile {
  filename: string;
  path: string;
  deviceType: string;
  order: number;
}

/**
 * Parse App Store screenshot filename
 * @param filename e.g., "iphone65-1.png"
 * @returns Parsed info or null if invalid
 */
export function parseAppStoreScreenshotFilename(
  filename: string,
  basePath: string
): ParsedScreenshotFile | null {
  const match = filename.match(/^([a-zA-Z0-9]+)-(\d+)\.png$/);
  if (!match) return null;

  const [, deviceType, orderStr] = match;
  const order = parseInt(orderStr, 10);

  if (!APP_STORE_DEVICE_TYPES[deviceType as AppStoreDeviceType]) {
    return null;
  }

  return {
    filename,
    path: `${basePath}/${filename}`,
    deviceType: APP_STORE_DEVICE_TYPES[deviceType as AppStoreDeviceType],
    order,
  };
}

/**
 * Group screenshots by device type with ordering
 */
export function groupScreenshotsByDeviceType(
  screenshots: ParsedScreenshotFile[]
): Record<string, ParsedScreenshotFile[]> {
  const grouped: Record<string, ParsedScreenshotFile[]> = {};

  for (const screenshot of screenshots) {
    if (!grouped[screenshot.deviceType]) {
      grouped[screenshot.deviceType] = [];
    }
    grouped[screenshot.deviceType].push(screenshot);
  }

  // Sort each group by order
  for (const deviceType in grouped) {
    grouped[deviceType].sort((a, b) => a.order - b.order);
  }

  return grouped;
}

/**
 * Get screenshot files for a locale
 * @returns Array of PNG files in the directory, or empty array if directory doesn't exist
 */
export function getLocaleScreenshotFiles(
  screenshotsBaseDir: string,
  locale: string
): string[] {
  const localeDir = `${screenshotsBaseDir}/${locale}`;

  if (!existsSync(localeDir)) {
    return [];
  }

  return readdirSync(localeDir).filter((file) => file.endsWith(".png"));
}

/**
 * Check if locale has any screenshot files
 */
export function hasScreenshots(
  screenshotsBaseDir: string,
  locale: string
): boolean {
  const files = getLocaleScreenshotFiles(screenshotsBaseDir, locale);
  return files.length > 0;
}

/**
 * Parse and group App Store screenshots for a locale
 */
export function parseAppStoreScreenshots(
  screenshotsBaseDir: string,
  locale: string
): {
  valid: Record<string, ParsedScreenshotFile[]>;
  invalid: string[];
  unknown: string[];
} {
  const localeDir = `${screenshotsBaseDir}/${locale}`;
  const files = getLocaleScreenshotFiles(screenshotsBaseDir, locale);

  const validScreenshots: ParsedScreenshotFile[] = [];
  const invalidFilenames: string[] = [];
  const unknownDeviceTypes: string[] = [];

  for (const file of files) {
    const parsed = parseAppStoreScreenshotFilename(file, localeDir);

    if (!parsed) {
      invalidFilenames.push(file);
      continue;
    }

    if (!parsed.deviceType) {
      unknownDeviceTypes.push(file);
      continue;
    }

    validScreenshots.push(parsed);
  }

  return {
    valid: groupScreenshotsByDeviceType(validScreenshots),
    invalid: invalidFilenames,
    unknown: unknownDeviceTypes,
  };
}

/**
 * Parse Google Play screenshot filenames
 * Supports: phone-*.png, tablet7-*.png, tablet10-*.png, feature-graphic.png
 */
export interface GooglePlayScreenshotFiles {
  phone: string[];
  tablet7: string[];
  tablet10: string[];
  featureGraphic: string | null;
}

/**
 * Sort screenshot filenames by numeric order
 * e.g., phone-1.png, phone-2.png, phone-10.png (not phone-1, phone-10, phone-2)
 */
function sortByNumericOrder(files: string[], prefix: string): string[] {
  return files.sort((a, b) => {
    const numA = parseInt(a.replace(prefix, "").replace(".png", ""), 10);
    const numB = parseInt(b.replace(prefix, "").replace(".png", ""), 10);
    return numA - numB;
  });
}

export function parseGooglePlayScreenshots(
  screenshotsBaseDir: string,
  locale: string
): GooglePlayScreenshotFiles {
  const localeDir = `${screenshotsBaseDir}/${locale}`;
  const files = getLocaleScreenshotFiles(screenshotsBaseDir, locale);

  const phoneFiles = files.filter(
    (f) => f.startsWith("phone-") && f.endsWith(".png")
  );
  const tablet7Files = files.filter(
    (f) => f.startsWith("tablet7-") && f.endsWith(".png")
  );
  const tablet10Files = files.filter(
    (f) => f.startsWith("tablet10-") && f.endsWith(".png")
  );

  return {
    phone: sortByNumericOrder(phoneFiles, "phone-").map(
      (f) => `${localeDir}/${f}`
    ),
    tablet7: sortByNumericOrder(tablet7Files, "tablet7-").map(
      (f) => `${localeDir}/${f}`
    ),
    tablet10: sortByNumericOrder(tablet10Files, "tablet10-").map(
      (f) => `${localeDir}/${f}`
    ),
    featureGraphic: files.includes("feature-graphic.png")
      ? `${localeDir}/feature-graphic.png`
      : null,
  };
}
