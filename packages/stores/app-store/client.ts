/**
 * App Store Connect API Client
 *
 * Authentication: API Key (Issuer ID, Key ID, Private Key) required
 * API Documentation: https://developer.apple.com/documentation/appstoreconnectapi
 */

import { createAppStoreJWT } from "./auth";
import type {
  AppStoreAsoData,
  AppStoreMultilingualAsoData,
  AppStoreReleaseNote,
} from "@/packages/configs/aso-config/types";
import { DEFAULT_LOCALE } from "@/packages/configs/aso-config/constants";
import { AppStoreApiEndpoints } from "./api-endpoints";
import {
  convertToAsoData,
  convertToMultilingualAsoData,
  convertToReleaseNote,
  fetchScreenshotsForLocalization,
  mapLocalizationsByLocale,
  selectEnglishAppName,
  sortReleaseNotes,
  sortVersions,
} from "./api-converters";
import {
  APP_STORE_PLATFORM,
  DEFAULT_APP_LIST_LIMIT,
  DEFAULT_VERSIONS_FETCH_LIMIT,
} from "./constants";
import type { AppStoreClientConfig, AppStoreVersion } from "./types";

export class AppStoreClient {
  private issuerId: string;
  private keyId: string;
  private privateKey: string;
  private bundleId: string;
  private apiEndpoints: AppStoreApiEndpoints;

  constructor(config: AppStoreClientConfig) {
    this.issuerId = config.issuerId;
    this.keyId = config.keyId;
    this.privateKey = config.privateKey;
    this.bundleId = config.bundleId;
    this.apiEndpoints = new AppStoreApiEndpoints(
      () => this.generateToken(),
      this.issuerId,
      this.keyId
    );
  }

  private async generateToken(): Promise<string> {
    if (!this.privateKey || !this.privateKey.includes("BEGIN PRIVATE KEY")) {
      throw new Error(
        "Invalid Private Key format. PEM format private key is required."
      );
    }

    const normalizedKey = this.privateKey.replace(/\\n/g, "\n").trim();

    return await createAppStoreJWT(
      {
        issuerId: this.issuerId,
        keyId: this.keyId,
        privateKey: normalizedKey,
      },
      { expirationSeconds: 1200 }
    );
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
    let nextUrl: string | null = `/apps?limit=${DEFAULT_APP_LIST_LIMIT}`;

    while (nextUrl) {
      const response = await this.apiEndpoints.listApps(nextUrl);

      for (const app of response.data || []) {
        const isReleased = await this.checkAppReleased(app.id);

        if (onlyReleased && !isReleased) {
          continue;
        }

        const englishName = await this.getEnglishAppName(app.id);

        apps.push({
          id: app.id,
          name: englishName || app.attributes.name,
          bundleId: app.attributes.bundleId,
          sku: app.attributes.sku,
          isReleased,
        });
      }

      nextUrl = this.apiEndpoints.normalizeNextLink(response.links?.next);
    }

    return apps;
  }

  private async checkAppReleased(appId: string): Promise<boolean> {
    try {
      const response = await this.apiEndpoints.listAppStoreVersions(appId, {
        platform: APP_STORE_PLATFORM,
        state: "READY_FOR_SALE",
        limit: 1,
      });
      return (response.data?.length || 0) > 0;
    } catch {
      return false;
    }
  }

  private async getEnglishAppName(appId: string): Promise<string | null> {
    try {
      const appInfoId = await this.findAppInfoId(appId);

      const localizationsResponse =
        await this.apiEndpoints.listAppInfoLocalizations(appInfoId);

      return selectEnglishAppName(localizationsResponse.data || []);
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

      const localizationsResponse =
        await this.apiEndpoints.listAppInfoLocalizations(appInfoId);

      return (localizationsResponse.data || [])
        .map((l) => l.attributes.locale)
        .filter((locale): locale is string => !!locale)
        .sort();
    } catch {
      return [];
    }
  }

  private async findAppId(): Promise<string> {
    const response = await this.apiEndpoints.findAppByBundleId(this.bundleId);

    const app = response.data?.[0];
    if (!app) {
      throw new Error(`App not found for Bundle ID "${this.bundleId}".`);
    }

    return app.id;
  }

  private async findAppInfoId(appId?: string): Promise<string> {
    const targetAppId = appId || (await this.findAppId());

    const appInfosResponse = await this.apiEndpoints.listAppInfos(targetAppId);

    const appInfo = appInfosResponse.data?.[0];
    if (!appInfo) {
      throw new Error(`App Info not found for App ID "${targetAppId}".`);
    }

    return appInfo.id;
  }

  async pullAsoData(
    options: { locale?: string } = {}
  ): Promise<AppStoreAsoData> {
    const locale = options.locale || DEFAULT_LOCALE;
    const appId = await this.findAppId();
    const appInfoId = await this.findAppInfoId(appId);

    const [appResponse, versionsResponse, appInfoLocalizationResponse] =
      await Promise.all([
        this.apiEndpoints.getApp(appId),
        this.apiEndpoints.listAppStoreVersions(appId, {
          platform: APP_STORE_PLATFORM,
          limit: DEFAULT_VERSIONS_FETCH_LIMIT,
        }),
        this.apiEndpoints.listAppInfoLocalizations(appInfoId, locale),
      ]);

    const app = appResponse.data;
    const version = sortVersions(versionsResponse.data || [])[0];
    if (!version) throw new Error("App Store version not found.");

    const localizationsResponse =
      await this.apiEndpoints.listAppStoreVersionLocalizations(
        version.id,
        locale
      );

    const localization = localizationsResponse.data?.[0];
    const detailedLocalization = localization
      ? (
          await this.apiEndpoints.getAppStoreVersionLocalization(
            localization.id
          )
        ).data
      : null;

    const screenshots = await fetchScreenshotsForLocalization(
      localization?.id,
      (localizationId) => this.apiEndpoints.listScreenshotSets(localizationId),
      (setId) => this.apiEndpoints.listScreenshots(setId)
    );

    const appInfoLocalization = appInfoLocalizationResponse.data?.[0];

    return convertToAsoData({
      app,
      appInfoLocalization,
      localization: detailedLocalization,
      screenshots,
      locale,
      bundleId: this.bundleId,
    });
  }

  async pullAllLocalesAsoData(): Promise<AppStoreMultilingualAsoData> {
    const appId = await this.findAppId();
    const appInfoId = await this.findAppInfoId(appId);

    const [appResponse, appInfoLocalizationsResponse, versionsResponse] =
      await Promise.all([
        this.apiEndpoints.getApp(appId),
        this.apiEndpoints.listAppInfoLocalizations(appInfoId),
        this.apiEndpoints.listAppStoreVersions(appId, {
          platform: APP_STORE_PLATFORM,
          limit: DEFAULT_VERSIONS_FETCH_LIMIT,
        }),
      ]);

    const app = appResponse.data;

    const appInfoLocalizationMap = mapLocalizationsByLocale(
      appInfoLocalizationsResponse.data || []
    );

    const version = sortVersions(versionsResponse.data || [])[0];
    if (!version) throw new Error("App Store version not found.");

    const localizationsResponse =
      await this.apiEndpoints.listAppStoreVersionLocalizations(version.id);

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

      const detailedLocalization =
        (
          await this.apiEndpoints.getAppStoreVersionLocalization(
            localization.id
          )
        ).data ?? null;

      const screenshots = await fetchScreenshotsForLocalization(
        localization.id,
        (localizationId) =>
          this.apiEndpoints.listScreenshotSets(localizationId),
        (setId) => this.apiEndpoints.listScreenshots(setId)
      );

      locales[locale] = convertToAsoData({
        app,
        appInfoLocalization: appInfoLocalizationMap[locale],
        localization: detailedLocalization,
        screenshots,
        locale,
        bundleId: this.bundleId,
      });

      if (!defaultLocale && locale === DEFAULT_LOCALE) {
        defaultLocale = locale;
      }
    }

    return convertToMultilingualAsoData(locales, defaultLocale);
  }

  async pushAsoData(data: Partial<AppStoreAsoData>): Promise<{
    failedFields?: string[];
  }> {
    const appId = await this.findAppId();
    const appInfoId = await this.findAppInfoId(appId);
    const locale = data.locale || DEFAULT_LOCALE;

    const appInfoLocalizationResponse =
      await this.apiEndpoints.listAppInfoLocalizations(appInfoId, locale);

    const appInfoAttributes: Record<string, string> = {};
    const attemptedFields: string[] = [];
    if (typeof data.name === "string") {
      appInfoAttributes.name = data.name;
      attemptedFields.push("name");
    }
    if (typeof data.subtitle === "string") {
      appInfoAttributes.subtitle = data.subtitle;
      attemptedFields.push("subtitle");
    }

    const failedFields: string[] = [];

    if (Object.keys(appInfoAttributes).length > 0) {
      try {
        if (appInfoLocalizationResponse.data?.[0]) {
          const localizationId = appInfoLocalizationResponse.data[0].id;
          await this.apiEndpoints.updateAppInfoLocalization(
            localizationId,
            appInfoAttributes
          );
        } else {
          await this.apiEndpoints.createAppInfoLocalization(
            appInfoId,
            locale,
            appInfoAttributes
          );
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("STATE_ERROR") || msg.includes("409 Conflict")) {
          failedFields.push(...attemptedFields);
          console.error(
            `[AppStore] ⚠️  Name/Subtitle update failed for ${locale}: ${msg}`
          );
          console.error(
            `[AppStore]   ℹ️  Name and Subtitle can only be updated when a new version is created.`
          );
          console.error(
            `[AppStore]   ⏭️  Continuing with other ASO fields (description, keywords, etc.)...`
          );
        } else {
          throw error;
        }
      }
    }

    const versionsResponse = await this.apiEndpoints.listAppStoreVersions(
      appId,
      {
        platform: APP_STORE_PLATFORM,
        limit: DEFAULT_VERSIONS_FETCH_LIMIT,
      }
    );

    const version = sortVersions(versionsResponse.data || [])[0];
    if (!version) throw new Error("App Store version not found.");

    const localizationsResponse =
      await this.apiEndpoints.listAppStoreVersionLocalizations(
        version.id,
        locale
      );

    let localizationId: string;

    if (localizationsResponse.data?.[0]) {
      localizationId = localizationsResponse.data[0].id;

      await this.apiEndpoints.updateAppStoreVersionLocalization(
        localizationId,
        {
          description: data.description,
          keywords: data.keywords,
          promotionalText: data.promotionalText,
          supportUrl: data.supportUrl,
          marketingUrl: data.marketingUrl,
        }
      );
    } else {
      const createResponse =
        await this.apiEndpoints.createAppStoreVersionLocalization(
          version.id,
          locale,
          {
            description: data.description,
            keywords: data.keywords,
            promotionalText: data.promotionalText,
            supportUrl: data.supportUrl,
            marketingUrl: data.marketingUrl,
          }
        );

      localizationId = createResponse.data.id;
    }

    return failedFields.length > 0 ? { failedFields } : {};
  }

  async getAllVersions(limit = 50): Promise<AppStoreVersion[]> {
    const appId = await this.findAppId();

    const response = await this.apiEndpoints.listAppStoreVersions(appId, {
      platform: APP_STORE_PLATFORM,
      limit,
    });

    return sortVersions(response.data || []);
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

    const versionsResponse = await this.apiEndpoints.listAppStoreVersions(
      appId,
      {
        platform: APP_STORE_PLATFORM,
        limit: 50,
      }
    );

    const existing = versionsResponse.data?.find(
      (v) => v.attributes.versionString === versionString
    );

    if (existing) {
      console.log(`⚠️  Version ${versionString} already exists.`);
      return existing;
    }

    const createResponse = await this.apiEndpoints.createAppStoreVersion(
      appId,
      versionString,
      APP_STORE_PLATFORM
    );

    console.log(`✅ Created new version: ${versionString}`);
    return createResponse.data;
  }

  async createNewVersionWithAutoIncrement(
    baseVersion?: string
  ): Promise<AppStoreVersion> {
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

    const localizationsResponse =
      await this.apiEndpoints.listAppStoreVersionLocalizations(
        versionId,
        locale
      );

    if (localizationsResponse.data?.[0]) {
      const localizationId = localizationsResponse.data[0].id;
      await this.apiEndpoints.updateAppStoreVersionLocalization(
        localizationId,
        { whatsNew }
      );
    } else {
      await this.apiEndpoints.createAppStoreVersionLocalization(
        versionId,
        locale,
        { whatsNew }
      );
    }

    console.log(`✅ Updated What's New for ${locale}`);
  }

  async pullReleaseNotes(): Promise<AppStoreReleaseNote[]> {
    const appId = await this.findAppId();

    const versionsResponse = await this.apiEndpoints.listAppStoreVersions(
      appId,
      {
        platform: APP_STORE_PLATFORM,
        limit: 50,
      }
    );

    const releaseNotes: AppStoreReleaseNote[] = [];

    for (const version of versionsResponse.data || []) {
      const localizationsResponse =
        await this.apiEndpoints.listAppStoreVersionLocalizations(version.id);

      const releaseNote = convertToReleaseNote(
        version,
        localizationsResponse.data || []
      );

      if (releaseNote) {
        releaseNotes.push(releaseNote);
      }
    }

    return sortReleaseNotes(releaseNotes);
  }
}
