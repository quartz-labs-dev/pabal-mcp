import type {
  StoreType,
  GooglePlayReleaseNote,
  AppStoreReleaseNote,
} from "@/packages/configs/aso-config/types";
import {
  ensureDir,
  getAsoPullDir,
  getPullProductAsoDir,
  getStoreDir,
  getReleaseNotesPath,
} from "@/packages/configs/aso-config/utils";
import { getStoreTargets } from "@/packages/configs/aso-config/store";
import { loadConfig } from "@/packages/configs/secrets-config/config";
import {
  AppResolutionService,
  AppStoreService,
  GooglePlayService,
} from "@servers/mcp/core/services";
import { writeFileSync } from "node:fs";

const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();
const appResolutionService = new AppResolutionService();

interface AsoPullReleaseNotesOptions {
  app?: string; // Registered app slug
  packageName?: string; // For Google Play
  bundleId?: string; // For App Store
  store?: StoreType;
  dryRun?: boolean;
}

export async function handleAsoPullReleaseNotes(
  options: AsoPullReleaseNotesOptions
) {
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

  console.error(`[MCP] 📥 Pulling release notes`);
  console.error(`[MCP]   Store: ${targetStore}`);
  console.error(`[MCP]   App: ${slug}`);
  if (packageName) console.error(`[MCP]   Package Name: ${packageName}`);
  if (bundleId) console.error(`[MCP]   Bundle ID: ${bundleId}`);
  console.error(`[MCP]   Mode: ${dryRun ? "Dry run" : "Actual fetch"}`);

  const config = loadConfig();

  const releaseNotes: {
    googlePlay?: GooglePlayReleaseNote[];
    appStore?: AppStoreReleaseNote[];
  } = {};

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
      const notesResult = await googlePlayService.pullReleaseNotes(packageName);
      if (!notesResult.success) {
        console.error(
          `[MCP]   ❌ Failed to fetch Google Play release notes: ${notesResult.error}`
        );
      } else {
        releaseNotes.googlePlay = notesResult.data;
        console.error(`[MCP]   📊 Google Play Release Notes:`);
        console.error(`[MCP]     Total versions: ${notesResult.data.length}`);
        for (const rn of notesResult.data) {
          const code = (rn as any).versionCode ?? "N/A";
          console.error(
            `[MCP]     Version ${rn.versionName} (${code}): ${
              Object.keys(rn.releaseNotes).length
            } languages`
          );
        }
        console.error(`[MCP]   ✅ Google Play release notes fetched`);
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
      const notesResult = await appStoreService.pullReleaseNotes(bundleId);
      if (!notesResult.success) {
        console.error(
          `[MCP]   ❌ Failed to fetch App Store release notes: ${notesResult.error}`
        );
      } else {
        releaseNotes.appStore = notesResult.data;

        console.error(`[MCP]   📊 App Store Release Notes:`);
        console.error(`[MCP]     Total versions: ${notesResult.data.length}`);
        for (const rn of notesResult.data) {
          console.error(
            `[MCP]     Version ${rn.versionString}: ${
              Object.keys(rn.releaseNotes).length
            } locales`
          );
        }
        console.error(`[MCP]   ✅ App Store release notes fetched`);
      }
    }
  }

  if (dryRun) {
    return {
      content: [
        {
          type: "text" as const,
          text: `📋 Dry run - Release notes:\n${JSON.stringify(
            releaseNotes,
            null,
            2
          )}`,
        },
      ],
    };
  }

  // Save to ASO directory
  const asoDir = getPullProductAsoDir(slug, getAsoPullDir());

  if (releaseNotes.googlePlay) {
    const googlePlayDir = getStoreDir(asoDir, "google-play");
    ensureDir(googlePlayDir);
    const filePath = getReleaseNotesPath(googlePlayDir);
    writeFileSync(filePath, JSON.stringify(releaseNotes.googlePlay, null, 2));
    console.error(`[MCP]   💾 Google Play release notes saved to ${filePath}`);
  }

  if (releaseNotes.appStore) {
    const appStoreDir = getStoreDir(asoDir, "app-store");
    ensureDir(appStoreDir);
    const filePath = getReleaseNotesPath(appStoreDir);
    writeFileSync(filePath, JSON.stringify(releaseNotes.appStore, null, 2));
    console.error(`[MCP]   💾 App Store release notes saved to ${filePath}`);
  }

  return {
    content: [
      {
        type: "text" as const,
        text:
          `✅ Release notes pulled\n` +
          `   Google Play: ${
            releaseNotes.googlePlay
              ? `${releaseNotes.googlePlay.length} versions`
              : "✗"
          }\n` +
          `   App Store: ${
            releaseNotes.appStore
              ? `${releaseNotes.appStore.length} versions`
              : "✗"
          }`,
      },
    ],
  };
}
