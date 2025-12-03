/**
 * setup-apps: Query apps from store and auto-register
 */

import { loadConfig } from "@/packages/configs/secrets-config/config";
import {
  registerApp,
  findApp,
  loadRegisteredApps,
  saveRegisteredApps,
  type RegisteredApp,
} from "@/packages/configs/secrets-config/registered-apps";
import {
  toRegisteredAppStoreInfo,
  toRegisteredGooglePlayInfo,
} from "@servers/mcp/core/helpers/registration";
import { AppStoreService } from "@servers/mcp/core/services/app-store-service";
import { GooglePlayService } from "@servers/mcp/core/services/google-play-service";

const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();

interface SetupAppsOptions {
  store?: "appStore" | "googlePlay" | "both";
  packageName?: string; // For Google Play - list query not supported, so used for specific app verification
}

/**
 * Check Play Store access (기존 호환성을 위한 래퍼)
 */
async function checkPlayStoreAccess(packageName: string): Promise<{
  accessible: boolean;
  title?: string;
  supportedLocales?: string[];
}> {
  const appInfo = await googlePlayService.fetchAppInfo(packageName);
  if (!appInfo.found) {
    return { accessible: false };
  }

  return {
    accessible: true,
    title: appInfo.name,
    supportedLocales: appInfo.supportedLocales,
  };
}

export async function handleSetupApps(options: SetupAppsOptions) {
  const { store = "both", packageName } = options;
  const config = loadConfig();

  console.error(`[MCP] 📱 Initializing apps (store: ${store})`);

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

    const clientResult = appStoreService.createClient("dummy"); // listAllApps() does not use bundleId

    if (!clientResult.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to create App Store client: ${clientResult.error}`,
          },
        ],
      };
    }

    try {
      console.error(`[MCP]   📋 Fetching app list from App Store...`);
      const apps = await clientResult.data.listAllApps({
        onlyReleased: true,
      });
      console.error(`[MCP]   ✅ Found ${apps.length} apps`);

      // 모든 앱의 언어 정보를 미리 가져오기 위한 클라이언트 인스턴스
      const appInfoClientResult = appStoreService.createClient("dummy");

      if (!appInfoClientResult.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `❌ Failed to create App Store info client: ${appInfoClientResult.error}`,
            },
          ],
        };
      }

      const appInfoClient = appInfoClientResult.data;

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
        store === "both" && !!config.playStore?.serviceAccountJson;

      // Auto-register
      const registered: Array<{
        name: string;
        slug: string;
        appStoreLocales?: string[];
        googlePlayLocales?: string[];
      }> = [];
      const skipped: string[] = [];
      const playStoreFound: string[] = [];
      const playStoreNotFound: string[] = [];

      for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        // Use only last part of bundleId as slug (com.quartz.postblackbelt -> postblackbelt)
        const parts = app.bundleId.split(".");
        const slug = parts[parts.length - 1].toLowerCase();

        console.error(
          `[MCP]   [${i + 1}/${apps.length}] Processing: ${app.name} (${
            app.bundleId
          })`
        );

        // Check if already registered (findApp searches by slug, bundleId, packageName)
        const existing = findApp(app.bundleId);
        if (existing) {
          // Update language info for existing apps
          const appsConfig = loadRegisteredApps();
          const appIndex = appsConfig.apps.findIndex(
            (a) => a.slug === existing.slug
          );

          if (appIndex >= 0) {
            let updated = false;

            // Update App Store language info
            if (existing.appStore) {
              const appStoreInfo = await appStoreService.fetchAppInfo(
                app.bundleId,
                appInfoClient
              );

              if (appStoreInfo.found && appStoreInfo.supportedLocales) {
                if (!appsConfig.apps[appIndex].appStore) {
                  appsConfig.apps[appIndex].appStore = {
                    bundleId: app.bundleId,
                    appId: app.id,
                    name: app.name,
                  };
                }
                appsConfig.apps[appIndex].appStore!.supportedLocales =
                  appStoreInfo.supportedLocales;
                updated = true;
              }
            }

            // Update Google Play info (when in both mode)
            if (playStoreEnabled) {
              const playResult = await checkPlayStoreAccess(app.bundleId);
              if (playResult.accessible) {
                if (!appsConfig.apps[appIndex].googlePlay) {
                  appsConfig.apps[appIndex].googlePlay = {
                    packageName: app.bundleId,
                    name: playResult.title,
                  };
                }
                appsConfig.apps[appIndex].googlePlay!.supportedLocales =
                  playResult.supportedLocales;
                appsConfig.apps[appIndex].googlePlay!.name = playResult.title;
                updated = true;
                playStoreFound.push(app.name);
              } else {
                playStoreNotFound.push(app.name);
              }
            }

            if (updated) {
              saveRegisteredApps(appsConfig);
              skipped.push(
                `${app.name} (${app.bundleId}) - language info updated`
              );
            } else {
              skipped.push(
                `${app.name} (${app.bundleId}) - already registered`
              );
            }
          } else {
            skipped.push(`${app.name} (${app.bundleId}) - already registered`);
          }
          continue;
        }

        // App Store 정보 가져오기 (언어 정보 포함)
        const appStoreInfo = await appStoreService.fetchAppInfo(
          app.bundleId,
          appInfoClient
        );

        // Check Play Store (when in both mode)
        let googlePlayInfo: RegisteredApp["googlePlay"] = undefined;
        if (playStoreEnabled) {
          const playResult = await checkPlayStoreAccess(app.bundleId);
          if (playResult.accessible) {
            googlePlayInfo = {
              packageName: app.bundleId,
              name: playResult.title,
              supportedLocales: playResult.supportedLocales,
            };
            playStoreFound.push(app.name);
          } else {
            playStoreNotFound.push(app.name);
          }
        }

        try {
          const registeredAppStoreInfo = toRegisteredAppStoreInfo({
            bundleId: app.bundleId,
            appInfo: appStoreInfo,
          }) || {
            bundleId: app.bundleId,
            appId: app.id,
            name: app.name,
          };

          registerApp({
            slug,
            name: app.name,
            appStore: registeredAppStoreInfo,
            googlePlay: googlePlayInfo,
          });

          console.error(`[MCP]     ✅ Registered: ${slug}`);
          registered.push({
            name: app.name,
            slug,
            appStoreLocales: registeredAppStoreInfo.supportedLocales,
            googlePlayLocales: googlePlayInfo?.supportedLocales,
          });
        } catch (error) {
          skipped.push(`${app.name} (${app.bundleId}) - registration failed`);
        }
      }

      const lines = [`📱 **App Setup Complete**\n`];

      if (registered.length > 0) {
        lines.push(`✅ **Registered** (${registered.length}):`);
        for (const r of registered) {
          const storeInfo = r.googlePlayLocales ? " (🍎+🤖)" : " (🍎)";
          let localeInfo = "";
          if (r.appStoreLocales && r.appStoreLocales.length > 0) {
            localeInfo += `\n    🍎 App Store: ${r.appStoreLocales.join(", ")}`;
          }
          if (r.googlePlayLocales && r.googlePlayLocales.length > 0) {
            localeInfo += `\n    🤖 Google Play: ${r.googlePlayLocales.join(
              ", "
            )}`;
          }
          lines.push(
            `  • ${r.name}${storeInfo} → slug: "${r.slug}"${localeInfo}`
          );
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
        'You can now reference apps in other tools using the `app: "slug"` parameter.'
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
    console.error(
      `[MCP]   📋 Processing Google Play app: ${packageName || "N/A"}`
    );
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
      // Google Play 정보 가져오기 (언어 정보 포함)
      console.error(`[MCP]   🔍 Fetching Google Play app info...`);
      const googlePlayInfo = await googlePlayService.fetchAppInfo(packageName);

      if (!googlePlayInfo.found) {
        throw new Error("Failed to access Google Play app");
      }

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
      const registeredGooglePlayInfo = toRegisteredGooglePlayInfo({
        packageName,
        appInfo: googlePlayInfo,
      });

      console.error(`[MCP]   💾 Registering app with slug: ${slug}`);
      const newApp = registerApp({
        slug,
        name: googlePlayInfo.name || packageName,
        googlePlay: registeredGooglePlayInfo,
      });
      console.error(`[MCP]   ✅ App registered successfully`);

      const localeInfo =
        registeredGooglePlayInfo?.supportedLocales &&
        registeredGooglePlayInfo.supportedLocales.length > 0
          ? `\n• Supported Languages: ${registeredGooglePlayInfo.supportedLocales.join(
              ", "
            )}`
          : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Google Play app registration complete

• Package Name: \`${packageName}\`
• Slug: \`${slug}\`
• Name: ${newApp.name}${localeInfo}

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
