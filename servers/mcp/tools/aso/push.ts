import { GooglePlayClient } from "@packages/play-store";
import { AppStoreClient } from "@packages/app-store";
import {
  type StoreType,
  type GooglePlayMultilingualAsoData,
  type AppStoreMultilingualAsoData,
  isGooglePlayMultilingual,
  isAppStoreMultilingual,
  loadAsoData,
  saveAsoData,
  prepareAsoDataForPush,
  convertToMultilingual,
} from "@packages/aso-core";
import { loadConfig, findApp, getDataDir } from "@packages/shared";
import { join } from "node:path";

interface AsoPushOptions {
  app?: string; // Registered app slug
  packageName?: string; // For Google Play
  bundleId?: string; // For App Store
  store?: StoreType;
  uploadImages?: boolean;
  dryRun?: boolean;
}

export async function handleAsoPush(options: AsoPushOptions) {
  const { app, store = "both", uploadImages = false, dryRun = false } = options;
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

  console.log(`\n📤 Pushing ASO data`);
  console.log(`   Store: ${store}`);
  console.log(`   App: ${slug}`);
  if (packageName) console.log(`   Package Name: ${packageName}`);
  if (bundleId) console.log(`   Bundle ID: ${bundleId}`);
  console.log(`   Upload Images: ${uploadImages ? "Yes" : "No"}`);
  console.log(`   Mode: ${dryRun ? "Dry run" : "Actual push"}\n`);

  const config = loadConfig();

  // Load local data from ASO directory
  const asoDir = join(getDataDir(), ".aso", "pushData");
  const configData = loadAsoData(slug, { asoDir });

  if (!configData.googlePlay && !configData.appStore) {
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ No ASO data found for ${slug}. Run aso-pull first.`,
        },
      ],
    };
  }

  // Prepare data for push
  const localAsoData = prepareAsoDataForPush(slug, configData);

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

  if (store === "googlePlay" || store === "both") {
    if (!config.playStore) {
      results.push(
        `⏭️  Skipping Google Play (not configured in secrets/aso-config.json)`
      );
    } else if (!packageName) {
      results.push(`⏭️  Skipping Google Play (no packageName provided)`);
    } else if (!localAsoData.googlePlay) {
      results.push(`⏭️  Skipping Google Play (no data found)`);
    } else {
      try {
        const serviceAccount = JSON.parse(config.playStore.serviceAccountJson);
        const client = new GooglePlayClient({
          packageName,
          serviceAccountKey: serviceAccount,
        });

        const googlePlayData: GooglePlayMultilingualAsoData =
          isGooglePlayMultilingual(localAsoData.googlePlay)
            ? localAsoData.googlePlay
            : convertToMultilingual(
                localAsoData.googlePlay,
                localAsoData.googlePlay.defaultLanguage
              );

        console.log(`📤 Pushing to Google Play...`);
        for (const [language, localeData] of Object.entries(
          googlePlayData.locales
        )) {
          console.log(`   📤 Pushing ${language}...`);
          await client.pushAsoData(localeData);
          console.log(`   ✅ ${language} uploaded`);
        }

        results.push(`✅ Google Play data pushed`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.push(`❌ Google Play push failed: ${msg}`);
        console.error(`❌ Google Play push failed:`, error);
      }
    }
  }

  if (store === "appStore" || store === "both") {
    if (!config.appStore) {
      results.push(
        `⏭️  Skipping App Store (not configured in secrets/aso-config.json)`
      );
    } else if (!bundleId) {
      results.push(`⏭️  Skipping App Store (no bundleId provided)`);
    } else if (!localAsoData.appStore) {
      results.push(`⏭️  Skipping App Store (no data found)`);
    } else {
      try {
        const client = new AppStoreClient({
          bundleId,
          issuerId: config.appStore.issuerId,
          keyId: config.appStore.keyId,
          privateKey: config.appStore.privateKey,
        });

        const appStoreData: AppStoreMultilingualAsoData =
          isAppStoreMultilingual(localAsoData.appStore)
            ? localAsoData.appStore
            : convertToMultilingual(
                localAsoData.appStore,
                localAsoData.appStore.locale
              );

        console.log(`📤 Pushing to App Store...`);
        for (const [locale, localeData] of Object.entries(
          appStoreData.locales
        )) {
          console.log(`   📤 Pushing ${locale}...`);
          await client.pushAsoData(localeData);
          console.log(`   ✅ ${locale} uploaded`);
        }

        results.push(`✅ App Store data pushed`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        // Handle 409 STATE_ERROR - need to create new version with What's New
        if (msg.includes("409 Conflict") && msg.includes("STATE_ERROR")) {
          console.log(`\n🔄 STATE_ERROR detected. New version needed.`);

          // Try to create new version
          try {
            const client = new AppStoreClient({
              bundleId: bundleId!,
              issuerId: config.appStore!.issuerId,
              keyId: config.appStore!.keyId,
              privateKey: config.appStore!.privateKey,
            });

            const newVersion = await client.createNewVersionWithAutoIncrement();
            const versionId = newVersion.id;
            const versionString = newVersion.attributes.versionString;

            const currentAppStoreData: AppStoreMultilingualAsoData =
              isAppStoreMultilingual(localAsoData.appStore!)
                ? localAsoData.appStore!
                : convertToMultilingual(
                    localAsoData.appStore!,
                    localAsoData.appStore!.locale
                  );
            const locales = Object.keys(currentAppStoreData.locales);

            console.log(`✅ New version ${versionString} created.`);

            // Return translation request - guide LLM to translate then call aso-update-whats-new
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
    "ko-KR": "Bug fixes and improvements",
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
          } catch (versionError) {
            const versionMsg =
              versionError instanceof Error
                ? versionError.message
                : String(versionError);
            results.push(
              `❌ App Store: Failed to create new version: ${versionMsg}`
            );
          }
        } else {
          results.push(`❌ App Store push failed: ${msg}`);
        }

        console.error(`❌ App Store push failed:`, error);
      }
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
