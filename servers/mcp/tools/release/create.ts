import { type StoreType } from "@/packages/configs/aso-config/types";
import { loadConfig } from "@/packages/configs/secrets-config/config";
import {
  AppResolutionService,
  AppStoreService,
  GooglePlayService,
} from "@servers/mcp/core/services";
import { getLatestVersions } from "@servers/mcp/core/workflows/version-info";

const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();
const appResolutionService = new AppResolutionService();

interface AsoCreateVersionOptions {
  app?: string; // Registered app slug
  packageName?: string; // For Google Play
  bundleId?: string; // For App Store
  version?: string; // Optional: if not provided, will check latest versions and prompt
  store?: StoreType;
  versionCodes?: number[]; // For Google Play
}

export async function handleAsoCreateVersion(options: AsoCreateVersionOptions) {
  const { app, version, store = "both", versionCodes } = options;
  let { packageName, bundleId } = options;

  const resolved = appResolutionService.resolve({
    slug: app,
    packageName,
    bundleId,
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

  const {
    slug,
    bundleId: resolvedBundleId,
    packageName: resolvedPackageName,
    hasAppStore,
    hasGooglePlay,
  } = resolved.data;

  bundleId = resolvedBundleId;
  packageName = resolvedPackageName;

  const config = loadConfig();

  // If version is not provided, check latest versions and prompt user
  if (!version) {
    const versionInfo = await getLatestVersions({
      store,
      bundleId,
      packageName,
      hasAppStore,
      hasGooglePlay,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: versionInfo.messages.join("\n"),
        },
      ],
    };
  }

  // Version is provided, proceed with creation
  console.error(`[MCP] 📦 Creating version: ${version}`);
  console.error(`[MCP]   Store: ${store}`);
  console.error(`[MCP]   App: ${slug}`);
  if (packageName) console.error(`[MCP]   Package Name: ${packageName}`);
  if (bundleId) console.error(`[MCP]   Bundle ID: ${bundleId}`);
  if (versionCodes) {
    console.error(`[MCP]   Version Codes: ${versionCodes.join(", ")}`);
  }

  const results: string[] = [];

  if (store === "appStore" || store === "both") {
    if (!hasAppStore) {
      results.push(`⏭️  Skipping App Store (not registered for App Store)`);
    } else if (!config.appStore) {
      results.push(
        `⏭️  Skipping App Store (not configured in secrets/aso-config.json)`
      );
    } else if (!bundleId) {
      results.push(`⏭️  Skipping App Store (no bundleId provided)`);
    } else {
      const createResult = await appStoreService.createVersion(
        bundleId,
        version
      );
      if (!createResult.success) {
        results.push(
          `❌ App Store version creation failed: ${createResult.error}`
        );
      } else {
        const state = createResult.data.state?.toUpperCase() || "UNKNOWN";
        results.push(
          `✅ App Store version ${createResult.data.versionString} created (${state})`
        );
      }
    }
  }

  if (store === "googlePlay" || store === "both") {
    if (!hasGooglePlay) {
      results.push(`⏭️  Skipping Google Play (not registered for Google Play)`);
    } else if (!config.playStore) {
      results.push(
        `⏭️  Skipping Google Play (not configured in secrets/aso-config.json)`
      );
    } else if (!packageName) {
      results.push(`⏭️  Skipping Google Play (no packageName provided)`);
    } else if (!versionCodes || versionCodes.length === 0) {
      results.push(`⏭️  Skipping Google Play (no version codes provided)`);
    } else {
      const createResult = await googlePlayService.createVersion(
        packageName,
        version,
        versionCodes
      );
      if (!createResult.success) {
        results.push(
          `❌ Google Play version creation failed: ${createResult.error}`
        );
      } else {
        results.push(
          `✅ Google Play production draft created with versionCodes: ${versionCodes.join(
            ", "
          )}`
        );
      }
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `📦 Version Creation Results:\n${results.join("\n")}`,
      },
    ],
  };
}
