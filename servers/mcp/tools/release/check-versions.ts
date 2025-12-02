import { getStoreTargets } from "@/packages/configs/aso-config/store";
import { type StoreType } from "@/packages/configs/aso-config/types";
import { AppResolutionService } from "@servers/mcp/core/services";
import { getLatestVersions } from "@servers/mcp/core/workflows/version-info";

const appResolutionService = new AppResolutionService();

interface CheckVersionsOptions {
  app?: string; // Registered app slug
  packageName?: string; // For Google Play
  bundleId?: string; // For App Store
  store?: StoreType;
}

export async function handleCheckLatestVersions(options: CheckVersionsOptions) {
  const { app, store } = options;
  let { packageName, bundleId } = options;
  const {
    store: selectedStore,
    includeAppStore,
    includeGooglePlay,
  } = getStoreTargets(store);

  console.error(`[MCP] 🔍 Checking latest versions (store: ${selectedStore})`);

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

  // Check latest versions (without prompt message since this is a dedicated check tool)
  console.error(`[MCP]   App: ${slug}`);
  if (bundleId) console.error(`[MCP]   App Store bundleId: ${bundleId}`);
  if (packageName)
    console.error(`[MCP]   Google Play packageName: ${packageName}`);

  const skips: string[] = [];
  if (includeAppStore && !hasAppStore) {
    skips.push(`⏭️  Skipping App Store (not registered for App Store)`);
  } else if (includeAppStore && !bundleId) {
    skips.push(`⏭️  Skipping App Store (no bundleId provided)`);
  }
  if (includeGooglePlay && !hasGooglePlay) {
    skips.push(`⏭️  Skipping Google Play (not registered for Google Play)`);
  } else if (includeGooglePlay && !packageName) {
    skips.push(`⏭️  Skipping Google Play (no packageName provided)`);
  }

  const versionInfo = await getLatestVersions({
    bundleId,
    includePrompt: false,
    store: selectedStore,
    packageName,
    hasAppStore,
    hasGooglePlay,
  });

  console.error(`[MCP]   ✅ Version check completed`);

  const contentLines = [...skips, ...versionInfo.messages];

  return {
    content: [
      {
        type: "text" as const,
        text: contentLines.join("\n"),
      },
    ],
  };
}
