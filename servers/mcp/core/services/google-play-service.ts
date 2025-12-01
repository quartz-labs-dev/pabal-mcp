import { createGooglePlayClient } from "@servers/mcp/core/clients";
import type { GooglePlayClient } from "@packages/play-store/client";
import { type MaybeResult, type ServiceResult } from "./types";

interface GooglePlayAppInfo {
  name?: string;
  supportedLocales?: string[];
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Google Play-facing service layer that wraps client creation and common operations.
 * Keeps MCP tools independent from client factories and SDK details.
 */
export class GooglePlayService {
  createClient(packageName: string): ServiceResult<GooglePlayClient> {
    const result = createGooglePlayClient({ packageName });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: result.client };
  }

  /**
   * Fetch a single app info (with locales) by packageName.
   */
  async fetchAppInfo(
    packageName: string
  ): Promise<MaybeResult<GooglePlayAppInfo>> {
    const clientResult = this.createClient(packageName);
    if (!clientResult.success) {
      return { found: false, error: clientResult.error };
    }

    try {
      const appInfo = await clientResult.data.verifyAppAccess();
      return {
        found: true,
        name: appInfo.title,
        supportedLocales: appInfo.supportedLocales,
      };
    } catch (error) {
      return { found: false, error: toErrorMessage(error) };
    }
  }
}
