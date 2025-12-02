import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { getDataDir } from "@/packages/configs/secrets-config/config";
import {
  type AsoData,
  type GooglePlayAsoData,
  type GooglePlayMultilingualAsoData,
  type AppStoreAsoData,
  type AppStoreMultilingualAsoData,
} from "./types";
import { DEFAULT_LOCALE } from "./constants";

// ============================================================================
// ASO Directory Path Utilities
// ============================================================================

export function getAsoDir(): string {
  return join(getDataDir(), ".aso");
}

export function getAsoPullDir(): string {
  return join(getAsoDir(), "pullData");
}

export function getAsoPushDir(): string {
  return join(getAsoDir(), "pushData");
}

export function getProductAsoDir(slug: string): string {
  return join(getAsoDir(), "products", slug, "store");
}

export function getPullProductAsoDir(slug: string, baseDir?: string): string {
  return join(baseDir ?? getAsoPullDir(), "products", slug, "store");
}

export function getScreenshotDir(
  productStoreRoot: string,
  store: "google-play" | "app-store",
  locale: string
): string {
  return join(productStoreRoot, store, "screenshots", locale);
}

export function getScreenshotFilePath(
  screenshotDir: string,
  filename: string
): string {
  return join(screenshotDir, filename);
}

export function getStoreDir(
  productStoreRoot: string,
  store: "google-play" | "app-store"
): string {
  return join(productStoreRoot, store);
}

export function getReleaseNotesPath(storeDir: string): string {
  return join(storeDir, "release-notes.json");
}

export function getAsoDataPaths(slug: string, asoDir?: string) {
  const baseDir = asoDir ?? getAsoDir();
  const productStoreDir = join(baseDir, "products", slug, "store");
  return {
    googlePlay: join(productStoreDir, "google-play", "aso-data.json"),
    appStore: join(productStoreDir, "app-store", "aso-data.json"),
  };
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================================================
// Data Conversion
// ============================================================================

export interface PreparedAsoData {
  googlePlay?: GooglePlayMultilingualAsoData;
  appStore?: AppStoreMultilingualAsoData;
}

export function convertToMultilingual<
  T extends { locale?: string; defaultLanguage?: string },
>(
  data: T,
  locale?: string
): { locales: Record<string, T>; defaultLocale: string } {
  const detectedLocale =
    locale || data.locale || data.defaultLanguage || DEFAULT_LOCALE;
  return {
    locales: { [detectedLocale]: data },
    defaultLocale: detectedLocale,
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

export function prepareAsoDataForPush(
  slug: string,
  configData: AsoData,
  options?: { baseUrl?: string }
): PreparedAsoData {
  const storeData: PreparedAsoData = {};
  const baseUrl =
    options?.baseUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://labs.quartz.best";
  const detailPageUrl = `${baseUrl}/${slug}`;

  if (configData.googlePlay) {
    const googlePlayData = configData.googlePlay;
    const locales = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.locales
      : { [googlePlayData.defaultLanguage || DEFAULT_LOCALE]: googlePlayData };

    type CleanedGooglePlay = Omit<GooglePlayAsoData, "screenshots">;
    const cleanedLocales: Record<string, CleanedGooglePlay> = {};

    for (const [locale, localeData] of Object.entries(locales)) {
      const { screenshots, featureGraphic, ...rest } = localeData;
      cleanedLocales[locale] = {
        ...rest,
        contactWebsite: detailPageUrl,
      };
    }

    const gpDefaultLocale = isGooglePlayMultilingual(googlePlayData)
      ? googlePlayData.defaultLocale
      : googlePlayData.defaultLanguage;

    storeData.googlePlay = {
      locales: cleanedLocales as unknown as Record<string, GooglePlayAsoData>,
      defaultLocale: gpDefaultLocale || DEFAULT_LOCALE,
    };
  }

  if (configData.appStore) {
    const appStoreData = configData.appStore;
    const locales = isAppStoreMultilingual(appStoreData)
      ? appStoreData.locales
      : { [appStoreData.locale || DEFAULT_LOCALE]: appStoreData };

    type CleanedAppStore = Omit<AppStoreAsoData, "screenshots">;
    const cleanedLocales: Record<string, CleanedAppStore> = {};

    for (const [locale, localeData] of Object.entries(locales)) {
      const { screenshots, ...rest } = localeData;
      cleanedLocales[locale] = {
        ...rest,
        marketingUrl: detailPageUrl,
      };
    }

    const asDefaultLocale = isAppStoreMultilingual(appStoreData)
      ? appStoreData.defaultLocale
      : appStoreData.locale;

    storeData.appStore = {
      locales: cleanedLocales as unknown as Record<string, AppStoreAsoData>,
      defaultLocale: asDefaultLocale || DEFAULT_LOCALE,
    };
  }

  return storeData;
}

// ============================================================================
// ASO Data Save/Load
// ============================================================================

export function saveAsoData(
  slug: string,
  asoData: Partial<AsoData>,
  options?: { asoDir?: string }
): void {
  const baseDir = options?.asoDir ?? getAsoDir();
  const productStoreDir = join(baseDir, "products", slug, "store");

  if (asoData.googlePlay) {
    const googlePlayDir = join(productStoreDir, "google-play");
    ensureDir(googlePlayDir);
    const filePath = join(googlePlayDir, "aso-data.json");
    writeFileSync(
      filePath,
      JSON.stringify({ googlePlay: asoData.googlePlay }, null, 2)
    );
    console.log(`💾 Google Play data saved to ${filePath}`);
  }

  if (asoData.appStore) {
    const appStoreDir = join(productStoreDir, "app-store");
    ensureDir(appStoreDir);
    const filePath = join(appStoreDir, "aso-data.json");
    writeFileSync(
      filePath,
      JSON.stringify({ appStore: asoData.appStore }, null, 2)
    );
    console.log(`💾 App Store data saved to ${filePath}`);
  }
}

export function loadAsoData(
  slug: string,
  options?: { asoDir?: string }
): AsoData {
  const baseDir = options?.asoDir ?? getAsoDir();
  const asoData: AsoData = {};

  const googlePlayPath = join(
    baseDir,
    "products",
    slug,
    "store",
    "google-play",
    "aso-data.json"
  );
  if (existsSync(googlePlayPath)) {
    try {
      const content = readFileSync(googlePlayPath, "utf-8");
      const data = JSON.parse(content);
      if (data.googlePlay) {
        asoData.googlePlay = isGooglePlayMultilingual(data.googlePlay)
          ? data.googlePlay
          : convertToMultilingual(
              data.googlePlay,
              data.googlePlay.defaultLanguage
            );
      }
    } catch (error) {
      console.error(`❌ Failed to read Google Play data:`, error);
    }
  }

  const appStorePath = join(
    baseDir,
    "products",
    slug,
    "store",
    "app-store",
    "aso-data.json"
  );
  if (existsSync(appStorePath)) {
    try {
      const content = readFileSync(appStorePath, "utf-8");
      const data = JSON.parse(content);
      if (data.appStore) {
        asoData.appStore = isAppStoreMultilingual(data.appStore)
          ? data.appStore
          : convertToMultilingual(data.appStore, data.appStore.locale);
      }
    } catch (error) {
      console.error(`❌ Failed to read App Store data:`, error);
    }
  }

  return asoData;
}

// ============================================================================
// Image Utilities
// ============================================================================

export function isLocalAssetPath(assetPath: string): boolean {
  if (!assetPath) return false;
  const trimmed = assetPath.trim();
  return !/^([a-z]+:)?\/\//i.test(trimmed);
}

export function resolveAppStoreImageUrl(templateUrl: string): string {
  if (!templateUrl.includes("{w}") && !templateUrl.includes("{h}")) {
    return templateUrl;
  }
  const width = 2048;
  const height = 2732;
  const format = "png";
  return templateUrl
    .replace("{w}", width.toString())
    .replace("{h}", height.toString())
    .replace("{f}", format);
}

export async function downloadImage(
  url: string,
  outputPath: string
): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Image download failed: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    ensureDir(dirname(outputPath));
    writeFileSync(outputPath, buffer);
  } catch (error) {
    console.error(`❌ Image download failed (${url}):`, error);
    throw error;
  }
}

export function copyLocalAssetToAso(
  assetPath: string,
  outputPath: string,
  options?: { publicDir?: string }
): boolean {
  const publicDir = options?.publicDir ?? join(getDataDir(), "public");
  const trimmedPath = assetPath
    .replace(/^\.\//, "")
    .replace(/^public\//, "")
    .replace(/^\/+/, "");
  const sourcePath = join(publicDir, trimmedPath);

  if (!existsSync(sourcePath)) {
    console.warn(`⚠️  Local image not found: ${sourcePath}`);
    return false;
  }

  ensureDir(dirname(outputPath));
  copyFileSync(sourcePath, outputPath);
  return true;
}
