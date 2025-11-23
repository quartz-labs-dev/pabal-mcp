import { GooglePlayClient } from "./client";
import type { PlayStoreConfig } from "@packages/shared/config";

interface CheckGooglePlayLatestVersionOptions {
  packageName: string;
  config: PlayStoreConfig;
}

/**
 * Check latest version from Google Play
 * Returns formatted version information string
 */
export async function checkGooglePlayLatestVersion({
  packageName,
  config,
}: CheckGooglePlayLatestVersionOptions): Promise<string | null> {
  try {
    const serviceAccount = JSON.parse(config.serviceAccountJson);
    const client = new GooglePlayClient({
      packageName,
      serviceAccountKey: serviceAccount,
    });

    const latestRelease = await client.getLatestProductionRelease();
    if (latestRelease) {
      const versionName =
        latestRelease.versionName || latestRelease.releaseName || "N/A";
      const status = latestRelease.status?.toUpperCase() || "UNKNOWN";
      const versionCodesStr = latestRelease.versionCodes.join(", ");
      return `🤖 Google Play: ${versionName} (versionCodes: ${versionCodesStr}, ${status})`;
    } else {
      return `🤖 Google Play: No version found (can create first version)`;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return `🤖 Google Play: Check failed - ${msg}`;
  }
}
