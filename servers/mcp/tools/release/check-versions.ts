import { type StoreType } from "@packages/shared/types";
import { findApp, checkLatestVersions } from "@packages/shared";

interface CheckVersionsOptions {
  app?: string; // Registered app slug
  packageName?: string; // For Google Play
  bundleId?: string; // For App Store
  store?: StoreType;
}

export async function handleCheckLatestVersions(options: CheckVersionsOptions) {
  const { app, store = "both" } = options;
  let { packageName, bundleId } = options;

  // Determine bundleId and packageName
  let registeredApp = app ? findApp(app) : undefined;

  if (app && registeredApp) {
    // Successfully retrieved app info by app slug
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

  // Check latest versions (without prompt message since this is a dedicated check tool)
  const versionInfo = await checkLatestVersions({
    store,
    bundleId,
    packageName,
    includePrompt: false,
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
