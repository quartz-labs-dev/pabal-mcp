/**
 * add-app: Register app by bundleId or packageName
 */

import { getAppStoreClient } from "@packages/app-store";
import { GooglePlayClient } from "@packages/play-store";
import {
  loadConfig,
  registerApp,
  findApp,
  type RegisteredApp,
} from "@packages/shared";

interface AddAppOptions {
  /** App identifier (bundleId or packageName) */
  identifier: string;
  /** Custom slug (if not specified, uses last part of identifier) */
  slug?: string;
  /** Target store (default: both - check both stores) */
  store?: "appStore" | "googlePlay" | "both";
}

/**
 * Fetch app information from App Store
 */
async function fetchAppStoreInfo(
  bundleId: string,
  config: ReturnType<typeof loadConfig>
): Promise<{ found: boolean; appId?: string; name?: string }> {
  if (!config.appStore) {
    return { found: false };
  }

  try {
    const client = getAppStoreClient({
      ...config.appStore,
      bundleId: "dummy",
    });

    const apps = await client.listAllApps({ onlyReleased: true });
    const app = apps.find((a) => a.bundleId === bundleId);

    if (app) {
      return { found: true, appId: app.id, name: app.name };
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

/**
 * Fetch app information from Google Play
 */
async function fetchGooglePlayInfo(
  packageName: string,
  config: ReturnType<typeof loadConfig>
): Promise<{ found: boolean; name?: string }> {
  if (!config.playStore?.serviceAccountJson) {
    return { found: false };
  }

  try {
    const serviceAccount = JSON.parse(config.playStore.serviceAccountJson);
    const client = new GooglePlayClient({
      packageName,
      serviceAccountKey: serviceAccount,
    });

    const appInfo = await client.verifyAppAccess();
    return { found: true, name: appInfo.title };
  } catch {
    return { found: false };
  }
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

  // Check if already registered
  const existing = findApp(identifier);
  if (existing) {
    return {
      content: [
        {
          type: "text" as const,
          text: `⏭️ App is already registered.

• Slug: \`${existing.slug}\`
• Name: ${existing.name}
• App Store: ${existing.appStore ? `✅ ${existing.appStore.bundleId}` : "❌"}
• Google Play: ${existing.googlePlay ? `✅ ${existing.googlePlay.packageName}` : "❌"}`,
        },
      ],
      _meta: { app: existing },
    };
  }

  const config = loadConfig();
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

  // Fetch app information by store
  let appStoreInfo: RegisteredApp["appStore"] = undefined;
  let googlePlayInfo: RegisteredApp["googlePlay"] = undefined;
  let appName = identifier;

  const results: string[] = [];

  // Check App Store
  if (store === "both" || store === "appStore") {
    const asResult = await fetchAppStoreInfo(identifier, config);
    if (asResult.found) {
      appStoreInfo = {
        bundleId: identifier,
        appId: asResult.appId,
        name: asResult.name,
      };
      appName = asResult.name || appName;
      results.push(`🍎 App Store: ✅ Found (${asResult.name})`);
    } else {
      results.push(`🍎 App Store: ❌ Not found`);
    }
  }

  // Check Google Play
  if (store === "both" || store === "googlePlay") {
    const gpResult = await fetchGooglePlayInfo(identifier, config);
    if (gpResult.found) {
      googlePlayInfo = {
        packageName: identifier,
        name: gpResult.name,
      };
      appName = gpResult.name || appName;
      results.push(`🤖 Google Play: ✅ Found (${gpResult.name})`);
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
    const newApp = registerApp({
      slug,
      name: appName,
      appStore: appStoreInfo,
      googlePlay: googlePlayInfo,
    });

    const storeIcons = [
      appStoreInfo ? "🍎" : null,
      googlePlayInfo ? "🤖" : null,
    ]
      .filter(Boolean)
      .join("+");

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
