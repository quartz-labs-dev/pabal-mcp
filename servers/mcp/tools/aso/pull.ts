import type { AsoData, StoreType } from "@/packages/configs/aso-config/types";
import {
  isGooglePlayMultilingual,
  isAppStoreMultilingual,
  saveAsoData,
  downloadImage,
  copyLocalAssetToAso,
  isLocalAssetPath,
  resolveAppStoreImageUrl,
  convertToMultilingual,
  getAsoPullDir,
  getPullProductAsoDir,
  getScreenshotDir,
  getScreenshotFilePath,
} from "@/packages/configs/aso-config/utils";
import { getStoreTargets } from "@/packages/configs/aso-config/store";
import { loadConfig } from "@/packages/configs/secrets-config/config";
import { updateAppSupportedLocales } from "@/packages/configs/secrets-config/registered-apps";
import { AppStoreService } from "@servers/mcp/core/services/app-store-service";
import { GooglePlayService } from "@servers/mcp/core/services/google-play-service";
import { AppResolutionService } from "@servers/mcp/core/services/app-resolution-service";

const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();
const appResolutionService = new AppResolutionService();

interface AsoPullOptions {
  app?: string; // Registered app slug
  packageName?: string; // For Google Play
  bundleId?: string; // For App Store
  store?: StoreType;
  dryRun?: boolean;
}

async function downloadScreenshotsToAso(
  slug: string,
  asoData: AsoData,
  asoDir: string
): Promise<void> {
  const productStoreRoot = getPullProductAsoDir(slug, asoDir);

  if (asoData.googlePlay) {
    const googlePlayData = isGooglePlayMultilingual(asoData.googlePlay)
      ? asoData.googlePlay
      : convertToMultilingual(
          asoData.googlePlay,
          asoData.googlePlay.defaultLanguage
        );

    const languages = Object.keys(googlePlayData.locales);
    const defaultLanguage = googlePlayData.defaultLocale;
    const targetLanguage =
      (defaultLanguage && googlePlayData.locales[defaultLanguage]
        ? defaultLanguage
        : languages[0]) || null;

    if (targetLanguage) {
      const localeData = googlePlayData.locales[targetLanguage];
      const screenshotDir = getScreenshotDir(
        productStoreRoot,
        "google-play",
        targetLanguage
      );

      if (localeData.screenshots.phone?.length > 0) {
        console.error(
          `[MCP]   📥 Downloading ${localeData.screenshots.phone.length} Google Play phone screenshots...`
        );
        for (let i = 0; i < localeData.screenshots.phone.length; i++) {
          const url = localeData.screenshots.phone[i];
          const outputPath = getScreenshotFilePath(
            screenshotDir,
            `phone-${i + 1}.png`
          );
          if (isLocalAssetPath(url)) {
            copyLocalAssetToAso(url, outputPath);
          } else {
            await downloadImage(url, outputPath);
          }
          console.error(`[MCP]     ✅ phone-${i + 1}.png`);
        }
      }

      if (localeData.featureGraphic) {
        console.error(`[MCP]   📥 Downloading Feature Graphic...`);
        const outputPath = getScreenshotFilePath(
          screenshotDir,
          "feature-graphic.png"
        );
        if (isLocalAssetPath(localeData.featureGraphic)) {
          copyLocalAssetToAso(localeData.featureGraphic, outputPath);
        } else {
          await downloadImage(localeData.featureGraphic, outputPath);
        }
        console.error(`[MCP]     ✅ feature-graphic.png`);
      }
    }
  }

  if (asoData.appStore) {
    const appStoreData = isAppStoreMultilingual(asoData.appStore)
      ? asoData.appStore
      : convertToMultilingual(asoData.appStore, asoData.appStore.locale);

    const locales = Object.keys(appStoreData.locales);
    const defaultLocale = appStoreData.defaultLocale;
    const targetLocale =
      (defaultLocale && appStoreData.locales[defaultLocale]
        ? defaultLocale
        : locales[0]) || null;

    if (targetLocale) {
      const localeData = appStoreData.locales[targetLocale];
      const screenshotDir = getScreenshotDir(
        productStoreRoot,
        "app-store",
        targetLocale
      );

      const screenshotTypes = ["iphone65", "iphone61", "ipadPro129"] as const;

      for (const type of screenshotTypes) {
        const screenshots = localeData.screenshots[type];
        if (screenshots && screenshots.length > 0) {
          console.error(
            `[MCP]   📥 Downloading ${screenshots.length} App Store ${type} screenshots...`
          );
          for (let i = 0; i < screenshots.length; i++) {
            let url = screenshots[i];
            const outputPath = getScreenshotFilePath(
              screenshotDir,
              `${type}-${i + 1}.png`
            );

            if (isLocalAssetPath(url)) {
              copyLocalAssetToAso(url, outputPath);
            } else {
              if (url.includes("{w}") || url.includes("{h}")) {
                url = resolveAppStoreImageUrl(url);
              }
              await downloadImage(url, outputPath);
            }
            console.error(`[MCP]     ✅ ${type}-${i + 1}.png`);
          }
        }
      }
    }
  }
}

export async function handleAsoPull(options: AsoPullOptions) {
  const { app, store, dryRun = false } = options;
  let { packageName, bundleId } = options;
  const {
    store: targetStore,
    includeAppStore,
    includeGooglePlay,
  } = getStoreTargets(store);

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

  console.error(`[MCP] 📥 Pulling ASO data`);
  console.error(`[MCP]   Store: ${targetStore}`);
  console.error(`[MCP]   App: ${slug}`);
  if (packageName) console.error(`[MCP]   Package Name: ${packageName}`);
  if (bundleId) console.error(`[MCP]   Bundle ID: ${bundleId}`);
  console.error(`[MCP]   Mode: ${dryRun ? "Dry run" : "Actual fetch"}`);

  const config = loadConfig();
  const syncedData: AsoData = {};
  const pullDir = getAsoPullDir();

  if (includeGooglePlay) {
    if (!hasGooglePlay) {
      console.error(
        `[MCP]   ⏭️  Skipping Google Play (not registered for Google Play)`
      );
    } else if (!config.playStore) {
      console.error(
        `[MCP]   ⏭️  Skipping Google Play (not configured in secrets/aso-config.json)`
      );
    } else if (!packageName) {
      console.error(
        `[MCP]   ⏭️  Skipping Google Play (no packageName provided)`
      );
    } else {
      const clientResult = googlePlayService.createClient(packageName);

      if (!clientResult.success) {
        console.error(
          `[MCP]   ❌ Failed to create Google Play client: ${clientResult.error}`
        );
      } else {
        try {
          console.error(`[MCP]   📥 Fetching from Google Play...`);
          const data = await clientResult.data.pullAllLanguagesAsoData();
          syncedData.googlePlay = data;
          console.error(`[MCP]   ✅ Google Play data fetched`);

          // Update registered-apps.json with pulled locales
          if (data.locales && Object.keys(data.locales).length > 0) {
            const locales = Object.keys(data.locales);
            const updated = updateAppSupportedLocales({
              identifier: packageName,
              store: "googlePlay",
              locales,
            });
            if (updated) {
              console.error(
                `[MCP]   ✅ Updated registered-apps.json with ${locales.length} Google Play locales`
              );
            }
          }
        } catch (error) {
          console.error(`[MCP]   ❌ Google Play fetch failed:`, error);
        }
      }
    }
  }

  if (includeAppStore) {
    if (!hasAppStore) {
      console.error(
        `[MCP]   ⏭️  Skipping App Store (not registered for App Store)`
      );
    } else if (!config.appStore) {
      console.error(
        `[MCP]   ⏭️  Skipping App Store (not configured in secrets/aso-config.json)`
      );
    } else if (!bundleId) {
      console.error(`[MCP]   ⏭️  Skipping App Store (no bundleId provided)`);
    } else {
      const clientResult = appStoreService.createClient(bundleId);

      if (!clientResult.success) {
        console.error(
          `[MCP]   ❌ Failed to create App Store client: ${clientResult.error}`
        );
      } else {
        try {
          console.error(`[MCP]   📥 Fetching from App Store...`);
          const data = await clientResult.data.pullAllLocalesAsoData();
          syncedData.appStore = data;
          console.error(`[MCP]   ✅ App Store data fetched`);

          // Update registered-apps.json with pulled locales
          if (data.locales && Object.keys(data.locales).length > 0) {
            const locales = Object.keys(data.locales);
            const updated = updateAppSupportedLocales({
              identifier: bundleId,
              store: "appStore",
              locales,
            });
            if (updated) {
              console.error(
                `[MCP]   ✅ Updated registered-apps.json with ${locales.length} App Store locales`
              );
            }
          }
        } catch (error) {
          console.error(`[MCP]   ❌ App Store fetch failed:`, error);
        }
      }
    }
  }

  if (dryRun) {
    return {
      content: [
        {
          type: "text" as const,
          text: `📋 Dry run - Data that would be saved:\n${JSON.stringify(
            syncedData,
            null,
            2
          )}`,
        },
      ],
    };
  }

  saveAsoData(slug, syncedData, { asoDir: pullDir });
  await downloadScreenshotsToAso(slug, syncedData, pullDir);

  return {
    content: [
      {
        type: "text" as const,
        text:
          `✅ ASO data pulled\n` +
          `   Google Play: ${syncedData.googlePlay ? "✓" : "✗"}\n` +
          `   App Store: ${syncedData.appStore ? "✓" : "✗"}`,
      },
    ],
  };
}
