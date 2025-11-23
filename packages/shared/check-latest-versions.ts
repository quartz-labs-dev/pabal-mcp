import { checkAppStoreLatestVersion } from "@packages/app-store/check-latest-versions";
import { checkGooglePlayLatestVersion } from "@packages/play-store/check-latest-versions";
import { type StoreType } from "@packages/shared/types";
import { loadConfig } from "@packages/shared/config";

interface CheckLatestVersionsOptions {
  store?: StoreType;
  bundleId?: string;
  packageName?: string;
  includePrompt?: boolean; // Whether to include prompt message at the end
}

/**
 * Check latest versions from stores (unified interface)
 * Delegates to store-specific functions in their respective packages
 */
export async function checkLatestVersions(
  options: CheckLatestVersionsOptions
): Promise<string[]> {
  const {
    store = "both",
    bundleId,
    packageName,
    includePrompt = true,
  } = options;
  const config = loadConfig();
  const versionInfo: string[] = [];

  versionInfo.push(`\n📋 Checking latest versions from stores...\n`);

  // Check App Store latest version
  if (
    (store === "appStore" || store === "both") &&
    config.appStore &&
    bundleId
  ) {
    const appStoreInfo = await checkAppStoreLatestVersion({
      bundleId,
      config: config.appStore,
    });
    if (appStoreInfo) {
      versionInfo.push(appStoreInfo);
    }
  }

  // Check Google Play latest version
  if (
    (store === "googlePlay" || store === "both") &&
    config.playStore &&
    packageName
  ) {
    const playStoreInfo = await checkGooglePlayLatestVersion({
      packageName,
      config: config.playStore,
    });
    if (playStoreInfo) {
      versionInfo.push(playStoreInfo);
    }
  }

  if (includePrompt) {
    versionInfo.push(
      `\n💡 To create a new version, please provide the 'version' parameter.`
    );
    versionInfo.push(
      `   Example: Call release-create tool with version="1.2.0".`
    );
  }

  return versionInfo;
}
