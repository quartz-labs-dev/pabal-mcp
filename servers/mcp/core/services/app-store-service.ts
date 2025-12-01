import { createAppStoreClient } from "@servers/mcp/core/clients";
import type { AppStoreClient } from "@packages/app-store/client";
import {
  type MaybeResult,
  type ServiceResult,
  type StoreAppSummary,
} from "./types";

interface AppStoreAppInfo {
  appId?: string;
  name?: string;
  supportedLocales?: string[];
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * App Store-facing service layer that wraps client creation and common operations.
 * Keeps MCP tools independent from client factories and SDK details.
 */
export class AppStoreService {
  createClient(bundleId: string): ServiceResult<AppStoreClient> {
    const result = createAppStoreClient({ bundleId });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: result.client };
  }

  /**
   * List released apps. Uses a fresh client to ensure working directory independence.
   */
  async listReleasedApps(): Promise<ServiceResult<StoreAppSummary[]>> {
    const clientResult = this.createClient("dummy");
    if (!clientResult.success) {
      return clientResult;
    }

    try {
      const apps = await clientResult.data.listAllApps({ onlyReleased: true });
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
      const client =
        existingClient ??
        (await (async () => {
          const clientResult = this.createClient(bundleId || "dummy");
          if (!clientResult.success) {
            throw new Error(clientResult.error);
          }
          return clientResult.data;
        })());

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
}
