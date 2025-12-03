import { createAppStoreClient } from "@servers/mcp/core/clients/app-store-factory";
import type { AppStoreClient } from "@/packages/stores/app-store/client";
import type {
  AppStoreMultilingualAsoData,
  AppStoreReleaseNote,
} from "@/packages/configs/aso-config/types";
import type { PreparedAsoData } from "@/packages/configs/aso-config/utils";
import type { EnvConfig } from "@/packages/configs/secrets-config/types";
import { verifyAppStoreAuth } from "@/packages/stores/app-store/verify-auth";
import { toErrorMessage } from "@servers/mcp/core/clients/client-factory-helpers";
import {
  checkPushPrerequisites,
  toServiceResult,
  updateRegisteredLocales,
} from "./service-helpers";
import {
  type MaybeResult,
  type ServiceResult,
  type StoreAppSummary,
  type AppStoreVersionInfo,
  type UpdatedReleaseNotesResult,
  type PushAsoResult,
  type CreatedAppStoreVersion,
  type VerifyAuthResult,
} from "./types";

interface AppStoreAppInfo {
  appId?: string;
  name?: string;
  supportedLocales?: string[];
}

/**
 * App Store-facing service layer that wraps client creation and common operations.
 * Keeps MCP tools independent from client factories and SDK details.
 */
export class AppStoreService {
  private getClientOrThrow(
    bundleId: string,
    existingClient?: AppStoreClient
  ): AppStoreClient {
    if (existingClient) return existingClient;
    const clientResult = this.createClient(bundleId);
    if (!clientResult.success) {
      throw new Error(clientResult.error);
    }
    return clientResult.data;
  }

  createClient(bundleId: string): ServiceResult<AppStoreClient> {
    return toServiceResult(createAppStoreClient({ bundleId }));
  }

  /**
   * List released apps. Uses a fresh client to ensure working directory independence.
   */
  async listReleasedApps(): Promise<ServiceResult<StoreAppSummary[]>> {
    try {
      const client = this.getClientOrThrow("dummy");
      const apps = await client.listAllApps({ onlyReleased: true });
      return { success: true, data: apps };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }

  /**
   * Fetch a single app info (with locales) by bundleId.
   */
  async fetchAppInfo(
    bundleId: string,
    existingClient?: AppStoreClient
  ): Promise<MaybeResult<AppStoreAppInfo>> {
    try {
      const client = this.getClientOrThrow(bundleId || "dummy", existingClient);

      const apps = await client.listAllApps({ onlyReleased: true });
      const app = apps.find((a) => a.bundleId === bundleId);
      if (!app) {
        return { found: false };
      }

      const supportedLocales = await client.getSupportedLocales(app.id);

      return {
        found: true,
        appId: app.id,
        name: app.name,
        supportedLocales,
      };
    } catch (error) {
      return { found: false, error: toErrorMessage(error) };
    }
  }

  async getLatestVersion(
    bundleId: string,
    existingClient?: AppStoreClient
  ): Promise<MaybeResult<AppStoreVersionInfo>> {
    try {
      const client = this.getClientOrThrow(bundleId, existingClient);

      const latestVersion = await client.getLatestVersion();
      if (!latestVersion) {
        return { found: false };
      }

      const { versionString, appStoreState } = latestVersion.attributes;

      return {
        found: true,
        versionString,
        state: appStoreState ?? "UNKNOWN",
      };
    } catch (error) {
      return { found: false, error: toErrorMessage(error) };
    }
  }

  async updateReleaseNotes(
    bundleId: string,
    releaseNotes: Record<string, string>,
    versionId?: string,
    supportedLocales?: string[]
  ): Promise<ServiceResult<UpdatedReleaseNotesResult>> {
    try {
      const client = this.getClientOrThrow(bundleId);

      // Determine target versionId
      let targetVersionId = versionId;
      if (!targetVersionId) {
        const versions = await client.getAllVersions();
        const editableVersion = versions.find(
          (v) => v.attributes.appStoreState === "PREPARE_FOR_SUBMISSION"
        );
        if (!editableVersion) {
          return {
            success: false,
            error: "No editable version found for release notes update",
          };
        }
        targetVersionId = editableVersion.id;
      }

      // Filter locales if supportedLocales provided
      const localesToUpdate = supportedLocales
        ? Object.keys(releaseNotes).filter((locale) =>
            supportedLocales.includes(locale)
          )
        : Object.keys(releaseNotes);

      const updated: string[] = [];
      const failed: Array<{ locale: string; error: string }> = [];

      for (const locale of localesToUpdate) {
        try {
          await client.updateWhatsNew({
            versionId: targetVersionId!,
            locale,
            whatsNew: releaseNotes[locale],
          });
          updated.push(locale);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          failed.push({ locale, error: msg });
        }
      }

      const success = failed.length === 0;
      return {
        success,
        data: { updated, failed },
        ...(!success ? { error: failed[0]?.error } : {}),
      } as ServiceResult<UpdatedReleaseNotesResult>;
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }

  async pullReleaseNotes(
    bundleId: string
  ): Promise<ServiceResult<AppStoreReleaseNote[]>> {
    try {
      const client = this.getClientOrThrow(bundleId);
      const releaseNotes = await client.pullReleaseNotes();
      return { success: true, data: releaseNotes };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }

  async createVersion(
    bundleId: string,
    versionString: string,
    autoIncrement?: boolean
  ): Promise<ServiceResult<CreatedAppStoreVersion>> {
    try {
      const client = this.getClientOrThrow(bundleId);
      const version = autoIncrement
        ? await client.createNewVersionWithAutoIncrement(versionString)
        : await client.createNewVersion(versionString);

      return {
        success: true,
        data: {
          id: version.id,
          versionString: version.attributes.versionString,
          state: version.attributes.appStoreState,
        },
      };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }

  async pushAsoData({
    config,
    bundleId,
    localAsoData,
    appStoreDataPath,
  }: {
    config: EnvConfig;
    bundleId?: string;
    localAsoData: PreparedAsoData;
    appStoreDataPath: string;
  }): Promise<PushAsoResult> {
    const skip = checkPushPrerequisites({
      storeLabel: "App Store",
      configured: Boolean(config.appStore),
      identifierLabel: "bundleId",
      identifier: bundleId,
      hasData: Boolean(localAsoData.appStore),
      dataPath: appStoreDataPath,
    });
    if (skip) return { success: false, error: skip };

    const ensuredBundleId = bundleId as string;
    const appStoreData = localAsoData.appStore as AppStoreMultilingualAsoData;
    const client = this.getClientOrThrow(ensuredBundleId);

    console.error(`[MCP]   📤 Pushing to App Store...`);
    console.error(`[MCP]     Bundle ID: ${bundleId}`);

    try {
      const localesToPush = Object.keys(appStoreData.locales);
      const failedFieldsList: { locale: string; fields: string[] }[] = [];

      for (const [locale, localeData] of Object.entries(appStoreData.locales)) {
        console.error(`[AppStore]   📤 Pushing ${locale}...`);
        const localeResult = await client.pushAsoData(localeData);
        if (localeResult.failedFields && localeResult.failedFields.length > 0) {
          failedFieldsList.push({
            locale,
            fields: localeResult.failedFields,
          });
          console.error(
            `[AppStore]   ⚠️  ${locale} partially updated (failed fields: ${localeResult.failedFields.join(", ")})`
          );
        } else {
          console.error(`[AppStore]   ✅ ${locale} uploaded successfully`);
        }
      }

      const updated = updateRegisteredLocales(
        ensuredBundleId,
        "appStore",
        localesToPush
      );
      if (updated) {
        console.error(
          `[MCP]   ✅ Updated registered-apps.json with ${localesToPush.length} App Store locales`
        );
      }

      if (failedFieldsList.length > 0) {
        return {
          success: true,
          localesPushed: localesToPush,
          failedFields: failedFieldsList,
        };
      }

      return {
        success: true,
        localesPushed: localesToPush,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (msg.includes("409 Conflict") && msg.includes("STATE_ERROR")) {
        console.error(
          `[AppStore]   🔄 STATE_ERROR detected. New version needed.`
        );

        try {
          const version = await client.createNewVersionWithAutoIncrement();
          const versionId = version.id;
          const versionString = version.attributes.versionString;
          const locales = Object.keys(appStoreData.locales);

          console.error(
            `[AppStore]   ✅ New version ${versionString} created.`
          );

          return {
            success: false,
            error: `New version required`,
            needsNewVersion: true,
            versionInfo: {
              versionId,
              versionString,
              locales,
            },
          };
        } catch (versionError) {
          const versionMsg =
            versionError instanceof Error
              ? versionError.message
              : String(versionError);
          return {
            success: false,
            error: `Failed to create new version: ${versionMsg}`,
          };
        }
      }

      console.error(`[AppStore]   ❌ Push failed`, error);
      return { success: false, error: msg };
    }
  }

  async verifyAuth(expirationSeconds = 300): Promise<
    VerifyAuthResult<{
      header: Record<string, unknown>;
      payload: Record<string, unknown>;
    }>
  > {
    return verifyAppStoreAuth({ expirationSeconds });
  }
}
