/**
 * setup-apps: Query apps from store and auto-register
 */

import { getAppStoreClient } from "@packages/app-store";
import { GooglePlayClient } from "@packages/play-store";
import {
  loadConfig,
  registerApp,
  findApp,
  loadRegisteredApps,
  saveRegisteredApps,
  type RegisteredApp,
} from "@packages/shared";

interface SetupAppsOptions {
  store?: "appStore" | "googlePlay" | "both";
  packageName?: string; // For Google Play - list query not supported, so used for specific app verification
}

/**
 * Check Play Store access
 */
async function checkPlayStoreAccess(
  packageName: string,
  serviceAccountKey: object
): Promise<{ accessible: boolean; title?: string }> {
  try {
    const client = new GooglePlayClient({
      packageName,
      serviceAccountKey,
    });
    const appInfo = await client.verifyAppAccess();
    return { accessible: true, title: appInfo.title };
  } catch {
    return { accessible: false };
  }
}

export async function handleSetupApps(options: SetupAppsOptions) {
  const { store = "both", packageName } = options;
  const config = loadConfig();

  // both: Query App Store apps then check Play Store
  if (store === "both" || store === "appStore") {
    if (!config.appStore) {
      return {
        content: [
          {
            type: "text" as const,
            text: "❌ App Store authentication not configured. Please check secrets/aso-config.json.",
          },
        ],
      };
    }

    try {
      const client = getAppStoreClient({
        ...config.appStore,
        bundleId: "dummy", // listAllApps() does not use bundleId
      });

      const apps = await client.listAllApps({ onlyReleased: true });

      if (apps.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "📱 No apps registered in App Store.",
            },
          ],
        };
      }

      // Prepare Play Store service account
      const playStoreEnabled =
        store === "both" && config.playStore?.serviceAccountJson;
      const serviceAccountKey = playStoreEnabled
        ? JSON.parse(config.playStore!.serviceAccountJson)
        : null;

      // Auto-register
      const registered: string[] = [];
      const skipped: string[] = [];
      const playStoreFound: string[] = [];
      const playStoreNotFound: string[] = [];

      for (const app of apps) {
        // Use only last part of bundleId as slug (com.quartz.postblackbelt -> postblackbelt)
        const parts = app.bundleId.split(".");
        const slug = parts[parts.length - 1].toLowerCase();

        // Check if already registered (findApp searches by slug, bundleId, packageName)
        const existing = findApp(app.bundleId);
        if (existing) {
          // If existing app and both mode, try to update Play Store info
          if (playStoreEnabled && !existing.googlePlay) {
            const playResult = await checkPlayStoreAccess(
              app.bundleId,
              serviceAccountKey
            );
            if (playResult.accessible) {
              // Add googlePlay info to existing app
              const appsConfig = loadRegisteredApps();
              const appIndex = appsConfig.apps.findIndex(
                (a) => a.slug === existing.slug
              );
              if (appIndex >= 0) {
                appsConfig.apps[appIndex].googlePlay = {
                  packageName: app.bundleId,
                  name: playResult.title,
                };
                saveRegisteredApps(appsConfig);
                playStoreFound.push(`${app.name} → Play Store info added`);
              }
            } else {
              playStoreNotFound.push(app.name);
            }
          }
          skipped.push(`${app.name} (${app.bundleId}) - already registered`);
          continue;
        }

        // Check Play Store (when in both mode)
        let googlePlayInfo: RegisteredApp["googlePlay"] = undefined;
        if (playStoreEnabled) {
          const playResult = await checkPlayStoreAccess(
            app.bundleId,
            serviceAccountKey
          );
          if (playResult.accessible) {
            googlePlayInfo = {
              packageName: app.bundleId,
              name: playResult.title,
            };
            playStoreFound.push(app.name);
          } else {
            playStoreNotFound.push(app.name);
          }
        }

        try {
          registerApp({
            slug,
            name: app.name,
            appStore: {
              bundleId: app.bundleId,
              appId: app.id,
              name: app.name,
            },
            googlePlay: googlePlayInfo,
          });

          const storeInfo = googlePlayInfo ? " (🍎+🤖)" : " (🍎)";
          registered.push(`${app.name}${storeInfo} → slug: "${slug}"`);
        } catch (error) {
          skipped.push(`${app.name} (${app.bundleId}) - registration failed`);
        }
      }

      const lines = [`📱 **App Setup Complete**\n`];

      if (registered.length > 0) {
        lines.push(`✅ **Registered** (${registered.length}):`);
        for (const r of registered) {
          lines.push(`  • ${r}`);
        }
        lines.push("");
      }

      if (skipped.length > 0) {
        lines.push(`⏭️ **Skipped** (${skipped.length}):`);
        for (const s of skipped) {
          lines.push(`  • ${s}`);
        }
        lines.push("");
      }

      if (playStoreEnabled) {
        lines.push(`**Play Store Check Results:**`);
        lines.push(`  🤖 Found: ${playStoreFound.length}`);
        if (playStoreFound.length > 0) {
          for (const name of playStoreFound) {
            lines.push(`    • ${name}`);
          }
        }
        lines.push(`  ❌ Not found: ${playStoreNotFound.length}`);
        if (playStoreNotFound.length > 0) {
          for (const name of playStoreNotFound) {
            lines.push(`    • ${name}`);
          }
        }
        lines.push("");
      }

      lines.push(
        "You can now reference apps in other tools using the `app: \"slug\"` parameter."
      );

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        _meta: {
          registered: registered.length,
          skipped: skipped.length,
          playStoreFound: playStoreFound.length,
          playStoreNotFound: playStoreNotFound.length,
          apps,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to query App Store apps: ${msg}`,
          },
        ],
      };
    }
  }

  if (store === "googlePlay") {
    if (!config.playStore) {
      return {
        content: [
          {
            type: "text" as const,
            text: "❌ Google Play authentication not configured. Please check secrets/aso-config.json.",
          },
        ],
      };
    }

    if (!packageName) {
      return {
        content: [
          {
            type: "text" as const,
            text: `⚠️ Google Play API does not support listing apps.

Provide packageName to verify and register that app:
\`\`\`json
{ "store": "googlePlay", "packageName": "com.example.app" }
\`\`\``,
          },
        ],
      };
    }

    try {
      const serviceAccount = JSON.parse(config.playStore.serviceAccountJson);
      const client = new GooglePlayClient({
        packageName,
        serviceAccountKey: serviceAccount,
      });

      const appInfo = await client.verifyAppAccess();

      // Use only last part of packageName as slug (com.quartz.postblackbelt -> postblackbelt)
      const parts = packageName.split(".");
      const slug = parts[parts.length - 1].toLowerCase();

      // Check if already registered (findApp searches by slug, bundleId, packageName)
      const existing = findApp(packageName);
      if (existing) {
        return {
          content: [
            {
              type: "text" as const,
              text: `⏭️ App is already registered: "${existing.slug}"`,
            },
          ],
          _meta: { app: existing },
        };
      }

      // Register
      const newApp = registerApp({
        slug,
        name: appInfo.title || packageName,
        googlePlay: {
          packageName,
          name: appInfo.title,
        },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Google Play app registration complete

• Package Name: \`${packageName}\`
• Slug: \`${slug}\`
• Name: ${newApp.name}

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
            text: `❌ Failed to access Google Play app: ${msg}`,
          },
        ],
      };
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: "❌ store parameter must be 'appStore', 'googlePlay', or 'both'.",
      },
    ],
  };
}
