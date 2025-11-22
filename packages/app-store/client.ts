import type {
  AppId,
  CreateVersionResult,
  ReleaseNote,
  StoreMetadata,
} from "../core/types";
import type { StoreClient } from "../core/store-client";
import type { AppStoreConfig } from "../core/config";
import { AppStoreHttpClient } from "./http";

type AppResponse = {
  data: {
    id: string;
    attributes: {
      name?: string;
      subtitle?: string;
      primaryLocale?: string;
      bundleId?: string;
    };
  };
};

type VersionsResponse = {
  data: Array<{
    id: string;
    attributes: {
      versionString: string;
      platform?: string;
    };
  }>;
};

type LocalizationsResponse = {
  data: Array<{
    id: string;
    attributes: {
      locale?: string;
      description?: string;
      keywords?: string;
      promotionalText?: string;
      supportUrl?: string;
      marketingUrl?: string;
      whatsNew?: string;
    };
  }>;
};

export class AppStoreClient implements StoreClient {
  private readonly http: AppStoreHttpClient;

  constructor(private readonly config: AppStoreConfig) {
    this.http = new AppStoreHttpClient(config);
  }

  // 메타데이터 조회: 앱 정보 + 최신 버전 로컬라이제이션 한 개(주 언어 우선)
  async pullMetadata(appIdOrBundleId: AppId): Promise<StoreMetadata> {
    const appId = await this.ensureAppId(appIdOrBundleId);
    const appRes = await this.http.get<AppResponse>(`v1/apps/${appId}`);
    const attrs = appRes.data?.attributes ?? {};
    const primaryLocale = attrs.primaryLocale ?? "en-US";

    const latestVersion = await this.getLatestVersion(appId);
    let localization;
    if (latestVersion) {
      localization = await this.getLocalizationForLocale(
        latestVersion.id,
        primaryLocale,
      );
    }

    const name = attrs.name ? { [primaryLocale]: attrs.name } : undefined;
    const subtitle = localization?.attributes.promotionalText
      ? { [primaryLocale]: localization.attributes.promotionalText }
      : attrs.subtitle
        ? { [primaryLocale]: attrs.subtitle }
        : undefined;

    const description = localization?.attributes.description
      ? { [primaryLocale]: localization.attributes.description }
      : undefined;

    const keywords = localization?.attributes.keywords
      ? { [primaryLocale]: localization.attributes.keywords }
      : undefined;

    return {
      name,
      subtitle,
      description,
      keywords,
      raw: {
        app: appRes,
        version: latestVersion,
        localization,
      },
    };
  }

  async pushMetadata(appIdOrBundleId: AppId, payload: StoreMetadata): Promise<void> {
    const appId = await this.ensureAppId(appIdOrBundleId);
    const targetLocale = pickLocale(payload) ?? "en-US";
    const latestVersion = await this.getLatestVersion(appId);
    if (!latestVersion) {
      throw new Error("앱 버전을 찾을 수 없습니다. 스토어에서 버전을 먼저 생성하세요.");
    }

    const existingLoc = await this.getLocalizationForLocale(
      latestVersion.id,
      targetLocale,
    );

    const attributes = {
      description: payload.description?.[targetLocale],
      keywords: payload.keywords?.[targetLocale],
      promotionalText: payload.subtitle?.[targetLocale],
      supportUrl: payload.supportUrl?.[targetLocale],
      marketingUrl: payload.marketingUrl?.[targetLocale],
      whatsNew: payload.whatsNew?.[targetLocale],
    };

    if (existingLoc) {
      await this.http.patch(`v1/appStoreVersionLocalizations/${existingLoc.id}`, {
        data: {
          type: "appStoreVersionLocalizations",
          id: existingLoc.id,
          attributes,
        },
      });
      return;
    }

    await this.http.post("v1/appStoreVersionLocalizations", {
      data: {
        type: "appStoreVersionLocalizations",
        attributes: {
          locale: targetLocale,
          ...attributes,
        },
        relationships: {
          appStoreVersion: {
            data: {
              type: "appStoreVersions",
              id: latestVersion.id,
            },
          },
        },
      },
    });
  }

  async createVersion(appIdOrBundleId: AppId, version: string): Promise<CreateVersionResult> {
    const appId = await this.ensureAppId(appIdOrBundleId);
    const existing = await this.getVersionByString(appId, version);
    if (existing) {
      return { version, raw: existing };
    }

    const created = await this.http.post<{ data: VersionsResponse["data"][number] }>(
      "v1/appStoreVersions",
      {
        data: {
          type: "appStoreVersions",
          attributes: {
            platform: "IOS",
            versionString: version,
          },
          relationships: {
            app: {
              data: {
                type: "apps",
                id: appId,
              },
            },
          },
        },
      },
    );

    return { version, raw: created };
  }

  async pullReleaseNotes(appIdOrBundleId: AppId): Promise<ReleaseNote[]> {
    const appId = await this.ensureAppId(appIdOrBundleId);
    const versions = await this.listVersions(appId, 20);
    const notes: ReleaseNote[] = [];

    for (const version of versions) {
      const locs = await this.listLocalizations(version.id);
      for (const loc of locs) {
        if (loc.attributes.locale && loc.attributes.whatsNew) {
          notes.push({
            locale: loc.attributes.locale,
            text: loc.attributes.whatsNew,
          });
        }
      }
    }

    return notes;
  }

  async extractAppId(input: string): Promise<AppId | null> {
    // 앱스토어 URL 예: https://apps.apple.com/us/app/app-name/id1234567890
    const match = input.match(/id(\d{6,})/);
    if (match) return match[1];

    // bundleId 형태 추정 -> API 조회
    if (input.includes(".")) {
      const appId = await this.findAppIdByBundleId(input);
      return appId ?? null;
    }
    return null;
  }

  private async ensureAppId(appIdOrBundleId: string): Promise<string> {
    if (/^\d+$/.test(appIdOrBundleId)) return appIdOrBundleId;
    const found = await this.findAppIdByBundleId(appIdOrBundleId);
    if (!found) {
      throw new Error(`App not found for bundleId: ${appIdOrBundleId}`);
    }
    return found;
  }

  private async findAppIdByBundleId(bundleId: string): Promise<string | undefined> {
    const res = await this.http.get<{
      data?: Array<{ id: string; attributes: { bundleId?: string } }>;
    }>(`v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}`);
    return res.data?.[0]?.id;
  }

  private async listVersions(appId: string, limit = 10): Promise<VersionsResponse["data"]> {
    const res = await this.http.get<VersionsResponse>(
      `v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=${limit}`,
    );
    return res.data ?? [];
  }

  private async getLatestVersion(appId: string): Promise<VersionsResponse["data"][number] | null> {
    const versions = await this.listVersions(appId, 10);
    if (versions.length === 0) return null;
    return [...versions]
      .sort((a, b) =>
        compareVersionString(b.attributes.versionString, a.attributes.versionString),
      )
      [0];
  }

  private async getVersionByString(
    appId: string,
    versionString: string,
  ): Promise<VersionsResponse["data"][number] | undefined> {
    const versions = await this.listVersions(appId, 50);
    return versions.find((v) => v.attributes.versionString === versionString);
  }

  private async listLocalizations(versionId: string): Promise<LocalizationsResponse["data"]> {
    const res = await this.http.get<LocalizationsResponse>(
      `v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=200`,
    );
    return res.data ?? [];
  }

  private async getLocalizationForLocale(
    versionId: string,
    locale: string,
  ): Promise<LocalizationsResponse["data"][number] | undefined> {
    const res = await this.http.get<LocalizationsResponse>(
      `v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?filter[locale]=${encodeURIComponent(locale)}&limit=1`,
    );
    return res.data?.[0];
  }
}

function compareVersionString(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function pickLocale(payload: StoreMetadata): string | undefined {
  const candidates = [
    payload.description,
    payload.keywords,
    payload.subtitle,
    payload.name,
    payload.supportUrl as Record<string, string> | undefined,
    payload.marketingUrl as Record<string, string> | undefined,
    payload.whatsNew as Record<string, string> | undefined,
  ].filter(Boolean) as Array<Record<string, string>>;

  for (const entry of candidates) {
    const [locale] = Object.keys(entry);
    if (locale) return locale;
  }
  return undefined;
}
