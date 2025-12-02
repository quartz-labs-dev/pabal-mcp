/**
 * App Store Connect API Endpoints
 *
 * Centralized API endpoint management for App Store Connect
 */

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
  AppStoreApp,
  AppStoreLocalization,
  AppStoreScreenshot,
  AppStoreScreenshotSet,
  AppStoreVersion,
} from "./types";

export class AppStoreApiEndpoints {
  constructor(
    private generateToken: () => Promise<string>,
    private issuerId: string,
    private keyId: string
  ) {}

  normalizeNextLink(nextLink?: string | null): string | null {
    if (!nextLink) return null;
    return nextLink.replace(APP_STORE_API_BASE_URL, "");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.generateToken();
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${APP_STORE_API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
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

  async listApps(
    nextUrl = `/apps?limit=${DEFAULT_APP_LIST_LIMIT}`
  ): Promise<ApiResponse<AppStoreApp[]>> {
    return this.request<ApiResponse<AppStoreApp[]>>(nextUrl);
  }

  async findAppByBundleId(
    bundleId: string
  ): Promise<ApiResponse<AppStoreApp[]>> {
    return this.request<ApiResponse<AppStoreApp[]>>(
      `/apps?filter[bundleId]=${bundleId}`
    );
  }

  async getApp(appId: string): Promise<ApiResponse<AppStoreApp>> {
    return this.request<ApiResponse<AppStoreApp>>(`/apps/${appId}`);
  }

  async listAppInfos(appId: string): Promise<ApiResponse<AppInfo[]>> {
    return this.request<ApiResponse<AppInfo[]>>(
      `/apps/${appId}/appInfos?limit=1`
    );
  }

  async listAppInfoLocalizations(
    appInfoId: string,
    locale?: string
  ): Promise<ApiResponse<AppInfoLocalization[]>> {
    const filter = locale ? `?filter[locale]=${locale}` : "";
    return this.request<ApiResponse<AppInfoLocalization[]>>(
      `/appInfos/${appInfoId}/appInfoLocalizations${filter}`
    );
  }

  async updateAppInfoLocalization(
    localizationId: string,
    attributes: Record<string, string>
  ): Promise<void> {
    await this.request(`/appInfoLocalizations/${localizationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        data: {
          type: "appInfoLocalizations",
          id: localizationId,
          attributes,
        },
      }),
    });
  }

  async createAppInfoLocalization(
    appInfoId: string,
    locale: string,
    attributes: Record<string, string>
  ): Promise<ApiResponse<AppInfoLocalization>> {
    return this.request<ApiResponse<AppInfoLocalization>>(
      `/appInfoLocalizations`,
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "appInfoLocalizations",
            attributes: { locale, ...attributes },
            relationships: {
              appInfo: { data: { type: "appInfos", id: appInfoId } },
            },
          },
        }),
      }
    );
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
    const queryParts = [`filter[platform]=${platform}`, `limit=${limit}`];
    if (state) queryParts.push(`filter[appStoreState]=${state}`);
    const query = queryParts.join("&");

    return this.request<ApiResponse<AppStoreVersion[]>>(
      `/apps/${appId}/appStoreVersions?${query}`
    );
  }

  async createAppStoreVersion(
    appId: string,
    versionString: string,
    platform = APP_STORE_PLATFORM
  ): Promise<ApiResponse<AppStoreVersion>> {
    return this.request<ApiResponse<AppStoreVersion>>(`/appStoreVersions`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "appStoreVersions",
          attributes: { platform, versionString },
          relationships: { app: { data: { type: "apps", id: appId } } },
        },
      }),
    });
  }

  async listAppStoreVersionLocalizations(
    versionId: string,
    locale?: string
  ): Promise<ApiResponse<AppStoreLocalization[]>> {
    const filter = locale ? `?filter[locale]=${locale}` : "";
    return this.request<ApiResponse<AppStoreLocalization[]>>(
      `/appStoreVersions/${versionId}/appStoreVersionLocalizations${filter}`
    );
  }

  async getAppStoreVersionLocalization(
    localizationId: string
  ): Promise<ApiResponse<AppStoreLocalization>> {
    return this.request<ApiResponse<AppStoreLocalization>>(
      `/appStoreVersionLocalizations/${localizationId}`
    );
  }

  async updateAppStoreVersionLocalization(
    localizationId: string,
    attributes: Partial<AppStoreLocalization["attributes"]>
  ): Promise<void> {
    await this.request(`/appStoreVersionLocalizations/${localizationId}`, {
      method: "PATCH",
      body: JSON.stringify({
        data: {
          type: "appStoreVersionLocalizations",
          id: localizationId,
          attributes,
        },
      }),
    });
  }

  async createAppStoreVersionLocalization(
    versionId: string,
    locale: string,
    attributes: Partial<AppStoreLocalization["attributes"]>
  ): Promise<ApiResponse<AppStoreLocalization>> {
    return this.request<ApiResponse<AppStoreLocalization>>(
      `/appStoreVersionLocalizations`,
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "appStoreVersionLocalizations",
            attributes: { locale, ...attributes },
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

  async listScreenshotSets(
    localizationId: string
  ): Promise<ApiResponse<AppStoreScreenshotSet[]>> {
    return this.request<ApiResponse<AppStoreScreenshotSet[]>>(
      `/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`
    );
  }

  async listScreenshots(
    screenshotSetId: string
  ): Promise<ApiResponse<AppStoreScreenshot[]>> {
    return this.request<ApiResponse<AppStoreScreenshot[]>>(
      `/appScreenshotSets/${screenshotSetId}/appScreenshots`
    );
  }
}
