/**
 * App Store Connect Constants
 *
 * Constant values for App Store operations
 */

import type { AppStoreScreenshots } from "@/packages/configs/aso-config/types";

export const APP_STORE_API_BASE_URL =
  "https://api.appstoreconnect.apple.com/v1";
export const APP_STORE_PLATFORM = "IOS";
export const DEFAULT_APP_LIST_LIMIT = 200;
export const DEFAULT_VERSIONS_FETCH_LIMIT = 10;

export const SCREENSHOT_TYPE_MAP: Record<string, keyof AppStoreScreenshots> = {
  IPHONE_65: "iphone65",
  IPHONE_61: "iphone61",
  IPHONE_58: "iphone58",
  IPHONE_55: "iphone55",
  IPHONE_47: "iphone47",
  IPHONE_40: "iphone40",
  IPAD_PRO_129: "ipadPro129",
  IPAD_PRO_11: "ipadPro11",
  IPAD_105: "ipad105",
  IPAD_97: "ipad97",
  APPLE_WATCH_SERIES_4: "appleWatch",
  APPLE_WATCH_SERIES_3: "appleWatch",
  APP_IPHONE_67: "iphone65",
  APP_IPHONE_65: "iphone65",
  APP_IPHONE_61: "iphone61",
  APP_IPHONE_58: "iphone58",
  APP_IPHONE_55: "iphone55",
  APP_IPHONE_47: "iphone47",
  APP_IPHONE_40: "iphone40",
  APP_IPAD_PRO_3GEN_129: "ipadPro129",
  APP_IPAD_PRO_129: "ipadPro129",
  APP_IPAD_PRO_3GEN_11: "ipadPro11",
  APP_IPAD_PRO_11: "ipadPro11",
  APP_IPAD_105: "ipad105",
  APP_IPAD_97: "ipad97",
  APP_APPLE_WATCH_SERIES_4: "appleWatch",
  APP_APPLE_WATCH_SERIES_3: "appleWatch",
};
