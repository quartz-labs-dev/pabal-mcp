/**
 * App Store Connect API Client
 *
 * Authentication: API Key (Issuer ID, Key ID, Private Key) required
 * API Documentation: https://developer.apple.com/documentation/appstoreconnectapi
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, basename } from "node:path";
import { createAppStoreJWT } from "@packages/app-store/auth";
import type {
  AppStoreAsoData,
  AppStoreMultilingualAsoData,
  AppStoreReleaseNote,
  AppStoreScreenshots,
} from "@packages/aso-core/types";
import { DEFAULT_LOCALE } from "@packages/aso-core/types";

export interface AppStoreClientConfig {
  issuerId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
}

interface ApiResponse<T> {
  data: T;
  links?: { self?: string; next?: string };
}

interface AppStoreApp {
  id: string;
  attributes: { name: string; bundleId: string; sku: string };
}

interface AppInfo {
  id: string;
  attributes: { appStoreState?: string };
}

interface AppInfoLocalization {
  id: string;
  attributes: {
    locale?: string;
    name?: string;
    subtitle?: string;
    privacyPolicyUrl?: string;
  };
}

interface AppStoreVersion {
  id: string;
  attributes: {
    versionString: string;
    platform: string;
    appStoreState?: string;
    releaseType?: string;
  };
}

interface AppStoreScreenshotSet {
  id: string;
  attributes: { screenshotDisplayType: string };
}

interface AppStoreScreenshot {
  id: string;
  attributes: {
    imageUrl?: string;
    fileName?: string;
    fileSize?: number;
    imageAsset?: { width?: number; height?: number; templateUrl?: string };
  };
}

interface AppStoreLocalization {
  id: string;
  attributes: {
    locale?: string;
    description?: string;
    keywords?: string;
    marketingUrl?: string;
    promotionalText?: string;
    supportUrl?: string;
    whatsNew?: string;
  };
}

const SCREENSHOT_TYPE_MAP: Record<string, keyof AppStoreScreenshots> = {
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

export class AppStoreClient {
  private issuerId: string;
  private keyId: string;
  private privateKey: string;
  private bundleId: string;
  private baseUrl = "https://api.appstoreconnect.apple.com/v1";

  constructor(config: AppStoreClientConfig) {
    this.issuerId = config.issuerId;
    this.keyId = config.keyId;
    this.privateKey = config.privateKey;
    this.bundleId = config.bundleId;
  }

  private async generateToken(): Promise<string> {
    if (!this.privateKey || !this.privateKey.includes("BEGIN PRIVATE KEY")) {
      throw new Error(
        "Invalid Private Key format. PEM format private key is required."
      );
    }

    const normalizedKey = this.privateKey.replace(/\\n/g, "\n").trim();

    return await createAppStoreJWT(
      { issuerId: this.issuerId, keyId: this.keyId, privateKey: normalizedKey },
      { expirationSeconds: 1200 }
    );
  }

  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.generateToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [] }));

      if (response.status === 401) {
        throw new Error(
          `App Store Connect API authentication failed (401 Unauthorized)\n` +
            `Issuer ID: ${this.issuerId}\n` +
            `Key ID: ${this.keyId}\n` +
            `Error: ${JSON.stringify(error, null, 2)}`
        );
      }

      if (response.status === 409) {
        const errorDetails = JSON.stringify(error, null, 2);
        if (errorDetails.includes("STATE_ERROR")) {
          throw new Error(
            `App Store Connect API error: 409 Conflict (STATE_ERROR)\n` +
              `Metadata cannot be modified in current state. Please check app status.\n` +
              `Error: ${errorDetails}`
          );
        }
      }

      throw new Error(
        `App Store Connect API error: ${response.status} ${
          response.statusText
        }\n${JSON.stringify(error, null, 2)}`
      );
    }

    return response.json();
  }

  /**
   * List all apps registered in the account
   * @param options.onlyReleased - If true, returns only released apps (apps with READY_FOR_SALE status)
   */
  async listAllApps(options: { onlyReleased?: boolean } = {}): Promise<
    Array<{
      id: string;
      name: string;
      bundleId: string;
      sku: string;
      isReleased: boolean;
    }>
  > {
    const { onlyReleased = false } = options;
    const apps: Array<{
      id: string;
      name: string;
      bundleId: string;
      sku: string;
      isReleased: boolean;
    }> = [];
    let nextUrl: string | null = `/apps?limit=200`;

    while (nextUrl) {
      const response: ApiResponse<AppStoreApp[]> = await this.apiRequest<
        ApiResponse<AppStoreApp[]>
      >(nextUrl);

      for (const app of response.data || []) {
        // Check release status
        const isReleased = await this.checkAppReleased(app.id);

        // If onlyReleased option is true, add only released apps
        if (onlyReleased && !isReleased) {
          continue;
        }

        // Get English name first
        const englishName = await this.getEnglishAppName(app.id);

        apps.push({
          id: app.id,
          name: englishName || app.attributes.name,
          bundleId: app.attributes.bundleId,
          sku: app.attributes.sku,
          isReleased,
        });
      }

      // Handle pagination
      nextUrl = response.links?.next
        ? response.links.next.replace(this.baseUrl, "")
        : null;
    }

    return apps;
  }

  /**
   * Check if app is released (has version with READY_FOR_SALE status)
   */
  private async checkAppReleased(appId: string): Promise<boolean> {
    try {
      const response = await this.apiRequest<ApiResponse<AppStoreVersion[]>>(
        `/apps/${appId}/appStoreVersions?filter[platform]=IOS&filter[appStoreState]=READY_FOR_SALE&limit=1`
      );
      return (response.data?.length || 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get English name of app (en-US first, then en-GB, then null)
   */
  private async getEnglishAppName(appId: string): Promise<string | null> {
    try {
      const appInfoId = await this.findAppInfoId(appId);

      // Find English localization
      const localizationsResponse = await this.apiRequest<
        ApiResponse<
          Array<{ id: string; attributes: { locale: string; name?: string } }>
        >
      >(`/appInfos/${appInfoId}/appInfoLocalizations`);

      const localizations = localizationsResponse.data || [];

      // en-US first, then en-GB, then anything starting with en
      const enUS = localizations.find((l) => l.attributes.locale === "en-US");
      if (enUS?.attributes.name) return enUS.attributes.name;

      const enGB = localizations.find((l) => l.attributes.locale === "en-GB");
      if (enGB?.attributes.name) return enGB.attributes.name;

      const enAny = localizations.find((l) =>
        l.attributes.locale?.startsWith("en")
      );
      if (enAny?.attributes.name) return enAny.attributes.name;

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get supported locales for an app
   */
  async getSupportedLocales(appId: string): Promise<string[]> {
    try {
      const appInfoId = await this.findAppInfoId(appId);

      // Get all localizations
      const localizationsResponse = await this.apiRequest<
        ApiResponse<
          Array<{ id: string; attributes: { locale: string; name?: string } }>
        >
      >(`/appInfos/${appInfoId}/appInfoLocalizations`);

      const localizations = localizationsResponse.data || [];
      return localizations
        .map((l) => l.attributes.locale)
        .filter((locale): locale is string => !!locale)
        .sort();
    } catch {
      return [];
    }
  }

  private async findAppId(): Promise<string> {
    const response = await this.apiRequest<ApiResponse<AppStoreApp[]>>(
      `/apps?filter[bundleId]=${this.bundleId}`
    );

    const app = response.data?.[0];
    if (!app) {
      throw new Error(`App not found for Bundle ID "${this.bundleId}".`);
    }

    return app.id;
  }

  private async findAppInfoId(appId?: string): Promise<string> {
    const targetAppId = appId || (await this.findAppId());

    const appInfosResponse = await this.apiRequest<ApiResponse<AppInfo[]>>(
      `/apps/${targetAppId}/appInfos?limit=1`
    );

    const appInfo = appInfosResponse.data?.[0];
    if (!appInfo) {
      throw new Error(`App Info not found for App ID "${targetAppId}".`);
    }

    return appInfo.id;
  }

  private sortVersions(versions: AppStoreVersion[]): AppStoreVersion[] {
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

  async pullAsoData(
    options: { locale?: string } = {}
  ): Promise<AppStoreAsoData> {
    const locale = options.locale || "en-US";
    const appId = await this.findAppId();
    const appInfoId = await this.findAppInfoId(appId);

    const appResponse = await this.apiRequest<ApiResponse<AppStoreApp>>(
      `/apps/${appId}`
    );
    const app = appResponse.data;

    const versionsResponse = await this.apiRequest<
      ApiResponse<AppStoreVersion[]>
    >(`/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10`);

    const version = this.sortVersions(versionsResponse.data || [])[0];
    if (!version) throw new Error("App Store version not found.");

    const localizationsResponse = await this.apiRequest<
      ApiResponse<AppStoreLocalization[]>
    >(
      `/appStoreVersions/${version.id}/appStoreVersionLocalizations?filter[locale]=${locale}`
    );

    const localization = localizationsResponse.data?.[0];
    let detailedLocalization: AppStoreLocalization | null = null;
    const appInfoLocalizationResponse = await this.apiRequest<
      ApiResponse<AppInfoLocalization[]>
    >(`/appInfos/${appInfoId}/appInfoLocalizations?filter[locale]=${locale}`);
    const appInfoLocalization = appInfoLocalizationResponse.data?.[0];

    if (localization) {
      detailedLocalization = (
        await this.apiRequest<ApiResponse<AppStoreLocalization>>(
          `/appStoreVersionLocalizations/${localization.id}`
        )
      ).data;
    }

    const screenshots: AppStoreScreenshots = {};

    if (localization) {
      const setsResponse = await this.apiRequest<
        ApiResponse<AppStoreScreenshotSet[]>
      >(`/appStoreVersionLocalizations/${localization.id}/appScreenshotSets`);

      for (const set of setsResponse.data || []) {
        const screenshotsResponse = await this.apiRequest<
          ApiResponse<AppStoreScreenshot[]>
        >(`/appScreenshotSets/${set.id}/appScreenshots`);

        const urls = (screenshotsResponse.data || [])
          .map(
            (s) => s.attributes.imageUrl || s.attributes.imageAsset?.templateUrl
          )
          .filter(Boolean) as string[];

        if (urls.length > 0) {
          const mappedType =
            SCREENSHOT_TYPE_MAP[set.attributes.screenshotDisplayType];
          if (mappedType) screenshots[mappedType] = urls;
        }
      }
    }

    return {
      name: appInfoLocalization?.attributes.name || app.attributes.name,
      subtitle: appInfoLocalization?.attributes.subtitle,
      description: detailedLocalization?.attributes.description || "",
      keywords: detailedLocalization?.attributes.keywords,
      promotionalText: detailedLocalization?.attributes.promotionalText,
      screenshots,
      bundleId: this.bundleId,
      locale,
      supportUrl: detailedLocalization?.attributes.supportUrl,
      marketingUrl: detailedLocalization?.attributes.marketingUrl,
      whatsNew: detailedLocalization?.attributes.whatsNew,
    };
  }

  async pullAllLocalesAsoData(): Promise<AppStoreMultilingualAsoData> {
    const appId = await this.findAppId();
    const appInfoId = await this.findAppInfoId(appId);
    const appResponse = await this.apiRequest<ApiResponse<AppStoreApp>>(
      `/apps/${appId}`
    );
    const app = appResponse.data;

    const appInfoLocalizationsResponse = await this.apiRequest<
      ApiResponse<AppInfoLocalization[]>
    >(`/appInfos/${appInfoId}/appInfoLocalizations`);
    const appInfoLocalizationMap = (appInfoLocalizationsResponse.data || []).reduce<
      Record<string, AppInfoLocalization>
    >((acc, loc) => {
      if (loc.attributes.locale) acc[loc.attributes.locale] = loc;
      return acc;
    }, {});

    const versionsResponse = await this.apiRequest<
      ApiResponse<AppStoreVersion[]>
    >(`/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10`);

    const version = this.sortVersions(versionsResponse.data || [])[0];
    if (!version) throw new Error("App Store version not found.");

    const localizationsResponse = await this.apiRequest<
      ApiResponse<AppStoreLocalization[]>
    >(`/appStoreVersions/${version.id}/appStoreVersionLocalizations`);

    const allLocalizations = localizationsResponse.data || [];
    console.log(
      `🌍 Found ${
        allLocalizations.length
      } App Store localizations: ${allLocalizations
        .map((l) => l.attributes.locale)
        .join(", ")}`
    );

    const locales: Record<string, AppStoreAsoData> = {};
    let defaultLocale: string | undefined;

    for (const localization of allLocalizations) {
      const locale = localization.attributes.locale;
      if (!locale) continue;

      const detailedLocalization = (
        await this.apiRequest<ApiResponse<AppStoreLocalization>>(
          `/appStoreVersionLocalizations/${localization.id}`
        )
      ).data;

      const screenshots: AppStoreScreenshots = {};

      const setsResponse = await this.apiRequest<
        ApiResponse<AppStoreScreenshotSet[]>
      >(`/appStoreVersionLocalizations/${localization.id}/appScreenshotSets`);

      for (const set of setsResponse.data || []) {
        const screenshotsResponse = await this.apiRequest<
          ApiResponse<AppStoreScreenshot[]>
        >(`/appScreenshotSets/${set.id}/appScreenshots`);

        const urls = (screenshotsResponse.data || [])
          .map(
            (s) => s.attributes.imageUrl || s.attributes.imageAsset?.templateUrl
          )
          .filter(Boolean) as string[];

        if (urls.length > 0) {
          const mappedType =
            SCREENSHOT_TYPE_MAP[set.attributes.screenshotDisplayType];
          if (mappedType) screenshots[mappedType] = urls;
        }
      }

      locales[locale] = {
        name:
          appInfoLocalizationMap[locale]?.attributes.name || app.attributes.name,
        subtitle: appInfoLocalizationMap[locale]?.attributes.subtitle,
        description: detailedLocalization?.attributes.description || "",
        keywords: detailedLocalization?.attributes.keywords,
        promotionalText: detailedLocalization?.attributes.promotionalText,
        screenshots,
        bundleId: this.bundleId,
        locale,
        supportUrl: detailedLocalization?.attributes.supportUrl,
        marketingUrl: detailedLocalization?.attributes.marketingUrl,
        whatsNew: detailedLocalization?.attributes.whatsNew,
      };

      if (!defaultLocale && locale === DEFAULT_LOCALE) {
        defaultLocale = locale;
      }
    }

    if (!defaultLocale && Object.keys(locales).length > 0) {
      defaultLocale = Object.keys(locales)[0];
    }

    return { locales, defaultLocale: defaultLocale || DEFAULT_LOCALE };
  }

  async pushAsoData(data: Partial<AppStoreAsoData>): Promise<void> {
    const appId = await this.findAppId();
    const appInfoId = await this.findAppInfoId(appId);
    const locale = data.locale || "en-US";

    const appInfoLocalizationResponse = await this.apiRequest<
      ApiResponse<AppInfoLocalization[]>
    >(`/appInfos/${appInfoId}/appInfoLocalizations?filter[locale]=${locale}`);

    const appInfoAttributes: Record<string, string> = {};
    if (typeof data.name === "string") appInfoAttributes.name = data.name;
    if (typeof data.subtitle === "string")
      appInfoAttributes.subtitle = data.subtitle;

    if (Object.keys(appInfoAttributes).length > 0) {
      try {
        if (appInfoLocalizationResponse.data?.[0]) {
          const localizationId = appInfoLocalizationResponse.data[0].id;
          await this.apiRequest(`/appInfoLocalizations/${localizationId}`, {
            method: "PATCH",
            body: JSON.stringify({
              data: {
                type: "appInfoLocalizations",
                id: localizationId,
                attributes: appInfoAttributes,
              },
            }),
          });
        } else {
          await this.apiRequest<ApiResponse<AppInfoLocalization>>(
            `/appInfoLocalizations`,
            {
              method: "POST",
              body: JSON.stringify({
                data: {
                  type: "appInfoLocalizations",
                  attributes: { locale, ...appInfoAttributes },
                  relationships: {
                    appInfo: { data: { type: "appInfos", id: appInfoId } },
                  },
                },
              }),
            }
          );
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // App Info fields may be locked when app is in certain states (e.g. submitted for review)
        if (msg.includes("STATE_ERROR") || msg.includes("409 Conflict")) {
          console.error(
            `[AppStore] ⚠️  Name/Subtitle update skipped for ${locale}: ${msg}`
          );
        } else {
          throw error;
        }
      }
    }

    const versionsResponse = await this.apiRequest<
      ApiResponse<AppStoreVersion[]>
    >(`/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10`);

    const version = this.sortVersions(versionsResponse.data || [])[0];
    if (!version) throw new Error("App Store version not found.");

    const localizationsResponse = await this.apiRequest<
      ApiResponse<AppStoreLocalization[]>
    >(
      `/appStoreVersions/${version.id}/appStoreVersionLocalizations?filter[locale]=${locale}`
    );

    let localizationId: string;

    if (localizationsResponse.data?.[0]) {
      localizationId = localizationsResponse.data[0].id;

      await this.apiRequest(`/appStoreVersionLocalizations/${localizationId}`, {
        method: "PATCH",
        body: JSON.stringify({
          data: {
            type: "appStoreVersionLocalizations",
            id: localizationId,
            attributes: {
              description: data.description,
              keywords: data.keywords,
              promotionalText: data.promotionalText,
              supportUrl: data.supportUrl,
              marketingUrl: data.marketingUrl,
            },
          },
        }),
      });
    } else {
      const createResponse = await this.apiRequest<
        ApiResponse<AppStoreLocalization>
      >(`/appStoreVersionLocalizations`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "appStoreVersionLocalizations",
            attributes: {
              locale,
              description: data.description,
              keywords: data.keywords,
              promotionalText: data.promotionalText,
              supportUrl: data.supportUrl,
              marketingUrl: data.marketingUrl,
            },
            relationships: {
              appStoreVersion: {
                data: { type: "appStoreVersions", id: version.id },
              },
            },
          },
        }),
      });

      localizationId = createResponse.data.id;
    }
  }

  async getAllVersions(limit = 50): Promise<AppStoreVersion[]> {
    const appId = await this.findAppId();

    const response = await this.apiRequest<ApiResponse<AppStoreVersion[]>>(
      `/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=${limit}`
    );

    return this.sortVersions(response.data || []);
  }

  async getLatestVersion(): Promise<AppStoreVersion | null> {
    const versions = await this.getAllVersions();
    return versions[0] || null;
  }

  incrementVersion(versionString: string): string {
    const parts = versionString.split(".").map(Number);
    while (parts.length < 3) parts.push(0);
    parts[parts.length - 1] = (parts[parts.length - 1] || 0) + 1;
    return parts.join(".");
  }

  async createNewVersion(versionString: string): Promise<AppStoreVersion> {
    const appId = await this.findAppId();

    const versionsResponse = await this.apiRequest<
      ApiResponse<AppStoreVersion[]>
    >(`/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=50`);

    const existing = versionsResponse.data?.find(
      (v) => v.attributes.versionString === versionString
    );

    if (existing) {
      console.log(`⚠️  Version ${versionString} already exists.`);
      return existing;
    }

    const createResponse = await this.apiRequest<ApiResponse<AppStoreVersion>>(
      `/appStoreVersions`,
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "appStoreVersions",
            attributes: { platform: "IOS", versionString },
            relationships: { app: { data: { type: "apps", id: appId } } },
          },
        }),
      }
    );

    console.log(`✅ Created new version: ${versionString}`);
    return createResponse.data;
  }

  async createNewVersionWithAutoIncrement(
    baseVersion?: string
  ): Promise<AppStoreVersion> {
    const appId = await this.findAppId();
    let newVersionString: string;

    if (baseVersion) {
      newVersionString = this.incrementVersion(baseVersion);
    } else {
      const latestVersion = await this.getLatestVersion();
      if (!latestVersion) {
        newVersionString = "1.0.0";
        console.log(
          `📦 No existing versions. Starting with ${newVersionString}`
        );
      } else {
        const latest = latestVersion.attributes.versionString;
        newVersionString = this.incrementVersion(latest);
        console.log(`📦 Latest: ${latest} → New: ${newVersionString}`);
      }
    }

    return this.createNewVersion(newVersionString);
  }

  async updateWhatsNew(options: {
    versionId: string;
    locale: string;
    whatsNew: string;
  }): Promise<void> {
    const { versionId, locale, whatsNew } = options;

    const localizationsResponse = await this.apiRequest<
      ApiResponse<AppStoreLocalization[]>
    >(
      `/appStoreVersions/${versionId}/appStoreVersionLocalizations?filter[locale]=${locale}`
    );

    if (localizationsResponse.data?.[0]) {
      const localizationId = localizationsResponse.data[0].id;
      await this.apiRequest(`/appStoreVersionLocalizations/${localizationId}`, {
        method: "PATCH",
        body: JSON.stringify({
          data: {
            type: "appStoreVersionLocalizations",
            id: localizationId,
            attributes: { whatsNew },
          },
        }),
      });
    } else {
      await this.apiRequest<ApiResponse<AppStoreLocalization>>(
        `/appStoreVersionLocalizations`,
        {
          method: "POST",
          body: JSON.stringify({
            data: {
              type: "appStoreVersionLocalizations",
              attributes: { locale, whatsNew },
              relationships: {
                appStoreVersion: {
                  data: { type: "appStoreVersions", id: versionId },
                },
              },
            },
          }),
        }
      );
    }

    console.log(`✅ Updated What's New for ${locale}`);
  }

  async pullReleaseNotes(): Promise<AppStoreReleaseNote[]> {
    const appId = await this.findAppId();

    const versionsResponse = await this.apiRequest<
      ApiResponse<AppStoreVersion[]>
    >(`/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=50`);

    const releaseNotes: AppStoreReleaseNote[] = [];

    for (const version of versionsResponse.data || []) {
      const versionString = version.attributes.versionString;
      const platform = version.attributes.platform;

      const localizationsResponse = await this.apiRequest<
        ApiResponse<AppStoreLocalization[]>
      >(`/appStoreVersions/${version.id}/appStoreVersionLocalizations`);

      const releaseNotesMap: Record<string, string> = {};

      for (const localization of localizationsResponse.data || []) {
        const locale = localization.attributes.locale;
        const whatsNew = localization.attributes.whatsNew;

        if (locale && whatsNew) {
          releaseNotesMap[locale] = whatsNew;
        }
      }

      if (Object.keys(releaseNotesMap).length > 0) {
        releaseNotes.push({
          versionString,
          releaseNotes: releaseNotesMap,
          platform,
        });
      }
    }

    return this.sortVersions(
      releaseNotes.map((rn) => ({
        id: "",
        attributes: { versionString: rn.versionString, platform: rn.platform },
      }))
    ).map(
      (v) =>
        releaseNotes.find(
          (rn) => rn.versionString === v.attributes.versionString
        )!
    );
  }
}
