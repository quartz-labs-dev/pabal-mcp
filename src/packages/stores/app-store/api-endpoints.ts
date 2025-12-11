/**
 * App Store Connect API Endpoints
 *
 * Centralized API endpoint management for App Store Connect
 */

import { AppStoreConnectAPI } from "appstore-connect-sdk";
import {
  AppsApi,
  AppInfosApi,
  AppInfoLocalizationsApi,
  AppScreenshotSetsApi,
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
  AppStoreLocalization,
  AppStoreScreenshot,
  AppStoreScreenshotSet,
  AppStoreVersion,
  AppStoreVersionLocalizationUpdateAttributes,
} from "./types";

type ApiClass<T extends BaseAPI> = new (configuration?: Configuration) => T;

export type AppStoreApiAuthConfig = {
  issuerId: string;
  keyId: string;
  privateKey: string;
  expirationSeconds?: number;
};

const DEFAULT_TOKEN_EXPIRATION_SECONDS = 60 * 20;

export class AppStoreApiEndpoints {
  private sdk: AppStoreConnectAPI;
  private apiCache = new Map<ApiClass<BaseAPI>, Promise<BaseAPI>>();
  private issuerId: string;
  private keyId: string;

  constructor(config: AppStoreApiAuthConfig) {
    this.issuerId = config.issuerId;
    this.keyId = config.keyId;
    this.sdk = new AppStoreConnectAPI({
      issuerId: config.issuerId,
      privateKeyId: config.keyId,
      privateKey: config.privateKey,
      expirationDuration:
        config.expirationSeconds ?? DEFAULT_TOKEN_EXPIRATION_SECONDS,
    });
  }

  normalizeNextLink(nextLink?: string | null): string | null {
    if (!nextLink) return null;
    return nextLink.replace(APP_STORE_API_BASE_URL, "");
  }

  async listApps(
    nextUrl = `/apps?limit=${DEFAULT_APP_LIST_LIMIT}`
  ): Promise<ApiResponse<AppStoreApp[]>> {
    return this.requestCollection<AppsResponse>(nextUrl);
  }

  async findAppByBundleId(
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

  async getApp(appId: string): Promise<ApiResponse<AppStoreApp>> {
    const appsApi = await this.getApi(AppsApi);

    try {
      return await appsApi.appsGetInstance({ id: appId });
    } catch (error) {
      return await this.handleSdkError(error);
    }
  }

  async listAppInfos(appId: string): Promise<ApiResponse<AppInfo[]>> {
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

  async listAppInfoLocalizations(
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

  async updateAppInfoLocalization(
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

  async createAppInfoLocalization(
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

  async listAppStoreVersions(
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

  async createAppStoreVersion(
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

  async listAppStoreVersionLocalizations(
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

  async getAppStoreVersionLocalization(
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

  async updateAppStoreVersionLocalization(
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

  async createAppStoreVersionLocalization(
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

  async listScreenshotSets(
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

  async listScreenshots(
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
