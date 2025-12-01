/**
 * add-app: Register app by bundleId or packageName
 */

import { loadConfig } from "@packages/common";
import {
  registerApp,
  findApp,
  loadRegisteredApps,
  saveRegisteredApps,
  toRegisteredAppStoreInfo,
  toRegisteredGooglePlayInfo,
  type RegisteredApp,
} from "@packages/utils";
import { AppStoreService, GooglePlayService } from "@servers/mcp/core/services";

const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();

interface AddAppOptions {
  /** App identifier (bundleId or packageName) */
  identifier: string;
  /** Custom slug (if not specified, uses last part of identifier) */
  slug?: string;
  /** Target store (default: both - check both stores) */
  store?: "appStore" | "googlePlay" | "both";
}

/**
 * Generate slug (last part of identifier)
 */
function generateSlug(identifier: string): string {
  const parts = identifier.split(".");
  return parts[parts.length - 1].toLowerCase();
}

export async function handleAddApp(options: AddAppOptions) {
  const { identifier, slug: customSlug, store = "both" } = options;

  console.error(`[MCP] 📱 Adding app: ${identifier} (store: ${store})`);

  if (!identifier) {
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ identifier is required.

Usage:
\`\`\`json
{ "identifier": "com.example.app" }
{ "identifier": "com.example.app", "slug": "myapp" }
{ "identifier": "com.example.app", "store": "googlePlay" }
\`\`\``,
        },
      ],
    };
  }

  const config = loadConfig();

  // Check if already registered
  const existing = findApp(identifier);
  if (existing) {
    // Update language info for existing apps
    const appsConfig = loadRegisteredApps();
    const appIndex = appsConfig.apps.findIndex((a) => a.slug === existing.slug);

    if (appIndex >= 0) {
      let updated = false;
      const updateResults: string[] = [];

      // Update App Store language info
      if (store === "both" || store === "appStore") {
        if (existing.appStore) {
          const asResult = await appStoreService.fetchAppInfo(identifier);

          if (asResult.found && asResult.supportedLocales) {
            if (!appsConfig.apps[appIndex].appStore) {
              appsConfig.apps[appIndex].appStore = {
                bundleId: identifier,
                appId: asResult.appId,
                name: asResult.name,
              };
            }
            appsConfig.apps[appIndex].appStore!.supportedLocales =
              asResult.supportedLocales;
            updated = true;
            updateResults.push(
              `🍎 App Store: Updated locales (${asResult.supportedLocales.length})`
            );
          }
        }
      }

      // Update Google Play language info
      if (store === "both" || store === "googlePlay") {
        if (existing.googlePlay || store === "googlePlay") {
          const gpResult = await googlePlayService.fetchAppInfo(identifier);

          if (gpResult.found && gpResult.supportedLocales) {
            if (!appsConfig.apps[appIndex].googlePlay) {
              appsConfig.apps[appIndex].googlePlay = {
                packageName: identifier,
                name: gpResult.name,
              };
            }
            appsConfig.apps[appIndex].googlePlay!.supportedLocales =
              gpResult.supportedLocales;
            if (gpResult.name) {
              appsConfig.apps[appIndex].googlePlay!.name = gpResult.name;
            }
            updated = true;
            updateResults.push(
              `🤖 Google Play: Updated locales (${gpResult.supportedLocales.length})`
            );
          }
        }
      }

      if (updated) {
        saveRegisteredApps(appsConfig);
        const updatedApp = appsConfig.apps[appIndex];

        const localeInfo: string[] = [];
        if (
          updatedApp.appStore?.supportedLocales &&
          updatedApp.appStore.supportedLocales.length > 0
        ) {
          localeInfo.push(
            `• App Store locales: ${updatedApp.appStore.supportedLocales.join(", ")}`
          );
        }
        if (
          updatedApp.googlePlay?.supportedLocales &&
          updatedApp.googlePlay.supportedLocales.length > 0
        ) {
          localeInfo.push(
            `• Google Play locales: ${updatedApp.googlePlay.supportedLocales.join(", ")}`
          );
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `✅ App language info updated

• Slug: \`${updatedApp.slug}\`
• Name: ${updatedApp.name}
• App Store: ${updatedApp.appStore ? `✅ ${updatedApp.appStore.bundleId}` : "❌"}
• Google Play: ${updatedApp.googlePlay ? `✅ ${updatedApp.googlePlay.packageName}` : "❌"}
${updateResults.length > 0 ? `\n**Updates:**\n${updateResults.map((r) => `  • ${r}`).join("\n")}` : ""}
${localeInfo.length > 0 ? `\n**Supported Languages:**\n${localeInfo.map((l) => `  ${l}`).join("\n")}` : ""}`,
            },
          ],
          _meta: { app: updatedApp },
        };
      }
    }

    // If no updates were made, return existing info
    const localeInfo: string[] = [];
    if (
      existing.appStore?.supportedLocales &&
      existing.appStore.supportedLocales.length > 0
    ) {
      localeInfo.push(
        `• App Store locales: ${existing.appStore.supportedLocales.join(", ")}`
      );
    }
    if (
      existing.googlePlay?.supportedLocales &&
      existing.googlePlay.supportedLocales.length > 0
    ) {
      localeInfo.push(
        `• Google Play locales: ${existing.googlePlay.supportedLocales.join(", ")}`
      );
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `⏭️ App is already registered.

• Slug: \`${existing.slug}\`
• Name: ${existing.name}
• App Store: ${existing.appStore ? `✅ ${existing.appStore.bundleId}` : "❌"}
• Google Play: ${existing.googlePlay ? `✅ ${existing.googlePlay.packageName}` : "❌"}
${localeInfo.length > 0 ? `\n**Supported Languages:**\n${localeInfo.map((l) => `  ${l}`).join("\n")}` : ""}`,
        },
      ],
      _meta: { app: existing },
    };
  }

  const slug = customSlug || generateSlug(identifier);

  // Check for slug duplicates
  const slugExists = findApp(slug);
  if (slugExists) {
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ slug "${slug}" is already in use. Please specify a different slug.

\`\`\`json
{ "identifier": "${identifier}", "slug": "different-slug" }
\`\`\``,
        },
      ],
    };
  }

  // Fetch app information by store (언어 정보 포함)
  let appStoreInfo: RegisteredApp["appStore"] = undefined;
  let googlePlayInfo: RegisteredApp["googlePlay"] = undefined;
  let appName = identifier;

  const results: string[] = [];

  // Check App Store
  if (store === "both" || store === "appStore") {
    console.error(`[MCP]   🔍 Searching App Store for: ${identifier}`);
    const asResult = await appStoreService.fetchAppInfo(identifier);
    if (asResult.found) {
      appStoreInfo = toRegisteredAppStoreInfo({
        bundleId: identifier,
        appInfo: asResult,
      });
      appName = asResult.name || appName;
      const localeInfo =
        asResult.supportedLocales && asResult.supportedLocales.length > 0
          ? ` (${asResult.supportedLocales.length} locales)`
          : "";
      results.push(`🍎 App Store: ✅ Found (${asResult.name})${localeInfo}`);
    } else {
      results.push(`🍎 App Store: ❌ Not found`);
    }
  }

  // Check Google Play
  if (store === "both" || store === "googlePlay") {
    console.error(`[MCP]   🔍 Searching Google Play for: ${identifier}`);
    const gpResult = await googlePlayService.fetchAppInfo(identifier);
    if (gpResult.found) {
      googlePlayInfo = toRegisteredGooglePlayInfo({
        packageName: identifier,
        appInfo: gpResult,
      });
      appName = gpResult.name || appName;
      const localeInfo =
        gpResult.supportedLocales && gpResult.supportedLocales.length > 0
          ? ` (${gpResult.supportedLocales.length} locales)`
          : "";
      results.push(`🤖 Google Play: ✅ Found (${gpResult.name})${localeInfo}`);
    } else {
      results.push(`🤖 Google Play: ❌ Not found`);
    }
  }

  // Must be found in at least one store
  if (!appStoreInfo && !googlePlayInfo) {
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ App not found.

**Search Results:**
${results.map((r) => `  • ${r}`).join("\n")}

**Things to Check:**
• Verify identifier is correct: \`${identifier}\`
• Verify app is registered in the store
• Verify authentication settings are correct (use auth-check tool)`,
        },
      ],
    };
  }

  // Register app
  try {
    console.error(`[MCP]   💾 Registering app with slug: ${slug}`);
    const newApp = registerApp({
      slug,
      name: appName,
      appStore: appStoreInfo,
      googlePlay: googlePlayInfo,
    });
    console.error(`[MCP]   ✅ App registered successfully`);

    const storeIcons = [
      appStoreInfo ? "🍎" : null,
      googlePlayInfo ? "🤖" : null,
    ]
      .filter(Boolean)
      .join("+");

    const localeInfo: string[] = [];
    if (
      appStoreInfo?.supportedLocales &&
      appStoreInfo.supportedLocales.length > 0
    ) {
      localeInfo.push(
        `• App Store locales: ${appStoreInfo.supportedLocales.join(", ")}`
      );
    }
    if (
      googlePlayInfo?.supportedLocales &&
      googlePlayInfo.supportedLocales.length > 0
    ) {
      localeInfo.push(
        `• Google Play locales: ${googlePlayInfo.supportedLocales.join(", ")}`
      );
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `✅ App registration complete (${storeIcons})

**Registration Info:**
• Slug: \`${newApp.slug}\`
• Name: ${newApp.name}
${appStoreInfo ? `• App Store: ${appStoreInfo.bundleId} (ID: ${appStoreInfo.appId})` : ""}
${googlePlayInfo ? `• Google Play: ${googlePlayInfo.packageName}` : ""}
${localeInfo.length > 0 ? `\n**Supported Languages:**\n${localeInfo.map((l) => `  ${l}`).join("\n")}` : ""}

**Search Results:**
${results.map((r) => `  • ${r}`).join("\n")}

You can now reference this app in other tools using the \`app: "${slug}"\` parameter.`,
        },
      ],
      _meta: { app: newApp },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ App registration failed: ${msg}`,
        },
      ],
    };
  }
}
