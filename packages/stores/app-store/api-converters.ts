/**
 * App Store Connect API Data Converters
 *
 * Data transformation logic between API responses and internal types
 */

import type {
  AppStoreAsoData,
  AppStoreMultilingualAsoData,
  AppStoreReleaseNote,
  AppStoreScreenshots,
} from "@/packages/configs/aso-config/types";
import { DEFAULT_LOCALE } from "@/packages/configs/aso-config/constants";
import { SCREENSHOT_TYPE_MAP } from "./constants";
import type {
  ApiResponse,
  AppInfoLocalization,
  AppStoreApp,
  AppStoreLocalization,
  AppStoreScreenshot,
  AppStoreScreenshotSet,
  AppStoreVersion,
} from "./types";

export function sortVersions(versions: AppStoreVersion[]): AppStoreVersion[] {
  return versions.sort((a, b) => {
    const vA = a.attributes.versionString.split(".").map(Number);
    const vB = b.attributes.versionString.split(".").map(Number);
    for (let i = 0; i < Math.max(vA.length, vB.length); i++) {
      const diff = (vB[i] || 0) - (vA[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

export function selectEnglishAppName(
  localizations: AppInfoLocalization[]
): string | null {
  const enUS = localizations.find((l) => l.attributes.locale === "en-US");
  if (enUS?.attributes.name) return enUS.attributes.name;

  const enGB = localizations.find((l) => l.attributes.locale === "en-GB");
  if (enGB?.attributes.name) return enGB.attributes.name;

  const enAny = localizations.find((l) =>
    l.attributes.locale?.startsWith("en")
  );
  if (enAny?.attributes.name) return enAny.attributes.name;

  return null;
}

export function mapLocalizationsByLocale<
  T extends { attributes: { locale?: string } },
>(localizations: T[]): Record<string, T> {
  return localizations.reduce<Record<string, T>>((acc, loc) => {
    if (loc.attributes.locale) acc[loc.attributes.locale] = loc;
    return acc;
  }, {});
}

export async function fetchScreenshotsForLocalization(
  localizationId: string | undefined,
  listScreenshotSets: (
    localizationId: string
  ) => Promise<ApiResponse<AppStoreScreenshotSet[]>>,
  listScreenshots: (
    screenshotSetId: string
  ) => Promise<ApiResponse<AppStoreScreenshot[]>>
): Promise<AppStoreScreenshots> {
  const screenshots: AppStoreScreenshots = {};
  if (!localizationId) return screenshots;

  const setsResponse = await listScreenshotSets(localizationId);

  for (const set of setsResponse.data || []) {
    const screenshotsResponse = await listScreenshots(set.id);

    const urls = (screenshotsResponse.data || [])
      .map((s) => s.attributes.imageUrl || s.attributes.imageAsset?.templateUrl)
      .filter(Boolean) as string[];

    if (urls.length > 0) {
      const mappedType =
        SCREENSHOT_TYPE_MAP[set.attributes.screenshotDisplayType];
      if (mappedType) screenshots[mappedType] = urls;
    }
  }

  return screenshots;
}

export function convertToAsoData(params: {
  app: AppStoreApp;
  appInfoLocalization?: AppInfoLocalization | null;
  localization?: AppStoreLocalization | null;
  screenshots: AppStoreScreenshots;
  locale: string;
  bundleId: string;
}): AppStoreAsoData {
  const {
    app,
    appInfoLocalization,
    localization,
    screenshots,
    locale,
    bundleId,
  } = params;

  return {
    name: appInfoLocalization?.attributes.name || app.attributes.name,
    subtitle: appInfoLocalization?.attributes.subtitle,
    description: localization?.attributes.description || "",
    keywords: localization?.attributes.keywords,
    promotionalText: localization?.attributes.promotionalText,
    screenshots,
    bundleId,
    locale,
    supportUrl: localization?.attributes.supportUrl,
    marketingUrl: localization?.attributes.marketingUrl,
    whatsNew: localization?.attributes.whatsNew,
  };
}

export function convertToMultilingualAsoData(
  locales: Record<string, AppStoreAsoData>,
  defaultLocale?: string
): AppStoreMultilingualAsoData {
  let finalDefaultLocale = defaultLocale;

  if (!finalDefaultLocale && Object.keys(locales).length > 0) {
    if (locales[DEFAULT_LOCALE]) {
      finalDefaultLocale = DEFAULT_LOCALE;
    } else {
      finalDefaultLocale = Object.keys(locales)[0];
    }
  }

  return {
    locales,
    defaultLocale: finalDefaultLocale || DEFAULT_LOCALE,
  };
}

export function convertToReleaseNote(
  version: AppStoreVersion,
  localizations: AppStoreLocalization[]
): AppStoreReleaseNote | null {
  const releaseNotesMap: Record<string, string> = {};

  for (const localization of localizations) {
    const locale = localization.attributes.locale;
    const whatsNew = localization.attributes.whatsNew;

    if (locale && whatsNew) {
      releaseNotesMap[locale] = whatsNew;
    }
  }

  if (Object.keys(releaseNotesMap).length === 0) {
    return null;
  }

  return {
    versionString: version.attributes.versionString,
    releaseNotes: releaseNotesMap,
    platform: version.attributes.platform,
  };
}

export function sortReleaseNotes(
  releaseNotes: AppStoreReleaseNote[]
): AppStoreReleaseNote[] {
  const versionMap = new Map(
    releaseNotes.map((note) => [note.versionString, note])
  );

  const sortedVersions = sortVersions(
    releaseNotes.map((note) => ({
      id: note.versionString,
      attributes: {
        versionString: note.versionString,
        platform: note.platform,
      },
    }))
  );

  return sortedVersions
    .map((version) => versionMap.get(version.attributes.versionString))
    .filter(
      (note): note is AppStoreReleaseNote => !!note && !!note.versionString
    );
}
