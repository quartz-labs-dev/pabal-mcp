import { AppError } from "@/packages/common/errors/app-error";
import { ERROR_CODES } from "@/packages/common/errors/error-codes";
import { HTTP_STATUS } from "@/packages/common/errors/status-codes";
import type {
  AppStoreMultilingualAsoData,
  AppStoreReleaseNote,
} from "@/packages/configs/aso-config/types";
import type { PreparedAsoData } from "@/packages/configs/aso-config/utils";
import type { EnvConfig } from "@/packages/configs/secrets-config/types";
import type { AppStoreClient } from "@/packages/stores/app-store/client";
import { verifyAppStoreAuth } from "@/packages/stores/app-store/verify-auth";
import { createAppStoreClient } from "@/core/clients/app-store-factory";
import {
  checkPushPrerequisites,
  serviceFailure,
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
      throw clientResult.error;
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
      return serviceFailure(
        AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.APP_STORE_LIST_APPS_FAILED
        )
      );
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
      return {
        found: false,
        error: AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.APP_STORE_FETCH_APP_INFO_FAILED,
          "Failed to fetch App Store app info"
        ),
      };
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

      const versionString = latestVersion.attributes?.versionString ?? "";
      const appStoreState = latestVersion.attributes?.appStoreState;

      return {
        found: true,
        versionString,
        state: appStoreState ?? "UNKNOWN",
      };
    } catch (error) {
      return {
        found: false,
        error: AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.APP_STORE_GET_LATEST_VERSION_FAILED,
          "Failed to fetch latest App Store version"
        ),
      };
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
          (v) => v.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION"
        );
        if (!editableVersion) {
          return serviceFailure(
            AppError.notFound(
              ERROR_CODES.APP_STORE_VERSION_NOT_EDITABLE,
              "No editable version found for release notes update"
            )
          );
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
      const partialError = !success
        ? AppError.wrap(
            failed[0]?.error ?? "Failed to update some release notes",
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            ERROR_CODES.APP_STORE_UPDATE_RELEASE_NOTES_PARTIAL
          )
        : undefined;
      if (!success) {
        return serviceFailure(
          partialError ??
            AppError.internal(
              ERROR_CODES.APP_STORE_UPDATE_RELEASE_NOTES_FAILED,
              "Failed to update App Store release notes"
            )
        );
      }

      return {
        success: true,
        data: { updated, failed },
      };
    } catch (error) {
      return serviceFailure(
        AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.APP_STORE_UPDATE_RELEASE_NOTES_FAILED,
          "Failed to update App Store release notes"
        )
      );
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
      return serviceFailure(
        AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.APP_STORE_PULL_RELEASE_NOTES_FAILED,
          "Failed to pull App Store release notes"
        )
      );
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
          versionString: version.attributes?.versionString ?? "",
          state: version.attributes?.appStoreState,
        },
      };
    } catch (error) {
      return serviceFailure(
        AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.APP_STORE_CREATE_VERSION_FAILED,
          "Failed to create App Store version"
        )
      );
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

      try {
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
      } catch (updateError) {
        console.error(
          `[MCP]   ⚠️ Failed to update registered-apps.json: ${
            updateError instanceof Error
              ? updateError.message
              : String(updateError)
          }`
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
      const wrapped = AppError.wrap(
        error,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.APP_STORE_PUSH_FAILED,
        error instanceof Error ? error.message : String(error)
      );

      if (
        wrapped.message.includes("409 Conflict") &&
        wrapped.message.includes("STATE_ERROR")
      ) {
        console.error(
          `[AppStore]   🔄 STATE_ERROR detected. New version needed.`
        );

        try {
          const version = await client.createNewVersionWithAutoIncrement();
          const versionId = version.id;
          const versionString = version.attributes?.versionString ?? "";
          const locales = Object.keys(appStoreData.locales);

          console.error(
            `[AppStore]   ✅ New version ${versionString} created.`
          );

          return {
            success: false,
            error: AppError.conflict(
              ERROR_CODES.APP_STORE_STATE_ERROR,
              "New version required"
            ),
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
            error: AppError.wrap(
              versionError,
              HTTP_STATUS.INTERNAL_SERVER_ERROR,
              ERROR_CODES.APP_STORE_CREATE_VERSION_FOR_STATE_ERROR_FAILED,
              `Failed to create new version: ${versionMsg}`
            ),
          };
        }
      }

      console.error(`[AppStore]   ❌ Push failed`, error);
      return { success: false, error: wrapped };
    }
  }

  async verifyAuth(expirationSeconds = 300): Promise<
    VerifyAuthResult<{
      header: Record<string, unknown>;
      payload: Record<string, unknown>;
    }>
  > {
    const result = await verifyAppStoreAuth({ expirationSeconds });

    if (!result.success) {
      return {
        success: false,
        error: AppError.wrap(
          result.error ?? "Unknown error",
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.APP_STORE_VERIFY_AUTH_FAILED,
          "Failed to verify App Store auth"
        ),
      };
    }

    return { success: true, data: result.data };
  }
}
