import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { AppError } from "@/packages/common/errors/app-error";
import { ERROR_CODES } from "@/packages/common/errors/error-codes";
import { HTTP_STATUS } from "@/packages/common/errors/status-codes";
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

  try {
    if (asoData.googlePlay) {
      const googlePlayDir = join(productStoreDir, "google-play");
      ensureDir(googlePlayDir);
      const filePath = join(googlePlayDir, "aso-data.json");
      writeFileSync(
        filePath,
        JSON.stringify({ googlePlay: asoData.googlePlay }, null, 2)
      );
      console.error(`💾 Google Play data saved to ${filePath}`);
    }

    if (asoData.appStore) {
      const appStoreDir = join(productStoreDir, "app-store");
      ensureDir(appStoreDir);
      const filePath = join(appStoreDir, "aso-data.json");
      writeFileSync(
        filePath,
        JSON.stringify({ appStore: asoData.appStore }, null, 2)
      );
      console.error(`💾 App Store data saved to ${filePath}`);
    }
  } catch (error) {
    throw AppError.io(
      ERROR_CODES.ASO_DATA_SAVE_FAILED,
      `Failed to save ASO data for ${slug}`,
      { slug, baseDir, cause: error }
    );
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
      throw AppError.validation(
        ERROR_CODES.ASO_GOOGLE_PLAY_DATA_PARSE_FAILED,
        `Failed to read Google Play ASO data for ${slug}`,
        { path: googlePlayPath, error }
      );
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
      throw AppError.validation(
        ERROR_CODES.ASO_APP_STORE_DATA_PARSE_FAILED,
        `Failed to read App Store ASO data for ${slug}`,
        { path: appStorePath, error }
      );
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
      throw AppError.io(
        ERROR_CODES.ASO_IMAGE_DOWNLOAD_FAILED,
        `Image download failed: ${response.status} ${response.statusText}`,
        { url, status: response.status, statusText: response.statusText }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    ensureDir(dirname(outputPath));
    writeFileSync(outputPath, buffer);
  } catch (error) {
    throw AppError.wrap(
      error,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODES.ASO_IMAGE_DOWNLOAD_FAILED,
      `Image download failed (${url})`
    );
  }
}

export function copyLocalAssetToAso(
  assetPath: string,
  outputPath: string,
  options?: { publicDir?: string }
): void {
  const publicDir = options?.publicDir ?? join(getDataDir(), "public");
  const trimmedPath = assetPath
    .replace(/^\.\//, "")
    .replace(/^public\//, "")
    .replace(/^\/+/, "");
  const sourcePath = join(publicDir, trimmedPath);

  if (!existsSync(sourcePath)) {
    throw AppError.fileNotFound(
      ERROR_CODES.ASO_LOCAL_ASSET_NOT_FOUND,
      `Local image not found: ${sourcePath}`,
      { sourcePath }
    );
  }

  ensureDir(dirname(outputPath));
  copyFileSync(sourcePath, outputPath);
}
