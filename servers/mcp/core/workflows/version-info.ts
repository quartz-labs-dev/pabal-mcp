import { loadConfig, getStoreTargets } from "@packages/common";
import { type StoreType } from "@packages/common/types";
import { AppStoreService, GooglePlayService } from "@servers/mcp/core/services";

const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();

export interface LatestVersionsInput {
  store?: StoreType;
  bundleId?: string;
  packageName?: string;
  hasAppStore: boolean;
  hasGooglePlay: boolean;
  includePrompt?: boolean;
}

export interface LatestVersionsResult {
  messages: string[];
  appStore?: {
    found: boolean;
    versionString?: string;
    state?: string;
    error?: string;
    skipped?: string;
  };
  googlePlay?: {
    found: boolean;
    versionName?: string;
    versionCodes?: number[];
    status?: string;
    releaseName?: string;
    error?: string;
    skipped?: string;
  };
}

export async function getLatestVersions(
  input: LatestVersionsInput
): Promise<LatestVersionsResult> {
  const {
    store,
    bundleId,
    packageName,
    hasAppStore,
    hasGooglePlay,
    includePrompt = true,
  } = input;
  const { includeAppStore, includeGooglePlay } = getStoreTargets(store);
  const config = loadConfig();

  const messages: string[] = [];
  messages.push(`\n📋 Checking latest versions from stores...\n`);

  const result: LatestVersionsResult = { messages };

  if (includeAppStore) {
    if (!hasAppStore) {
      const skipped = `⏭️  Skipping App Store (not registered for App Store)`;
      messages.push(skipped);
      result.appStore = { found: false, skipped };
    } else if (!config.appStore) {
      const skipped = `⏭️  Skipping App Store (not configured in secrets/aso-config.json)`;
      messages.push(skipped);
      result.appStore = { found: false, skipped };
    } else if (!bundleId) {
      const skipped = `⏭️  Skipping App Store (no bundleId provided)`;
      messages.push(skipped);
      result.appStore = { found: false, skipped };
    } else {
      const latest = await appStoreService.getLatestVersion(bundleId);
      if (!latest.found) {
        const msg = latest.error
          ? `🍎 App Store: Check failed - ${latest.error}`
          : `🍎 App Store: No version found (can create first version)`;
        messages.push(msg);
        result.appStore = { found: false, error: latest.error };
      } else {
        const state = latest.state?.toUpperCase() || "UNKNOWN";
        messages.push(`🍎 App Store: ${latest.versionString} (${state})`);
        result.appStore = {
          found: true,
          versionString: latest.versionString,
          state,
        };
      }
    }
  }

  if (includeGooglePlay) {
    if (!hasGooglePlay) {
      const skipped = `⏭️  Skipping Google Play (not registered for Google Play)`;
      messages.push(skipped);
      result.googlePlay = { found: false, skipped };
    } else if (!config.playStore) {
      const skipped = `⏭️  Skipping Google Play (not configured in secrets/aso-config.json)`;
      messages.push(skipped);
      result.googlePlay = { found: false, skipped };
    } else if (!packageName) {
      const skipped = `⏭️  Skipping Google Play (no packageName provided)`;
      messages.push(skipped);
      result.googlePlay = { found: false, skipped };
    } else {
      const latest =
        await googlePlayService.getLatestProductionRelease(packageName);
      if (!latest.found) {
        const msg = latest.error
          ? `🤖 Google Play: Check failed - ${latest.error}`
          : `🤖 Google Play: No version found (can create first version)`;
        messages.push(msg);
        result.googlePlay = { found: false, error: latest.error };
      } else {
        const versionName = latest.versionName || latest.releaseName || "N/A";
        const status = latest.status?.toUpperCase() || "UNKNOWN";
        messages.push(
          `🤖 Google Play: ${versionName} (versionCodes: ${latest.versionCodes.join(
            ", "
          )}, ${status})`
        );
        result.googlePlay = {
          found: true,
          versionName,
          versionCodes: latest.versionCodes,
          status,
          releaseName: latest.releaseName,
        };
      }
    }
  }

  if (includePrompt) {
    messages.push(
      `\n💡 To create a new version, please provide the 'version' parameter.`
    );
    messages.push(`   Example: Call release-create tool with version="1.2.0".`);
  }

  return result;
}
