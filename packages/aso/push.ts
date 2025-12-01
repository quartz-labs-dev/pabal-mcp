import {
  type AppStoreMultilingualAsoData,
  type GooglePlayMultilingualAsoData,
} from "./types";
import { type PreparedAsoData } from "./utils";
import { pushAppStoreAso } from "@packages/app-store";
import { pushGooglePlayAso } from "@packages/play-store";
import { AppStoreService, GooglePlayService } from "@servers/mcp/core/services";
import type { EnvConfig } from "@packages/common/config";
import { findApp, updateAppSupportedLocales } from "@packages/utils";

const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();

export async function pushToGooglePlay({
  config,
  packageName,
  localAsoData,
  googlePlayDataPath,
}: {
  config: EnvConfig;
  packageName?: string;
  localAsoData: PreparedAsoData;
  googlePlayDataPath: string;
}): Promise<string> {
  if (!config.playStore) {
    return `⏭️  Skipping Google Play (not configured in secrets/aso-config.json)`;
  }
  if (!packageName) {
    return `⏭️  Skipping Google Play (no packageName provided)`;
  }
  if (!localAsoData.googlePlay) {
    console.error(
      `[MCP]   ⏭️  Skipping Google Play: No data found after preparation`
    );
    console.error(
      `[MCP]     Check if Google Play data exists in: ${googlePlayDataPath}`
    );
    return `⏭️  Skipping Google Play (no data found)`;
  }

  const clientResult = googlePlayService.createClient(packageName);

  if (!clientResult.success) {
    return `❌ Google Play push failed: ${clientResult.error}`;
  }

  // prepareAsoDataForPush always returns multilingual data
  const googlePlayData: GooglePlayMultilingualAsoData =
    localAsoData.googlePlay!;

  console.error(`[MCP]   📤 Pushing to Google Play...`);
  console.error(`[MCP]     Package: ${packageName}`);

  const result = await pushGooglePlayAso({
    client: clientResult.data,
    asoData: googlePlayData,
  });

  if (
    result.success &&
    result.localesPushed &&
    result.localesPushed.length > 0
  ) {
    // Update registered-apps.json with pushed locales
    const appIdentifier = packageName;
    if (appIdentifier) {
      const updated = updateAppSupportedLocales({
        identifier: appIdentifier,
        store: "googlePlay",
        locales: result.localesPushed,
      });
      if (updated) {
        console.error(
          `[MCP]   ✅ Updated registered-apps.json with ${result.localesPushed.length} Google Play locales`
        );
      }
    }
    return `✅ Google Play data pushed (${result.localesPushed.length} locales)`;
  }
  return `❌ Google Play push failed: ${result.error}`;
}

export async function pushToAppStore({
  config,
  bundleId,
  localAsoData,
  appStoreDataPath,
}: {
  config: EnvConfig;
  bundleId?: string;
  localAsoData: PreparedAsoData;
  appStoreDataPath: string;
}): Promise<string> {
  if (!config.appStore) {
    return `⏭️  Skipping App Store (not configured in secrets/aso-config.json)`;
  }
  if (!bundleId) {
    return `⏭️  Skipping App Store (no bundleId provided)`;
  }
  if (!localAsoData.appStore) {
    console.error(
      `[MCP]   ⏭️  Skipping App Store: No data found after preparation`
    );
    console.error(
      `[MCP]     Check if App Store data exists in: ${appStoreDataPath}`
    );
    return `⏭️  Skipping App Store (no data found)`;
  }

  const clientResult = appStoreService.createClient(bundleId);

  if (!clientResult.success) {
    return `❌ App Store push failed: ${clientResult.error}`;
  }

  // prepareAsoDataForPush always returns multilingual data
  const appStoreData: AppStoreMultilingualAsoData = localAsoData.appStore!;

  console.error(`[MCP]   📤 Pushing to App Store...`);
  console.error(`[MCP]     Bundle ID: ${bundleId}`);

  const result = await pushAppStoreAso({
    client: clientResult.data,
    asoData: appStoreData,
  });

  if (
    result.success &&
    result.localesPushed &&
    result.localesPushed.length > 0
  ) {
    // Update registered-apps.json with pushed locales
    const appIdentifier = bundleId;
    if (appIdentifier) {
      const updated = updateAppSupportedLocales({
        identifier: appIdentifier,
        store: "appStore",
        locales: result.localesPushed,
      });
      if (updated) {
        console.error(
          `[MCP]   ✅ Updated registered-apps.json with ${result.localesPushed.length} App Store locales`
        );
      }
    }

    // Check for failed fields (Name/Subtitle)
    if (result.failedFields && result.failedFields.length > 0) {
      const fieldDisplayNames: Record<string, string> = {
        name: "Name",
        subtitle: "Subtitle",
      };

      return `⚠️  App Store data pushed with partial failures (${result.localesPushed.length} locales)

❌ **Failed Fields (Bug - Fixing):**
${result.failedFields
  .map((f) => {
    const fieldNames = f.fields.map(
      (field) => fieldDisplayNames[field] || field
    );
    return `   • ${f.locale}: ${fieldNames.join(", ")} - Cannot be updated in current app state (requires new version). Previously, you needed to update these manually in App Store Connect console.`;
  })
  .join("\n")}

✅ **Successfully Updated:**
   • Description, Keywords, Promotional Text, URLs for all ${result.localesPushed.length} locales

🔧 **Status:** This is a known limitation. We're working on a fix to handle this automatically.`;
    }

    return `✅ App Store data pushed (${result.localesPushed.length} locales)`;
  }

  if (result.needsNewVersion && result.versionInfo) {
    const { versionId, versionString } = result.versionInfo;
    return `✅ New version ${versionString} created (Version ID: ${versionId})`;
  }

  return `❌ App Store push failed: ${result.error}`;
}

export function resolveAsoAppInfo(options: {
  app?: string;
  packageName?: string;
  bundleId?: string;
}): { slug: string; packageName?: string; bundleId?: string } {
  const { app, packageName, bundleId } = options;

  if (app) {
    const registeredApp = findApp(app);
    if (registeredApp) {
      return {
        slug: app,
        packageName: packageName || registeredApp.googlePlay?.packageName,
        bundleId: bundleId || registeredApp.appStore?.bundleId,
      };
    }
  }

  const identifier = packageName || bundleId;
  if (identifier) {
    const registeredApp = findApp(identifier);
    if (registeredApp) {
      return {
        slug: registeredApp.slug,
        packageName: packageName || registeredApp.googlePlay?.packageName,
        bundleId: bundleId || registeredApp.appStore?.bundleId,
      };
    }
    throw new Error(`App "${identifier}" not found. Check apps-search.`);
  }

  throw new Error("Please provide app (slug), packageName, or bundleId.");
}
