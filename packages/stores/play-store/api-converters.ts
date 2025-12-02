/**
 * Google Play Console API Data Converters
 *
 * Data transformation logic between API responses and internal types
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  GooglePlayAsoData,
  GooglePlayMultilingualAsoData,
  GooglePlayReleaseNote,
} from "@/packages/configs/aso-config/types";
import { DEFAULT_LOCALE } from "@/packages/configs/aso-config/constants";
import type { ScreenshotUrls } from "./types";
import { IMAGE_TYPES, type ImageType } from "./constants";

/**
 * Convert API image responses to screenshot URLs structure
 */
export async function fetchScreenshotsAndFeatureGraphic(
  fetchImagesFunc: (imageType: ImageType) => Promise<any>,
  language: string
): Promise<{
  screenshots: ScreenshotUrls;
  featureGraphic: string | undefined;
}> {
  const screenshots: ScreenshotUrls = {
    phone: [],
    tablet7: [],
    tablet10: [],
    tv: [],
    wear: [],
  };

  let featureGraphic: string | undefined;

  for (const imageType of IMAGE_TYPES) {
    try {
      const imagesResponse = await fetchImagesFunc(imageType);
      const images = imagesResponse.data.images || [];

      if (imageType === "featureGraphic") {
        featureGraphic = images[0]?.url;
      } else {
        const urls = images
          .map((img: any) => img.url)
          .filter(Boolean) as string[];

        if (imageType === "phoneScreenshots") {
          screenshots.phone.push(...urls);
        } else if (imageType === "sevenInchScreenshots") {
          screenshots.tablet7.push(...urls);
        } else if (imageType === "tenInchScreenshots") {
          screenshots.tablet10.push(...urls);
        } else if (imageType === "tvScreenshots") {
          screenshots.tv.push(...urls);
        } else if (imageType === "wearScreenshots") {
          screenshots.wear.push(...urls);
        }
      }
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code !== 404) {
        console.warn(
          `⚠️  Failed to fetch ${imageType} images for ${language}:`,
          err.message
        );
      }
    }
  }

  return { screenshots, featureGraphic };
}

/**
 * Convert API listing response to GooglePlayAsoData
 */
export function convertToAsoData(
  listingData: any,
  appDetailsData: any,
  screenshots: ScreenshotUrls,
  featureGraphic: string | undefined,
  packageName: string,
  defaultLanguage: string
): GooglePlayAsoData {
  return {
    title: listingData.title || "",
    shortDescription: listingData.shortDescription || "",
    fullDescription: listingData.fullDescription || "",
    screenshots,
    featureGraphic,
    category: appDetailsData.category || "",
    packageName,
    defaultLanguage,
    contactEmail: appDetailsData.contactEmail ?? undefined,
    contactPhone: appDetailsData.contactPhone ?? undefined,
    contactWebsite: appDetailsData.contactWebsite ?? undefined,
  };
}

/**
 * Convert API listing to locale-specific ASO data
 */
export function convertToLocaleAsoData(
  listingData: any,
  appDetailsData: any,
  screenshots: ScreenshotUrls,
  featureGraphic: string | undefined,
  packageName: string,
  language: string
): GooglePlayAsoData {
  return {
    title: listingData.title || "",
    shortDescription: listingData.shortDescription || "",
    fullDescription: listingData.fullDescription || "",
    screenshots,
    featureGraphic,
    category: appDetailsData.category || "",
    packageName,
    defaultLanguage: language,
    contactEmail: appDetailsData.contactEmail ?? undefined,
    contactPhone: appDetailsData.contactPhone ?? undefined,
    contactWebsite: appDetailsData.contactWebsite ?? undefined,
  };
}

/**
 * Convert multiple locales data to multilingual ASO data structure
 */
export function convertToMultilingualAsoData(
  locales: Record<string, GooglePlayAsoData>,
  defaultLocale?: string
): GooglePlayMultilingualAsoData {
  let finalDefaultLocale = defaultLocale;

  if (!finalDefaultLocale && Object.keys(locales).length > 0) {
    // Try to find DEFAULT_LOCALE
    if (locales[DEFAULT_LOCALE]) {
      finalDefaultLocale = DEFAULT_LOCALE;
    } else {
      // Use first available locale
      finalDefaultLocale = Object.keys(locales)[0];
    }
  }

  return {
    locales,
    defaultLocale: finalDefaultLocale || DEFAULT_LOCALE,
  };
}

/**
 * Build request body for listing update (only defined values)
 */
export function buildListingRequestBody(data: {
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
}): Record<string, string> {
  const body: Record<string, string> = {};

  if (data.title) body.title = data.title;
  if (data.shortDescription) body.shortDescription = data.shortDescription;
  if (data.fullDescription) body.fullDescription = data.fullDescription;

  return body;
}

/**
 * Build request body for app details update (only defined values)
 */
export function buildDetailsRequestBody(data: {
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
  defaultLanguage?: string;
}): Record<string, string> {
  const body: Record<string, string> = {};

  if (data.defaultLanguage) body.defaultLanguage = data.defaultLanguage;
  if (data.contactEmail) body.contactEmail = data.contactEmail;
  if (data.contactPhone) body.contactPhone = data.contactPhone;
  if (data.contactWebsite) body.contactWebsite = data.contactWebsite;

  return body;
}

/**
 * Convert track release data to GooglePlayReleaseNote
 */
export function convertToReleaseNote(
  release: any,
  versionCode: string | number,
  trackName: string
): GooglePlayReleaseNote | null {
  const releaseNotesMap: Record<string, string> = {};

  if (release.releaseNotes) {
    for (const rn of release.releaseNotes) {
      if (rn.language && rn.text) {
        releaseNotesMap[rn.language] = rn.text;
      }
    }
  }

  if (Object.keys(releaseNotesMap).length === 0) {
    return null;
  }

  const releaseDate = release.releaseDate?.seconds
    ? new Date(Number(release.releaseDate.seconds) * 1000).toISOString()
    : undefined;

  return {
    versionCode: Number(versionCode),
    versionName: versionCode.toString(),
    releaseNotes: releaseNotesMap,
    track: trackName,
    status: release.status || "draft",
    releaseDate,
  };
}

/**
 * Convert release notes map to API format
 */
export function convertReleaseNotesToApiFormat(
  releaseNotes: Record<string, string>
): Array<{ language: string; text: string }> {
  return Object.entries(releaseNotes).map(([language, text]) => ({
    language,
    text,
  }));
}

/**
 * Extract latest release from track releases
 */
export function extractLatestRelease(releases: any[]): {
  versionCodes: number[];
  status?: string;
  versionName?: string;
  releaseName?: string;
  releaseDate?: string;
} | null {
  if (releases.length === 0) {
    return null;
  }

  let latestRelease: (typeof releases)[number] | null = null;
  let latestVersionCode = 0;

  for (const release of releases) {
    const versionCodes = (release.versionCodes || []).map(
      (code: string | number) => Number(code)
    );
    const maxVersionCode = versionCodes.reduce(
      (max: number, code: number) => Math.max(max, code),
      0
    );

    if (!latestRelease || maxVersionCode > latestVersionCode) {
      latestRelease = release;
      latestVersionCode = maxVersionCode;
    }
  }

  if (!latestRelease) {
    return null;
  }

  const releaseDate = (latestRelease as any).releaseDate?.seconds
    ? new Date(
        Number((latestRelease as any).releaseDate.seconds) * 1000
      ).toISOString()
    : undefined;

  return {
    versionCodes: (latestRelease.versionCodes || []).map(
      (code: string | number) => Number(code)
    ),
    status: latestRelease.status ?? undefined,
    versionName: latestRelease.name ?? undefined,
    releaseName: latestRelease.name ?? undefined,
    releaseDate,
  };
}
