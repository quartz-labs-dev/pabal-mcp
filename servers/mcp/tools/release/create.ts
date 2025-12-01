import { type StoreType } from "@packages/common/types";
import { loadConfig, checkLatestVersions } from "@packages/common";
import { findApp } from "@packages/utils";
import { createAppStoreVersion } from "@packages/app-store/create-version";
import { createGooglePlayVersion } from "@packages/play-store/create-version";
import { AppStoreService, GooglePlayService } from "@servers/mcp/core/services";

const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();

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

  // Determine slug
  let slug: string;
  let registeredApp = app ? findApp(app) : undefined;

  if (app && registeredApp) {
    // Successfully retrieved app info by app slug
    slug = app;
    if (!packageName && registeredApp.googlePlay) {
      packageName = registeredApp.googlePlay.packageName;
    }
    if (!bundleId && registeredApp.appStore) {
      bundleId = registeredApp.appStore.bundleId;
    }
  } else if (packageName || bundleId) {
    // Find app by bundleId or packageName
    const identifier = packageName || bundleId || "";
    registeredApp = findApp(identifier);
    if (!registeredApp) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ App registered with "${identifier}" not found. Check registered apps using apps-search.`,
          },
        ],
      };
    }
    slug = registeredApp.slug;
    if (!packageName && registeredApp.googlePlay) {
      packageName = registeredApp.googlePlay.packageName;
    }
    if (!bundleId && registeredApp.appStore) {
      bundleId = registeredApp.appStore.bundleId;
    }
  } else {
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ App not found. Please provide app (slug), packageName, or bundleId.`,
        },
      ],
    };
  }

  const config = loadConfig();

  // If version is not provided, check latest versions and prompt user
  if (!version) {
    const versionInfo = await checkLatestVersions({
      store,
      bundleId,
      packageName,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: versionInfo.join("\n"),
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
    if (!config.appStore) {
      results.push(
        `⏭️  Skipping App Store (not configured in secrets/aso-config.json)`
      );
    } else if (!bundleId) {
      results.push(`⏭️  Skipping App Store (no bundleId provided)`);
    } else {
      const clientResult = appStoreService.createClient(bundleId);

      if (!clientResult.success) {
        results.push(
          `❌ App Store version creation failed: ${clientResult.error}`
        );
      } else {
        try {
          console.error(`[MCP]   📦 Creating App Store version ${version}...`);
          const result = await createAppStoreVersion({
            client: clientResult.data,
            versionString: version,
          });
          const state = result.version.attributes.appStoreState?.toUpperCase();
          console.error(
            `[MCP]     ✅ App Store version created (${state || "UNKNOWN"})`
          );

          results.push(
            `✅ App Store version ${result.version.attributes.versionString} created` +
              (state ? ` (${state})` : "")
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          results.push(`❌ App Store version creation failed: ${msg}`);
          console.error(`❌ App Store error:`, error);
        }
      }
    }
  }

  if (store === "googlePlay" || store === "both") {
    if (!config.playStore) {
      results.push(
        `⏭️  Skipping Google Play (not configured in secrets/aso-config.json)`
      );
    } else if (!packageName) {
      results.push(`⏭️  Skipping Google Play (no packageName provided)`);
    } else if (!versionCodes || versionCodes.length === 0) {
      results.push(`⏭️  Skipping Google Play (no version codes provided)`);
    } else {
      const clientResult = googlePlayService.createClient(packageName);

      if (!clientResult.success) {
        results.push(
          `❌ Google Play version creation failed: ${clientResult.error}`
        );
      } else {
        try {
          console.error(
            `[MCP]   📦 Creating Google Play production release ${version}...`
          );
          await createGooglePlayVersion({
            client: clientResult.data,
            versionString: version,
            versionCodes,
          });
          console.error(`[MCP]     ✅ Google Play version created`);

          results.push(
            `✅ Google Play production draft created with versionCodes: ${versionCodes.join(
              ", "
            )}`
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          results.push(`❌ Google Play version creation failed: ${msg}`);
          console.error(`❌ Google Play error:`, error);
        }
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
