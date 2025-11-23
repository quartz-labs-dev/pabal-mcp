/**
 * Release notes update tool
 *
 * Supports both App Store and Google Play.
 */

import { type StoreType } from "@packages/shared/types";

interface UpdateNotesOptions {
  app?: string;
  bundleId?: string;
  packageName?: string;
  store?: StoreType;
  versionId?: string;
  whatsNew: Record<string, string>;
}

export async function handleUpdateNotes(options: UpdateNotesOptions) {
  const { app, versionId, whatsNew, store = "both" } = options;
  let { bundleId, packageName } = options;

  const { findApp, loadConfig } = await import("@packages/shared");

  // Determine slug
  let slug: string;
  let registeredApp = app ? findApp(app) : undefined;

  if (app && registeredApp) {
    // Successfully retrieved app info by app slug
    slug = app;
    if (!bundleId && registeredApp.appStore) {
      bundleId = registeredApp.appStore.bundleId;
    }
    if (!packageName && registeredApp.googlePlay) {
      packageName = registeredApp.googlePlay.packageName;
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
    if (!bundleId && registeredApp.appStore) {
      bundleId = registeredApp.appStore.bundleId;
    }
    if (!packageName && registeredApp.googlePlay) {
      packageName = registeredApp.googlePlay.packageName;
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

  if (!whatsNew || Object.keys(whatsNew).length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: '❌ whatsNew data is required. Format: { "en-US": "text", "ko": "text" }',
        },
      ],
    };
  }

  const config = loadConfig();

  console.log(`\n📝 Updating release notes`);
  console.log(`   Store: ${store}`);
  console.log(`   App: ${slug}`);
  if (packageName) console.log(`   Package Name: ${packageName}`);
  if (bundleId) console.log(`   Bundle ID: ${bundleId}`);
  if (versionId) console.log(`   Version ID: ${versionId}`);
  console.log();

  const results: string[] = [];
  const appStoreResults: string[] = [];
  const googlePlayResults: string[] = [];

  // App Store update
  if ((store === "both" || store === "appStore") && bundleId) {
    if (!config.appStore) {
      appStoreResults.push("❌ App Store authentication not configured.");
    } else {
      try {
        const { AppStoreClient } = await import("@packages/app-store");
        const client = new AppStoreClient({
          bundleId,
          issuerId: config.appStore.issuerId,
          keyId: config.appStore.keyId,
          privateKey: config.appStore.privateKey,
        });

        let targetVersionId = versionId;
        if (!targetVersionId) {
          const versions = await client.getAllVersions();
          const editableVersion = versions.find(
            (v) => v.attributes.appStoreState === "PREPARE_FOR_SUBMISSION"
          );
          if (!editableVersion) {
            appStoreResults.push("❌ No editable version found.");
          } else {
            targetVersionId = editableVersion.id;
          }
        }

        if (targetVersionId) {
          for (const [locale, text] of Object.entries(whatsNew)) {
            try {
              await client.updateWhatsNew({
                versionId: targetVersionId,
                locale,
                whatsNew: text,
              });
              appStoreResults.push(`✅ ${locale}`);
            } catch (error) {
              const msg =
                error instanceof Error ? error.message : String(error);
              appStoreResults.push(`❌ ${locale}: ${msg}`);
            }
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        appStoreResults.push(`❌ App Store error: ${msg}`);
      }
    }
  }

  // Google Play update
  if ((store === "both" || store === "googlePlay") && packageName) {
    if (!config.playStore?.serviceAccountJson) {
      googlePlayResults.push("❌ Google Play authentication not configured.");
    } else {
      try {
        const { GooglePlayClient } = await import("@packages/play-store");
        const serviceAccount = JSON.parse(config.playStore.serviceAccountJson);
        const client = new GooglePlayClient({
          packageName,
          serviceAccountKey: serviceAccount,
        });

        const result = await client.updateReleaseNotes({
          releaseNotes: whatsNew,
          track: "production",
        });

        if (result.updated.length > 0) {
          googlePlayResults.push(`✅ ${result.updated.join(", ")}`);
        }
        for (const fail of result.failed) {
          googlePlayResults.push(`❌ ${fail.locale}: ${fail.error}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        googlePlayResults.push(`❌ Google Play error: ${msg}`);
      }
    }
  }

  // Combine results
  if (appStoreResults.length > 0) {
    results.push(`**🍎 App Store:**`);
    results.push(...appStoreResults.map((r) => `  ${r}`));
  }
  if (googlePlayResults.length > 0) {
    results.push(`**🤖 Google Play:**`);
    results.push(...googlePlayResults.map((r) => `  ${r}`));
  }

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "⚠️ No store to update. Please check bundleId or packageName.",
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `📝 Release Notes Update Results:\n\n${results.join("\n")}`,
      },
    ],
  };
}
