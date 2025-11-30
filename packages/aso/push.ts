import {
  type AppStoreMultilingualAsoData,
  type GooglePlayMultilingualAsoData,
} from "./types";
import { prepareAsoDataForPush, type PreparedAsoData } from "./utils";
import { pushAppStoreAso, getAppStoreClient } from "@packages/app-store";
import { pushGooglePlayAso, getPlayStoreClient } from "@packages/play-store";
import type { EnvConfig } from "@packages/common/config";
import { findApp, updateAppSupportedLocales } from "@packages/utils";

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

  const client = getPlayStoreClient({
    ...config.playStore,
    packageName,
  });

  // prepareAsoDataForPush always returns multilingual data
  const googlePlayData: GooglePlayMultilingualAsoData =
    localAsoData.googlePlay!;

  console.error(`[MCP]   📤 Pushing to Google Play...`);
  console.error(`[MCP]     Package: ${packageName}`);

  const result = await pushGooglePlayAso({ client, asoData: googlePlayData });

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
}): Promise<
  string | { content: Array<{ type: "text"; text: string }>; _meta?: any }
> {
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

  const client = getAppStoreClient({
    ...config.appStore,
    bundleId,
  });

  // prepareAsoDataForPush always returns multilingual data
  const appStoreData: AppStoreMultilingualAsoData = localAsoData.appStore!;

  console.error(`[MCP]   📤 Pushing to App Store...`);
  console.error(`[MCP]     Bundle ID: ${bundleId}`);

  const result = await pushAppStoreAso({ client, asoData: appStoreData });

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
    return `✅ App Store data pushed (${result.localesPushed.length} locales)`;
  }

  if (result.needsNewVersion && result.versionInfo) {
    const { versionId, versionString, locales } = result.versionInfo;
    return {
      content: [
        {
          type: "text" as const,
          text: `🔄 New version required for App Store.

✅ New version ${versionString} created (Version ID: ${versionId})

📝 **What's New translation required**

Please translate What's New text for the following locales:
${locales.join(", ")}

After translation is complete, call the \`aso-update-whats-new\` tool:
\`\`\`json
{
  "bundleId": "${bundleId}",
  "versionId": "${versionId}",
  "whatsNew": {
    "en-US": "Bug fixes and improvements",
    "ko-KR": "버그 수정 및 개선사항",
    ...
  }
}
\`\`\`

After updating What's New, call \`aso-push\` again to push ASO data.`,
        },
      ],
      _meta: {
        needsTranslation: true,
        versionId,
        versionString,
        bundleId,
        locales,
      },
    };
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
