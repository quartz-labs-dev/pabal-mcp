/**
 * App Store Connect API Client
 *
 * Authentication: API Key (Issuer ID, Key ID, Private Key) required
 * API Documentation: https://developer.apple.com/documentation/appstoreconnectapi
 */

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { AppStoreConnectAPI } from "appstore-connect-sdk";
import {
  AppsApi,
  AppInfosApi,
  AppInfoLocalizationsApi,
  AppScreenshotSetsApi,
  AppScreenshotsApi,
  AppStoreVersionLocalizationsApi,
  AppStoreVersionsApi,
  AppsAppStoreVersionsGetToManyRelatedFilterAppStoreStateEnum,
  AppsAppStoreVersionsGetToManyRelatedFilterPlatformEnum,
  BaseAPI,
  Configuration,
  ResponseError,
  type AppsResponse,
} from "appstore-connect-sdk/openapi";
import type { Platform } from "appstore-connect-sdk/openapi";
import type {
  AppStoreAsoData,
  AppStoreMultilingualAsoData,
  AppStoreReleaseNote,
} from "@/packages/configs/aso-config/types";
import { DEFAULT_LOCALE } from "@/packages/configs/aso-config/constants";
import { getAsoDir } from "@/packages/configs/aso-config/utils";
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
  APP_STORE_API_BASE_URL,
  APP_STORE_PLATFORM,
  DEFAULT_APP_LIST_LIMIT,
  DEFAULT_VERSIONS_FETCH_LIMIT,
} from "./constants";
import type {
  ApiResponse,
  AppInfo,
  AppInfoLocalization,
  AppInfoLocalizationUpdateAttributes,
  AppStoreApp,
  AppStoreClientConfig,
  AppStoreLocalization,
  AppStoreScreenshot,
  AppStoreScreenshotSet,
  AppStoreVersion,
  AppStoreVersionLocalizationUpdateAttributes,
} from "./types";

type ApiClass<T extends BaseAPI> = new (configuration?: Configuration) => T;

const APP_STORE_SCREENSHOT_SET_MAX_COUNT = 10;
const DEFAULT_IMAGE_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const SCREENSHOT_UPLOAD_LOCK_STALE_MS = 30 * 60 * 1000;

export class AppStoreClient {
  private issuerId: string;
  private keyId: string;
  private privateKey: string;
  private bundleId: string;
  private sdk: AppStoreConnectAPI;
  private apiCache = new Map<ApiClass<BaseAPI>, Promise<BaseAPI>>();

  constructor(config: AppStoreClientConfig) {
    this.issuerId = config.issuerId;
    this.keyId = config.keyId;
    this.privateKey = this.normalizePrivateKey(config.privateKey);
    this.bundleId = config.bundleId;
    this.sdk = new AppStoreConnectAPI({
      issuerId: this.issuerId,
      privateKeyId: this.keyId,
      privateKey: this.privateKey,
    });
  }

  private normalizePrivateKey(rawKey: string): string {
    if (!rawKey || !rawKey.includes("BEGIN PRIVATE KEY")) {
      throw new Error(
        "Invalid Private Key format. PEM format private key is required."
      );
    }

    return rawKey.replace(/\\n/g, "\n").trim();
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
      const response = await this.listApps(nextUrl);

      for (const app of response.data || []) {
        const isReleased = await this.checkAppReleased(app.id);

        if (onlyReleased && !isReleased) {
          continue;
        }

        const englishName = await this.getEnglishAppName(app.id);

        apps.push({
          id: app.id,
          name: englishName || app.attributes?.name || "Unknown",
          bundleId: app.attributes?.bundleId || "",
          sku: app.attributes?.sku || "",
          isReleased,
        });
      }

      nextUrl = this.normalizeNextLink(response.links?.next);
    }

    return apps;
  }

  private async checkAppReleased(appId: string): Promise<boolean> {
    try {
      const response = await this.listAppStoreVersions(appId, {
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
        await this.listAppInfoLocalizations(appInfoId);

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
        await this.listAppInfoLocalizations(appInfoId);

      return (localizationsResponse.data || [])
        .map((l) => l.attributes?.locale)
        .filter((locale): locale is string => !!locale)
        .sort();
    } catch {
      return [];
    }
  }

  private async findAppId(): Promise<string> {
    const response = await this.findAppByBundleId(this.bundleId);

    const app = response.data?.[0];
    if (!app) {
      throw new Error(`App not found for Bundle ID "${this.bundleId}".`);
    }

    return app.id;
  }

  private async findAppInfoId(appId?: string): Promise<string> {
    const targetAppId = appId || (await this.findAppId());

    const appInfosResponse = await this.listAppInfos(targetAppId);

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
        this.getApp(appId),
        this.listAppStoreVersions(appId, {
          platform: APP_STORE_PLATFORM,
          limit: DEFAULT_VERSIONS_FETCH_LIMIT,
        }),
        this.listAppInfoLocalizations(appInfoId, locale),
      ]);

    const app = appResponse.data;
    const version = sortVersions(versionsResponse.data || [])[0];
    if (!version) throw new Error("App Store version not found.");

    const localizationsResponse = await this.listAppStoreVersionLocalizations(
      version.id,
      locale
    );

    const localization = localizationsResponse.data?.[0];
    const detailedLocalization = localization
      ? (await this.getAppStoreVersionLocalization(localization.id)).data
      : null;

    const screenshots = await fetchScreenshotsForLocalization(
      localization?.id,
      (localizationId) => this.listScreenshotSets(localizationId),
      (setId) => this.listScreenshots(setId)
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
        this.getApp(appId),
        this.listAppInfoLocalizations(appInfoId),
        this.listAppStoreVersions(appId, {
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

    const localizationsResponse = await this.listAppStoreVersionLocalizations(
      version.id
    );

    const allLocalizations = localizationsResponse.data || [];
    console.error(
      `🌍 Found ${
        allLocalizations.length
      } App Store localizations: ${allLocalizations
        .map((l) => l.attributes?.locale)
        .join(", ")}`
    );

    const locales: Record<string, AppStoreAsoData> = {};
    let defaultLocale: string | undefined;

    for (const localization of allLocalizations) {
      const locale = localization.attributes?.locale;
      if (!locale) continue;

      const detailedLocalization =
        (await this.getAppStoreVersionLocalization(localization.id)).data ??
        null;

      const screenshots = await fetchScreenshotsForLocalization(
        localization.id,
        (localizationId) => this.listScreenshotSets(localizationId),
        (setId) => this.listScreenshots(setId)
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

    const appInfoLocalizationResponse = await this.listAppInfoLocalizations(
      appInfoId,
      locale
    );

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
          await this.updateAppInfoLocalization(
            localizationId,
            appInfoAttributes
          );
        } else {
          await this.createAppInfoLocalization(
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

    const versionsResponse = await this.listAppStoreVersions(appId, {
      platform: APP_STORE_PLATFORM,
      limit: DEFAULT_VERSIONS_FETCH_LIMIT,
    });

    const version = sortVersions(versionsResponse.data || [])[0];
    if (!version) throw new Error("App Store version not found.");

    const localizationsResponse = await this.listAppStoreVersionLocalizations(
      version.id,
      locale
    );

    let localizationId: string;

    if (localizationsResponse.data?.[0]) {
      localizationId = localizationsResponse.data[0].id;

      await this.updateAppStoreVersionLocalization(localizationId, {
        description: data.description,
        keywords: data.keywords,
        promotionalText: data.promotionalText,
        supportUrl: data.supportUrl,
        marketingUrl: data.marketingUrl,
      });
    } else {
      const createResponse = await this.createAppStoreVersionLocalization(
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

    const response = await this.listAppStoreVersions(appId, {
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

    const versionsResponse = await this.listAppStoreVersions(appId, {
      platform: APP_STORE_PLATFORM,
      limit: 50,
    });

    const existing = versionsResponse.data?.find(
      (v) => v.attributes?.versionString === versionString
    );

    if (existing) {
      console.error(`⚠️  Version ${versionString} already exists.`);
      return existing;
    }

    const createResponse = await this.createAppStoreVersion(
      appId,
      versionString,
      APP_STORE_PLATFORM
    );

    console.error(`✅ Created new version: ${versionString}`);
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
        console.error(
          `📦 No existing versions. Starting with ${newVersionString}`
        );
      } else {
        const latest = latestVersion.attributes?.versionString ?? "0.0.0";
        newVersionString = this.incrementVersion(latest);
        console.error(`📦 Latest: ${latest} → New: ${newVersionString}`);
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

    const localizationsResponse = await this.listAppStoreVersionLocalizations(
      versionId,
      locale
    );

    if (localizationsResponse.data?.[0]) {
      const localizationId = localizationsResponse.data[0].id;
      await this.updateAppStoreVersionLocalization(localizationId, {
        whatsNew,
      });
    } else {
      await this.createAppStoreVersionLocalization(versionId, locale, {
        whatsNew,
      });
    }

    console.error(`✅ Updated What's New for ${locale}`);
  }

  async pullReleaseNotes(): Promise<AppStoreReleaseNote[]> {
    const appId = await this.findAppId();

    const versionsResponse = await this.listAppStoreVersions(appId, {
      platform: APP_STORE_PLATFORM,
      limit: 50,
    });

    const releaseNotes: AppStoreReleaseNote[] = [];

    for (const version of versionsResponse.data || []) {
      const localizationsResponse = await this.listAppStoreVersionLocalizations(
        version.id
      );

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

  private normalizeNextLink(nextLink?: string | null): string | null {
    if (!nextLink) return null;
    return nextLink.replace(APP_STORE_API_BASE_URL, "");
  }

  private async listApps(
    nextUrl = `/apps?limit=${DEFAULT_APP_LIST_LIMIT}`
  ): Promise<ApiResponse<AppStoreApp[]>> {
    return this.requestCollection<AppsResponse>(nextUrl);
  }

  private async findAppByBundleId(
    bundleId: string
  ): Promise<ApiResponse<AppStoreApp[]>> {
    const appsApi = await this.getApi(AppsApi);

    try {
      return await appsApi.appsGetCollection({
        filterBundleId: [bundleId],
      });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async getApp(appId: string): Promise<ApiResponse<AppStoreApp>> {
    const appsApi = await this.getApi(AppsApi);

    try {
      return await appsApi.appsGetInstance({ id: appId });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async listAppInfos(appId: string): Promise<ApiResponse<AppInfo[]>> {
    const appsApi = await this.getApi(AppsApi);

    try {
      return await appsApi.appsAppInfosGetToManyRelated({
        id: appId,
        limit: 1,
      });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async listAppInfoLocalizations(
    appInfoId: string,
    locale?: string
  ): Promise<ApiResponse<AppInfoLocalization[]>> {
    const appInfosApi = await this.getApi(AppInfosApi);

    try {
      return await appInfosApi.appInfosAppInfoLocalizationsGetToManyRelated({
        id: appInfoId,
        filterLocale: locale ? [locale] : undefined,
      });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async updateAppInfoLocalization(
    localizationId: string,
    attributes: AppInfoLocalizationUpdateAttributes
  ): Promise<void> {
    const appInfoLocalizationsApi = await this.getApi(AppInfoLocalizationsApi);

    try {
      await appInfoLocalizationsApi.appInfoLocalizationsUpdateInstance({
        id: localizationId,
        appInfoLocalizationUpdateRequest: {
          data: {
            type: "appInfoLocalizations",
            id: localizationId,
            attributes,
          },
        },
      });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async createAppInfoLocalization(
    appInfoId: string,
    locale: string,
    attributes: AppInfoLocalizationUpdateAttributes
  ): Promise<ApiResponse<AppInfoLocalization>> {
    const appInfoLocalizationsApi = await this.getApi(AppInfoLocalizationsApi);

    try {
      return await appInfoLocalizationsApi.appInfoLocalizationsCreateInstance({
        appInfoLocalizationCreateRequest: {
          data: {
            type: "appInfoLocalizations",
            attributes: { locale, ...attributes },
            relationships: {
              appInfo: {
                data: { type: "appInfos", id: appInfoId },
              },
            },
          },
        },
      });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async listAppStoreVersions(
    appId: string,
    options: { platform?: string; state?: string; limit?: number } = {}
  ): Promise<ApiResponse<AppStoreVersion[]>> {
    const {
      platform = APP_STORE_PLATFORM,
      state,
      limit = DEFAULT_VERSIONS_FETCH_LIMIT,
    } = options;

    const appsApi = await this.getApi(AppsApi);

    try {
      return await appsApi.appsAppStoreVersionsGetToManyRelated({
        id: appId,
        filterPlatform: [
          platform as AppsAppStoreVersionsGetToManyRelatedFilterPlatformEnum,
        ],
        filterAppStoreState: state
          ? [
              state as AppsAppStoreVersionsGetToManyRelatedFilterAppStoreStateEnum,
            ]
          : undefined,
        limit,
      });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async createAppStoreVersion(
    appId: string,
    versionString: string,
    platform = APP_STORE_PLATFORM
  ): Promise<ApiResponse<AppStoreVersion>> {
    const appStoreVersionsApi = await this.getApi(AppStoreVersionsApi);

    try {
      return await appStoreVersionsApi.appStoreVersionsCreateInstance({
        appStoreVersionCreateRequest: {
          data: {
            type: "appStoreVersions",
            attributes: {
              platform: platform as Platform,
              versionString,
            },
            relationships: {
              app: { data: { type: "apps", id: appId } },
            },
          },
        },
      });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async listAppStoreVersionLocalizations(
    versionId: string,
    locale?: string
  ): Promise<ApiResponse<AppStoreLocalization[]>> {
    const appStoreVersionsApi = await this.getApi(AppStoreVersionsApi);

    try {
      const response =
        await appStoreVersionsApi.appStoreVersionsAppStoreVersionLocalizationsGetToManyRelated(
          {
            id: versionId,
          }
        );

      if (!locale) return response;

      return {
        ...response,
        data: (response.data || []).filter(
          (localization) => localization.attributes?.locale === locale
        ),
      };
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async getAppStoreVersionLocalization(
    localizationId: string
  ): Promise<ApiResponse<AppStoreLocalization>> {
    const appStoreVersionLocalizationsApi = await this.getApi(
      AppStoreVersionLocalizationsApi
    );

    try {
      return await appStoreVersionLocalizationsApi.appStoreVersionLocalizationsGetInstance(
        { id: localizationId }
      );
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async updateAppStoreVersionLocalization(
    localizationId: string,
    attributes: AppStoreVersionLocalizationUpdateAttributes
  ): Promise<void> {
    const appStoreVersionLocalizationsApi = await this.getApi(
      AppStoreVersionLocalizationsApi
    );

    try {
      await appStoreVersionLocalizationsApi.appStoreVersionLocalizationsUpdateInstance(
        {
          id: localizationId,
          appStoreVersionLocalizationUpdateRequest: {
            data: {
              type: "appStoreVersionLocalizations",
              id: localizationId,
              attributes,
            },
          },
        }
      );
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async createAppStoreVersionLocalization(
    versionId: string,
    locale: string,
    attributes: AppStoreVersionLocalizationUpdateAttributes
  ): Promise<ApiResponse<AppStoreLocalization>> {
    const appStoreVersionLocalizationsApi = await this.getApi(
      AppStoreVersionLocalizationsApi
    );

    try {
      return await appStoreVersionLocalizationsApi.appStoreVersionLocalizationsCreateInstance(
        {
          appStoreVersionLocalizationCreateRequest: {
            data: {
              type: "appStoreVersionLocalizations",
              attributes: { locale, ...attributes },
              relationships: {
                appStoreVersion: {
                  data: { type: "appStoreVersions", id: versionId },
                },
              },
            },
          },
        }
      );
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async listScreenshotSets(
    localizationId: string
  ): Promise<ApiResponse<AppStoreScreenshotSet[]>> {
    const appStoreVersionLocalizationsApi = await this.getApi(
      AppStoreVersionLocalizationsApi
    );

    try {
      return await appStoreVersionLocalizationsApi.appStoreVersionLocalizationsAppScreenshotSetsGetToManyRelated(
        { id: localizationId }
      );
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private async listScreenshots(
    screenshotSetId: string
  ): Promise<ApiResponse<AppStoreScreenshot[]>> {
    const appScreenshotSetsApi = await this.getApi(AppScreenshotSetsApi);

    try {
      return await appScreenshotSetsApi.appScreenshotSetsAppScreenshotsGetToManyRelated(
        { id: screenshotSetId }
      );
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  /**
   * Upload a screenshot to App Store Connect
   * Full implementation with 4-step process:
   * 1. Find or create Screenshot Set for display type and locale
   * 2. Create AppScreenshot with upload operation
   * 3. Upload file to reserved URL
   * 4. Commit upload operation
   */
  async uploadScreenshot(options: {
    imagePath: string;
    screenshotDisplayType: string;
    locale: string;
    imageUploadTimeoutMs?: number;
  }): Promise<void> {
    const { imagePath, screenshotDisplayType, locale, imageUploadTimeoutMs } =
      options;

    try {
      // Get app and version info
      const appId = await this.findAppId();
      const versionsResponse = await this.listAppStoreVersions(appId, {
        platform: APP_STORE_PLATFORM,
        limit: DEFAULT_VERSIONS_FETCH_LIMIT,
      });
      const version = sortVersions(versionsResponse.data || [])[0];
      if (!version) throw new Error("App Store version not found.");

      // Find localization for this locale
      const localizationsResponse = await this.listAppStoreVersionLocalizations(
        version.id,
        locale
      );
      let localizationId: string;

      if (localizationsResponse.data?.[0]) {
        localizationId = localizationsResponse.data[0].id;
      } else {
        // Create localization if it doesn't exist
        const createResponse = await this.createAppStoreVersionLocalization(
          version.id,
          locale,
          {}
        );
        localizationId = createResponse.data.id;
      }

      // Step 1: Find or create Screenshot Set
      const screenshotSetId = await this.findOrCreateScreenshotSet(
        localizationId,
        screenshotDisplayType
      );

      // Get file info
      const fileBuffer = readFileSync(imagePath);
      const fileSize = statSync(imagePath).size;
      const fileName = basename(imagePath);

      // Step 2: Create AppScreenshot with upload operation
      const screenshot = await this.createAppScreenshot(
        screenshotSetId,
        fileName,
        fileSize
      );

      // Step 3: Upload file to reserved URL
      if (
        screenshot.uploadOperations &&
        screenshot.uploadOperations.length > 0
      ) {
        const uploadOp = screenshot.uploadOperations[0];
        await this.uploadFileToUrl(
          uploadOp.url,
          fileBuffer,
          uploadOp.method,
          imageUploadTimeoutMs
        );
      }

      // Step 4: Commit screenshot
      await this.commitAppScreenshot(screenshot.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `[AppStore] ❌ Screenshot upload failed for ${basename(imagePath)}: ${msg}`
      );
      throw error;
    }
  }

  /**
   * Find or create Screenshot Set for a specific display type
   */
  private async findOrCreateScreenshotSet(
    localizationId: string,
    screenshotDisplayType: string
  ): Promise<string> {
    // List existing screenshot sets
    const setsResponse = await this.listScreenshotSets(localizationId);
    const existingSet = (setsResponse.data || []).find(
      (set) => set.attributes?.screenshotDisplayType === screenshotDisplayType
    );

    if (existingSet) {
      return existingSet.id;
    }

    // Create new screenshot set
    const appScreenshotSetsApi = await this.getApi(AppScreenshotSetsApi);
    try {
      const response =
        await appScreenshotSetsApi.appScreenshotSetsCreateInstance({
          appScreenshotSetCreateRequest: {
            data: {
              type: "appScreenshotSets",
              attributes: {
                screenshotDisplayType: screenshotDisplayType as any,
              },
              relationships: {
                appStoreVersionLocalization: {
                  data: {
                    type: "appStoreVersionLocalizations",
                    id: localizationId,
                  },
                },
              },
            },
          },
        });
      return response.data.id;
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  /**
   * Create AppScreenshot with upload operation
   */
  private async createAppScreenshot(
    screenshotSetId: string,
    fileName: string,
    fileSize: number
  ): Promise<{
    id: string;
    uploadOperations: Array<{
      url: string;
      method: string;
      length?: number;
      offset?: number;
    }>;
  }> {
    const appScreenshotsApi = await this.getApi(AppScreenshotsApi);

    try {
      const response = await appScreenshotsApi.appScreenshotsCreateInstance({
        appScreenshotCreateRequest: {
          data: {
            type: "appScreenshots",
            attributes: {
              fileName,
              fileSize,
            },
            relationships: {
              appScreenshotSet: {
                data: {
                  type: "appScreenshotSets",
                  id: screenshotSetId,
                },
              },
            },
          },
        },
      });

      const screenshot = response.data;
      const uploadOps = screenshot.attributes?.uploadOperations || [];

      return {
        id: screenshot.id,
        uploadOperations: uploadOps.map((op: any) => ({
          url: op.url,
          method: op.method || "PUT",
          length: op.length,
          offset: op.offset,
        })),
      };
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  /**
   * Upload file to reserved URL
   */
  private async uploadFileToUrl(
    url: string,
    fileBuffer: Buffer,
    method: string = "PUT",
    timeoutMs?: number
  ): Promise<void> {
    const https = await import("node:https");
    const { URL } = await import("node:url");

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          "Content-Type": "image/png",
          "Content-Length": fileBuffer.length,
        },
      };

      const req = https.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${res.statusCode}`));
        }
      });

      req.on("error", reject);
      const effectiveTimeoutMs = timeoutMs ?? DEFAULT_IMAGE_UPLOAD_TIMEOUT_MS;
      if (effectiveTimeoutMs > 0) {
        req.setTimeout(effectiveTimeoutMs, () => {
          req.destroy(
            new Error(`Upload timed out after ${effectiveTimeoutMs}ms`)
          );
        });
      }
      req.write(fileBuffer);
      req.end();
    });
  }

  /**
   * Commit AppScreenshot after upload
   */
  private async commitAppScreenshot(screenshotId: string): Promise<void> {
    const appScreenshotsApi = await this.getApi(AppScreenshotsApi);

    try {
      await appScreenshotsApi.appScreenshotsUpdateInstance({
        id: screenshotId,
        appScreenshotUpdateRequest: {
          data: {
            type: "appScreenshots",
            id: screenshotId,
            attributes: {
              uploaded: true,
            },
          },
        },
      });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  /**
   * Delete a single screenshot
   */
  private async deleteScreenshot(screenshotId: string): Promise<void> {
    const appScreenshotsApi = await this.getApi(AppScreenshotsApi);

    try {
      await appScreenshotsApi.appScreenshotsDeleteInstance({
        id: screenshotId,
      });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  /**
   * Delete all screenshots in a screenshot set
   */
  private async deleteAllScreenshotsInSet(
    screenshotSetId: string
  ): Promise<number> {
    const screenshotsResponse = await this.listScreenshots(screenshotSetId);
    const screenshots = screenshotsResponse.data || [];

    return this.deleteScreenshots(screenshots);
  }

  private async deleteScreenshots(
    screenshots: AppStoreScreenshot[]
  ): Promise<number> {
    let deletedCount = 0;
    for (const screenshot of screenshots) {
      if (screenshot.type !== "appScreenshots") {
        console.error(
          `[AppStore]       Skipping non-screenshot asset ${screenshot.id}`
        );
        continue;
      }

      await this.deleteScreenshot(screenshot.id);
      deletedCount++;
    }

    return deletedCount;
  }

  private async prepareScreenshotSetForUpload(
    screenshotSetId: string,
    incomingCount: number
  ): Promise<{
    deletedBeforeUpload: number;
    screenshotsToDeleteAfterUpload: AppStoreScreenshot[];
  }> {
    if (incomingCount > APP_STORE_SCREENSHOT_SET_MAX_COUNT) {
      throw new Error(
        `Preflight failed: App Store allows up to ${APP_STORE_SCREENSHOT_SET_MAX_COUNT} screenshots per display type, got ${incomingCount}`
      );
    }

    const screenshotsResponse = await this.listScreenshots(screenshotSetId);
    const existingScreenshots = (screenshotsResponse.data || []).filter(
      (screenshot) => screenshot.type === "appScreenshots"
    );
    const nonScreenshotCount =
      (screenshotsResponse.data || []).length - existingScreenshots.length;

    if (nonScreenshotCount > 0) {
      console.error(
        `[AppStore]       Ignoring ${nonScreenshotCount} non-screenshot asset(s) in screenshot set`
      );
    }

    const slotsToFree = Math.max(
      0,
      existingScreenshots.length +
        incomingCount -
        APP_STORE_SCREENSHOT_SET_MAX_COUNT
    );
    // Preserve the first screenshots as long as possible. If the upload fails
    // after freeing slots, users are more likely to still see the primary
    // screenshots rather than the tail of the old set.
    const screenshotsToDeleteBeforeUpload =
      slotsToFree > 0 ? existingScreenshots.slice(-slotsToFree) : [];
    const screenshotsToDeleteAfterUpload = existingScreenshots.slice(
      0,
      existingScreenshots.length - slotsToFree
    );

    const deletedBeforeUpload = await this.deleteScreenshots(
      screenshotsToDeleteBeforeUpload
    );

    if (deletedBeforeUpload > 0) {
      console.error(
        `[AppStore]       Deleted ${deletedBeforeUpload} existing screenshots to free upload slots`
      );
    }

    return {
      deletedBeforeUpload,
      screenshotsToDeleteAfterUpload,
    };
  }

  private sanitizePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  private getScreenshotLockPath(locale: string, displayType: string): string {
    const appIdSegment = this.sanitizePathSegment(this.bundleId);
    const localeSegment = this.sanitizePathSegment(locale);
    const displayTypeSegment = this.sanitizePathSegment(displayType);
    return join(
      getAsoDir(),
      "locks",
      "screenshots",
      "app-store",
      appIdSegment,
      localeSegment,
      `${displayTypeSegment}.lock`
    );
  }

  private acquireScreenshotUploadLock(lockPath: string): () => void {
    mkdirSync(dirname(lockPath), { recursive: true });

    let descriptor: number;
    try {
      descriptor = openSync(lockPath, "wx");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EEXIST") {
        const lockAgeMs = Date.now() - statSync(lockPath).mtimeMs;
        if (lockAgeMs > SCREENSHOT_UPLOAD_LOCK_STALE_MS) {
          console.error(
            `[AppStore] Removing stale screenshot upload lock (${lockPath})`
          );
          unlinkSync(lockPath);
          descriptor = openSync(lockPath, "wx");
        } else {
          throw new Error(
            `Screenshot upload lock is already held (${lockPath}). Another upload is running for this locale/display type.`
          );
        }
      } else {
        throw error;
      }
    }

    closeSync(descriptor);

    return () => {
      try {
        unlinkSync(lockPath);
      } catch {
        // Ignore lock cleanup failures.
      }
    };
  }

  private preflightScreenshotBatch(
    locale: string,
    byDisplayType: Map<string, Array<{ path: string; filename: string }>>
  ): void {
    for (const [displayType, screenshotList] of byDisplayType) {
      if (screenshotList.length === 0) {
        throw new Error(
          `Preflight failed for ${locale}/${displayType}: empty screenshot list`
        );
      }

      const seenPaths = new Set<string>();
      const seenFileNames = new Set<string>();

      for (const screenshot of screenshotList) {
        if (!existsSync(screenshot.path)) {
          throw new Error(
            `Preflight failed for ${locale}/${displayType}: file not found (${screenshot.path})`
          );
        }

        const fileStat = statSync(screenshot.path);
        if (!fileStat.isFile()) {
          throw new Error(
            `Preflight failed for ${locale}/${displayType}: not a file (${screenshot.path})`
          );
        }

        if (fileStat.size <= 0) {
          throw new Error(
            `Preflight failed for ${locale}/${displayType}: empty file (${screenshot.path})`
          );
        }

        if (!screenshot.filename.trim()) {
          throw new Error(
            `Preflight failed for ${locale}/${displayType}: empty filename (${screenshot.path})`
          );
        }

        if (seenPaths.has(screenshot.path)) {
          throw new Error(
            `Preflight failed for ${locale}/${displayType}: duplicate file path (${screenshot.path})`
          );
        }
        seenPaths.add(screenshot.path);

        const normalizedFileName = screenshot.filename.trim().toLowerCase();
        if (seenFileNames.has(normalizedFileName)) {
          throw new Error(
            `Preflight failed for ${locale}/${displayType}: duplicate filename (${screenshot.filename})`
          );
        }
        seenFileNames.add(normalizedFileName);
      }
    }
  }

  /**
   * Upload multiple screenshots for a locale, replacing existing ones.
   *
   * Failure model:
   *
   * existing screenshots ──┐
   *                        ├─ free only the slots App Store requires
   * incoming screenshots ──┘
   *          │
   *          ├─ upload + commit every incoming screenshot
   *          │
   *          └─ only after success, delete the remaining old screenshots
   *
   * This avoids the old delete-first behavior where a timeout could leave the
   * user with an empty screenshot set. If upload fails, most existing
   * screenshots remain visible and any successfully uploaded new screenshots
   * are left in App Store Connect for manual or retry cleanup.
   *
   * 1. Find or create screenshot sets for each display type
   * 2. Delete only enough existing screenshots to fit the incoming batch
   * 3. Upload new screenshots in order
   * 4. Delete remaining old screenshots after the batch succeeds
   */
  async uploadScreenshotsForLocale(options: {
    locale: string;
    screenshots: Array<{
      path: string;
      displayType: string;
      filename: string;
    }>;
    imageUploadTimeoutMs?: number;
  }): Promise<{
    uploaded: number;
    deleted: number;
    failed: number;
  }> {
    const { locale, screenshots, imageUploadTimeoutMs } = options;

    const result = { uploaded: 0, deleted: 0, failed: 0 };

    if (screenshots.length === 0) {
      return result;
    }

    try {
      // Get app and version info
      const appId = await this.findAppId();
      const versionsResponse = await this.listAppStoreVersions(appId, {
        platform: APP_STORE_PLATFORM,
        limit: DEFAULT_VERSIONS_FETCH_LIMIT,
      });
      const version = sortVersions(versionsResponse.data || [])[0];
      if (!version) throw new Error("App Store version not found.");

      // Find or create localization
      const localizationsResponse = await this.listAppStoreVersionLocalizations(
        version.id,
        locale
      );
      let localizationId: string;

      if (localizationsResponse.data?.[0]) {
        localizationId = localizationsResponse.data[0].id;
      } else {
        const createResponse = await this.createAppStoreVersionLocalization(
          version.id,
          locale,
          {}
        );
        localizationId = createResponse.data.id;
      }

      // Group screenshots by display type
      const byDisplayType = new Map<
        string,
        Array<{ path: string; filename: string }>
      >();
      for (const screenshot of screenshots) {
        if (!byDisplayType.has(screenshot.displayType)) {
          byDisplayType.set(screenshot.displayType, []);
        }
        byDisplayType.get(screenshot.displayType)!.push({
          path: screenshot.path,
          filename: screenshot.filename,
        });
      }

      this.preflightScreenshotBatch(locale, byDisplayType);

      // Process each display type
      for (const [displayType, screenshotList] of byDisplayType) {
        const releaseLock = this.acquireScreenshotUploadLock(
          this.getScreenshotLockPath(locale, displayType)
        );

        try {
          console.error(
            `[AppStore]     Processing ${displayType} (${screenshotList.length} screenshots)...`
          );

          // Find or create screenshot set
          const screenshotSetId = await this.findOrCreateScreenshotSet(
            localizationId,
            displayType
          );

          const { deletedBeforeUpload, screenshotsToDeleteAfterUpload } =
            await this.prepareScreenshotSetForUpload(
              screenshotSetId,
              screenshotList.length
            );
          result.deleted += deletedBeforeUpload;

          // Upload new screenshots in order
          let uploadedForDisplayType = 0;
          for (const screenshot of screenshotList) {
            try {
              const fileBuffer = readFileSync(screenshot.path);
              const fileSize = statSync(screenshot.path).size;

              // Create screenshot with upload operation
              const screenshotData = await this.createAppScreenshot(
                screenshotSetId,
                screenshot.filename,
                fileSize
              );

              // Upload file
              if (
                screenshotData.uploadOperations &&
                screenshotData.uploadOperations.length > 0
              ) {
                const uploadOp = screenshotData.uploadOperations[0];
                await this.uploadFileToUrl(
                  uploadOp.url,
                  fileBuffer,
                  uploadOp.method,
                  imageUploadTimeoutMs
                );
              }

              // Commit screenshot
              await this.commitAppScreenshot(screenshotData.id);
              console.error(`[AppStore]       ✅ ${screenshot.filename}`);
              result.uploaded++;
              uploadedForDisplayType++;
            } catch (error) {
              result.failed++;
              throw new Error(
                `[${displayType}] ${screenshot.filename}: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          }

          if (uploadedForDisplayType === screenshotList.length) {
            const deletedAfterUpload = await this.deleteScreenshots(
              screenshotsToDeleteAfterUpload
            );
            if (deletedAfterUpload > 0) {
              console.error(
                `[AppStore]       Deleted ${deletedAfterUpload} replaced screenshots after successful upload`
              );
              result.deleted += deletedAfterUpload;
            }
          }
        } finally {
          releaseLock();
        }
      }

      if (result.failed > 0) {
        throw new Error(
          `Screenshot upload completed with ${result.failed} failed files`
        );
      }

      return result;
    } catch (error) {
      console.error(
        `[AppStore] Screenshot upload failed for ${locale}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  private async getApi<T extends BaseAPI>(apiClass: ApiClass<T>): Promise<T> {
    if (!this.apiCache.has(apiClass)) {
      this.apiCache.set(apiClass, this.sdk.create(apiClass));
    }

    return this.apiCache.get(apiClass)! as Promise<T>;
  }

  private normalizeEndpoint(endpoint: string): string {
    if (endpoint.startsWith("http")) return endpoint;
    if (endpoint.startsWith("/v1/")) return endpoint;
    if (endpoint.startsWith("/")) return `/v1${endpoint}`;
    return `/v1/${endpoint}`;
  }

  private async requestCollection<T>(endpoint: string): Promise<T> {
    try {
      const response = await this.sdk.request(
        endpoint.startsWith("http")
          ? { url: endpoint }
          : { path: this.normalizeEndpoint(endpoint) }
      );
      return (await response.json()) as T;
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  private formatErrorPayload(payload: unknown): string {
    if (!payload) return "";
    if (typeof payload === "string") return payload;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  private async handleSdkError(error: unknown): Promise<never> {
    if (error instanceof ResponseError) {
      let errorBody: unknown = null;
      try {
        errorBody = await error.response.json();
      } catch {
        // ignore JSON parse errors for error bodies
      }

      if (error.response.status === 401) {
        throw new Error(
          `App Store Connect API authentication failed (401 Unauthorized)\n` +
            `Issuer ID: ${this.issuerId}\n` +
            `Key ID: ${this.keyId}\n` +
            `Error: ${this.formatErrorPayload(errorBody)}`
        );
      }

      if (error.response.status === 409) {
        const errorDetails = this.formatErrorPayload(errorBody);
        if (errorDetails.includes("STATE_ERROR")) {
          throw new Error(
            `App Store Connect API error: 409 Conflict (STATE_ERROR)\n` +
              `Metadata cannot be modified in current state. Please check app status.\n` +
              `Error: ${errorDetails}`
          );
        }
      }

      const statusText = error.response.statusText || "Unknown Error";
      throw new Error(
        `App Store Connect API error: ${error.response.status} ${statusText}\n${this.formatErrorPayload(errorBody)}`
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(String(error));
  }
}
