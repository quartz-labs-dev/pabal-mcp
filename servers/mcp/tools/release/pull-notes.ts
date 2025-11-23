import { GooglePlayClient } from "@packages/play-store";
import { AppStoreClient } from "@packages/app-store";
import {
  type StoreType,
  type GooglePlayReleaseNote,
  type AppStoreReleaseNote,
  ensureDir,
  getAsoDir,
} from "@packages/aso-core";
import { loadConfig, findApp } from "@packages/shared";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

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
  const { app, store = "both", dryRun = false } = options;
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

  console.log(`\n📥 Pulling release notes`);
  console.log(`   Store: ${store}`);
  console.log(`   App: ${slug}`);
  if (packageName) console.log(`   Package Name: ${packageName}`);
  if (bundleId) console.log(`   Bundle ID: ${bundleId}`);
  console.log(`   Mode: ${dryRun ? "Dry run" : "Actual fetch"}\n`);

  const config = loadConfig();

  const releaseNotes: {
    googlePlay?: GooglePlayReleaseNote[];
    appStore?: AppStoreReleaseNote[];
  } = {};

  if (store === "googlePlay" || store === "both") {
    if (!config.playStore) {
      console.log(
        `⏭️  Skipping Google Play (not configured in secrets/aso-config.json)`
      );
    } else if (!packageName) {
      console.log(`⏭️  Skipping Google Play (no packageName provided)`);
    } else {
      try {
        const serviceAccount = JSON.parse(config.playStore.serviceAccountJson);
        const client = new GooglePlayClient({
          packageName,
          serviceAccountKey: serviceAccount,
        });

        console.log(`📥 Fetching release notes from Google Play...`);
        const notes = await client.pullProductionReleaseNotes();
        releaseNotes.googlePlay = notes;

        console.log(`\n📊 Google Play Release Notes:`);
        console.log(`   Total versions: ${notes.length}`);
        for (const rn of notes) {
          console.log(
            `   Version ${rn.versionName} (${rn.versionCode}): ${
              Object.keys(rn.releaseNotes).length
            } languages`
          );
        }
        console.log(`✅ Google Play release notes fetched`);
      } catch (error) {
        console.error(`❌ Google Play fetch failed:`, error);
      }
    }
  }

  if (store === "appStore" || store === "both") {
    if (!config.appStore) {
      console.log(
        `⏭️  Skipping App Store (not configured in secrets/aso-config.json)`
      );
    } else if (!bundleId) {
      console.log(`⏭️  Skipping App Store (no bundleId provided)`);
    } else {
      try {
        const client = new AppStoreClient({
          bundleId,
          issuerId: config.appStore.issuerId,
          keyId: config.appStore.keyId,
          privateKey: config.appStore.privateKey,
        });

        console.log(`📥 Fetching release notes from App Store...`);
        const notes = await client.pullReleaseNotes();
        releaseNotes.appStore = notes;

        console.log(`\n📊 App Store Release Notes:`);
        console.log(`   Total versions: ${notes.length}`);
        for (const rn of notes) {
          console.log(
            `   Version ${rn.versionString}: ${
              Object.keys(rn.releaseNotes).length
            } locales`
          );
        }
        console.log(`✅ App Store release notes fetched`);
      } catch (error) {
        console.error(`❌ App Store fetch failed:`, error);
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
  const asoDir = join(getAsoDir(), "pullData", "products", slug, "store");

  if (releaseNotes.googlePlay) {
    const googlePlayDir = join(asoDir, "google-play");
    ensureDir(googlePlayDir);
    const filePath = join(googlePlayDir, "release-notes.json");
    writeFileSync(filePath, JSON.stringify(releaseNotes.googlePlay, null, 2));
    console.log(`💾 Google Play release notes saved to ${filePath}`);
  }

  if (releaseNotes.appStore) {
    const appStoreDir = join(asoDir, "app-store");
    ensureDir(appStoreDir);
    const filePath = join(appStoreDir, "release-notes.json");
    writeFileSync(filePath, JSON.stringify(releaseNotes.appStore, null, 2));
    console.log(`💾 App Store release notes saved to ${filePath}`);
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
