import { createGooglePlayClient } from "@servers/mcp/core/clients/google-play-factory";
import type { GooglePlayClient } from "@packages/stores/play-store/client";
import type { GooglePlayMultilingualAsoData } from "@/packages/configs/aso-config/types";
import type { PreparedAsoData } from "@/packages/configs/aso-config/utils";
import type { EnvConfig } from "@/packages/configs/secrets-config/types";
import { toErrorMessage } from "@servers/mcp/core/clients/client-factory-helpers";
import {
  checkPushPrerequisites,
  toServiceResult,
  updateRegisteredLocales,
} from "./service-helpers";
import {
  type MaybeResult,
  type ServiceResult,
  type GooglePlayReleaseInfo,
  type UpdatedReleaseNotesResult,
  type PushAsoResult,
  type CreatedGooglePlayVersion,
  type VerifyAuthResult,
} from "./types";
import type { GooglePlayReleaseNote } from "@/packages/configs/aso-config/types";
import { verifyPlayStoreAuth } from "@packages/stores/play-store/verify-auth";

interface GooglePlayAppInfo {
  name?: string;
  supportedLocales?: string[];
}

/**
 * Google Play-facing service layer that wraps client creation and common operations.
 * Keeps MCP tools independent from client factories and SDK details.
 */
export class GooglePlayService {
  private getClientOrThrow(
    packageName: string,
    existingClient?: GooglePlayClient
  ): GooglePlayClient {
    if (existingClient) return existingClient;
    const clientResult = this.createClient(packageName);
    if (!clientResult.success) {
      throw new Error(clientResult.error);
    }
    return clientResult.data;
  }

  createClient(packageName: string): ServiceResult<GooglePlayClient> {
    return toServiceResult(createGooglePlayClient({ packageName }));
  }

  /**
   * Fetch a single app info (with locales) by packageName.
   */
  async fetchAppInfo(
    packageName: string
  ): Promise<MaybeResult<GooglePlayAppInfo>> {
    try {
      const client = this.getClientOrThrow(packageName);
      const appInfo = await client.verifyAppAccess();
      return {
        found: true,
        name: appInfo.title,
        supportedLocales: appInfo.supportedLocales,
      };
    } catch (error) {
      return { found: false, error: toErrorMessage(error) };
    }
  }

  async getLatestProductionRelease(
    packageName: string
  ): Promise<MaybeResult<GooglePlayReleaseInfo>> {
    try {
      const client = this.getClientOrThrow(packageName);
      const latestRelease = await client.getLatestProductionRelease();
      if (!latestRelease) {
        return { found: false };
      }

      const { versionName, releaseName, status, versionCodes } = latestRelease;

      return {
        found: true,
        versionName,
        releaseName,
        status,
        versionCodes,
      };
    } catch (error) {
      return { found: false, error: toErrorMessage(error) };
    }
  }

  async updateReleaseNotes(
    packageName: string,
    releaseNotes: Record<string, string>,
    track?: string,
    supportedLocales?: string[]
  ): Promise<ServiceResult<UpdatedReleaseNotesResult>> {
    try {
      const client = this.getClientOrThrow(packageName);
      const filteredReleaseNotes: Record<string, string> = {};
      if (supportedLocales) {
        for (const locale of supportedLocales) {
          if (releaseNotes[locale]) {
            filteredReleaseNotes[locale] = releaseNotes[locale];
          }
        }
      } else {
        Object.assign(filteredReleaseNotes, releaseNotes);
      }

      if (Object.keys(filteredReleaseNotes).length === 0) {
        return {
          success: false,
          error: "No supported locales found in release notes",
        };
      }

      try {
        const updateResult = await client.updateReleaseNotes({
          releaseNotes: filteredReleaseNotes,
          track: track ?? "production",
        });

        const success = updateResult.failed.length === 0;
        return {
          success,
          data: {
            updated: updateResult.updated,
            failed: updateResult.failed,
          },
          ...(!success ? { error: updateResult.failed[0]?.error } : {}),
        } as ServiceResult<UpdatedReleaseNotesResult>;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }

  async pullReleaseNotes(
    packageName: string
  ): Promise<ServiceResult<GooglePlayReleaseNote[]>> {
    try {
      const client = this.getClientOrThrow(packageName);
      const releaseNotes = await client.pullProductionReleaseNotes();
      return { success: true, data: releaseNotes };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }

  async createVersion(
    packageName: string,
    versionString: string,
    versionCodes: number[]
  ): Promise<ServiceResult<CreatedGooglePlayVersion>> {
    try {
      const client = this.getClientOrThrow(packageName);
      await client.createProductionRelease({
        versionCodes,
        releaseName: versionString,
        status: "draft",
      });
      return {
        success: true,
        data: {
          versionName: versionString,
          versionCodes,
          status: "DRAFT",
        },
      };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }

  async pushAsoData({
    config,
    packageName,
    localAsoData,
    googlePlayDataPath,
  }: {
    config: EnvConfig;
    packageName?: string;
    localAsoData: PreparedAsoData;
    googlePlayDataPath: string;
  }): Promise<PushAsoResult> {
    const skip = checkPushPrerequisites({
      storeLabel: "Google Play",
      configured: Boolean(config.playStore),
      identifierLabel: "packageName",
      identifier: packageName,
      hasData: Boolean(localAsoData.googlePlay),
      dataPath: googlePlayDataPath,
    });
    if (skip) return { success: false, error: skip };

    const ensuredPackage = packageName as string;
    const googlePlayData =
      localAsoData.googlePlay as GooglePlayMultilingualAsoData;
    const client = this.getClientOrThrow(ensuredPackage);

    console.error(`[MCP]   📤 Pushing to Google Play...`);
    console.error(`[MCP]     Package: ${packageName}`);

    try {
      const localesToPush = Object.keys(googlePlayData.locales);

      for (const locale of localesToPush) {
        console.error(`[GooglePlay]   📤 Preparing locale: ${locale}`);
      }

      await client.pushMultilingualAsoData(googlePlayData);

      const updated = updateRegisteredLocales(
        ensuredPackage,
        "googlePlay",
        localesToPush
      );
      if (updated) {
        console.error(
          `[MCP]   ✅ Updated registered-apps.json with ${localesToPush.length} Google Play locales`
        );
      }

      return {
        success: true,
        localesPushed: localesToPush,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[GooglePlay] ❌ Push failed: ${msg}`, error);
      return { success: false, error: msg };
    }
  }

  async verifyAuth(): Promise<
    VerifyAuthResult<{ client_email: string; project_id: string }>
  > {
    return verifyPlayStoreAuth();
  }
}
