import {
  type StoreType,
  isGooglePlayMultilingual,
  isAppStoreMultilingual,
  loadAsoData,
  saveAsoData,
  prepareAsoDataForPush,
  getAsoDir,
  getAsoDataPaths,
  getAsoPushDir,
} from "@packages/aso";
import { loadConfig } from "@packages/common";
import { existsSync } from "node:fs";
import {
  AppResolutionService,
  AppStoreService,
  GooglePlayService,
} from "@servers/mcp/core/services";
import { formatPushResult } from "@servers/mcp/core/helpers/formatters";

const appResolutionService = new AppResolutionService();
const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();

interface AsoPushOptions {
  app?: string; // Registered app slug
  packageName?: string; // For Google Play
  bundleId?: string; // For App Store
  store?: StoreType;
  uploadImages?: boolean;
  dryRun?: boolean;
}

export async function handleAsoPush(options: AsoPushOptions) {
  const { store = "both", uploadImages = false, dryRun = false } = options;

  const resolved = appResolutionService.resolve({
    slug: options.app,
    packageName: options.packageName,
    bundleId: options.bundleId,
  });

  if (!resolved.success) {
    return {
      content: [
        {
          type: "text" as const,
          text: resolved.error,
        },
      ],
    };
  }

  const { slug, packageName, bundleId, hasAppStore, hasGooglePlay } =
    resolved.data;

  console.error(`[MCP] 📤 Pushing ASO data`);
  console.error(`[MCP]   Store: ${store}`);
  console.error(`[MCP]   App: ${slug}`);
  if (packageName) console.error(`[MCP]   Package Name: ${packageName}`);
  if (bundleId) console.error(`[MCP]   Bundle ID: ${bundleId}`);
  console.error(`[MCP]   Upload Images: ${uploadImages ? "Yes" : "No"}`);
  console.error(`[MCP]   Mode: ${dryRun ? "Dry run" : "Actual push"}`);

  const config = loadConfig();

  // Load local data from ASO directory
  const asoDir = getAsoPushDir();
  const { googlePlay: googlePlayDataPath, appStore: appStoreDataPath } =
    getAsoDataPaths(slug, asoDir);

  console.error(`[MCP]   📁 ASO Directory: ${asoDir}`);
  console.error(`[MCP]   📁 Base ASO Dir: ${getAsoDir()}`);
  console.error(`[MCP]   🔍 Checking data files...`);
  console.error(`[MCP]     Google Play: ${googlePlayDataPath}`);
  console.error(
    `[MCP]       Exists: ${existsSync(googlePlayDataPath) ? "✅ Yes" : "❌ No"}`
  );
  console.error(`[MCP]     App Store: ${appStoreDataPath}`);
  console.error(
    `[MCP]       Exists: ${existsSync(appStoreDataPath) ? "✅ Yes" : "❌ No"}`
  );

  const configData = loadAsoData(slug, { asoDir });

  console.error(`[MCP]   📊 Loaded data status:`);
  console.error(
    `[MCP]     Google Play: ${
      configData.googlePlay ? "✅ Loaded" : "❌ Not found"
    }`
  );
  if (configData.googlePlay) {
    const gpData = configData.googlePlay;
    if (isGooglePlayMultilingual(gpData)) {
      const locales = Object.keys(gpData.locales);
      console.error(
        `[MCP]       Locales: ${locales.join(", ")} (${locales.length} total)`
      );
    } else {
      console.error(
        `[MCP]       Language: ${gpData.defaultLanguage || "unknown"}`
      );
    }
  }
  console.error(
    `[MCP]     App Store: ${configData.appStore ? "✅ Loaded" : "❌ Not found"}`
  );
  if (configData.appStore) {
    const asData = configData.appStore;
    if (isAppStoreMultilingual(asData)) {
      const locales = Object.keys(asData.locales);
      console.error(
        `[MCP]       Locales: ${locales.join(", ")} (${locales.length} total)`
      );
    } else {
      console.error(`[MCP]       Locale: ${asData.locale || "unknown"}`);
    }
  }

  if (!configData.googlePlay && !configData.appStore) {
    const errorDetails = `❌ No ASO data found for ${slug}.

📁 Expected paths:
   Google Play: ${googlePlayDataPath}
   App Store: ${appStoreDataPath}

💡 To fix this:
   1. Run \`aso-pull\` to fetch data from stores
   2. Or ensure data exists at the paths above
   3. Check that data directory is set correctly (current: ${getAsoDir()})
      - Set \`dataDir\` in \`secrets/aso-config.json\` or
      - Set \`PABAL_MCP_DATA_DIR\` environment variable`;

    console.error(`[MCP]   ${errorDetails}`);
    return {
      content: [{ type: "text" as const, text: errorDetails }],
    };
  }

  // Prepare data for push
  console.error(`[MCP]   🔄 Preparing data for push...`);
  const localAsoData = prepareAsoDataForPush(slug, configData);

  console.error(`[MCP]   📊 Prepared data status:`);
  console.error(
    `[MCP]     Google Play: ${
      localAsoData.googlePlay ? "✅ Ready" : "❌ Not available"
    }`
  );
  if (localAsoData.googlePlay) {
    const gpData = localAsoData.googlePlay;
    if (isGooglePlayMultilingual(gpData)) {
      const locales = Object.keys(gpData.locales);
      console.error(
        `[MCP]       Locales to push: ${locales.join(", ")} (${
          locales.length
        } total)`
      );
    }
  }
  console.error(
    `[MCP]     App Store: ${
      localAsoData.appStore ? "✅ Ready" : "❌ Not available"
    }`
  );
  if (localAsoData.appStore) {
    const asData = localAsoData.appStore;
    if (isAppStoreMultilingual(asData)) {
      const locales = Object.keys(asData.locales);
      console.error(
        `[MCP]       Locales to push: ${locales.join(", ")} (${
          locales.length
        } total)`
      );
    }
  }

  if (dryRun) {
    return {
      content: [
        {
          type: "text" as const,
          text: `📋 Dry run - Data that would be pushed:\n${JSON.stringify(
            localAsoData,
            null,
            2
          )}`,
        },
      ],
    };
  }

  // Save to ASO directory before pushing
  if (localAsoData.googlePlay || localAsoData.appStore) {
    saveAsoData(slug, localAsoData, { asoDir });
  }

  const results: string[] = [];

  // Push to Google Play
  if (store === "googlePlay" || store === "both") {
    if (!hasGooglePlay) {
      results.push(`⏭️  Skipping Google Play (not registered for Google Play)`);
    } else {
      const result = await googlePlayService.pushAsoData({
        config,
        packageName,
        localAsoData,
        googlePlayDataPath,
      });
      results.push(formatPushResult("Google Play", result));
    }
  }

  // Push to App Store
  if (store === "appStore" || store === "both") {
    if (!hasAppStore) {
      results.push(`⏭️  Skipping App Store (not registered for App Store)`);
    } else {
      const appStoreResult = await appStoreService.pushAsoData({
        config,
        bundleId,
        localAsoData,
        appStoreDataPath,
      });
      results.push(formatPushResult("App Store", appStoreResult));
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `📤 ASO Push Results:\n${results.join("\n")}`,
      },
    ],
  };
}
