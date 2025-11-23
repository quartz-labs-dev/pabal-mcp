/**
 * apps-search: Search registered apps
 *
 * Search apps from registered-apps.json.
 * - Called without query: Returns all app list
 * - Called with query: Search by slug, bundleId, packageName, name
 */

import {
  loadRegisteredApps,
  findApp,
  type RegisteredApp,
} from "@packages/shared";

interface SearchAppsOptions {
  /** Search term (slug, bundleId, packageName, name). Returns all apps if empty */
  query?: string;
  /** Store filter (default: all) */
  store?: "all" | "appStore" | "googlePlay";
}

/**
 * Check if app matches query
 */
function matchesQuery(app: RegisteredApp, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // slug match
  if (app.slug.toLowerCase().includes(lowerQuery)) return true;

  // name match
  if (app.name.toLowerCase().includes(lowerQuery)) return true;

  // App Store bundleId match
  if (app.appStore?.bundleId?.toLowerCase().includes(lowerQuery)) return true;

  // App Store name match
  if (app.appStore?.name?.toLowerCase().includes(lowerQuery)) return true;

  // Google Play packageName match
  if (app.googlePlay?.packageName?.toLowerCase().includes(lowerQuery))
    return true;

  // Google Play name match
  if (app.googlePlay?.name?.toLowerCase().includes(lowerQuery)) return true;

  return false;
}

/**
 * Apply store filter
 */
function filterByStore(
  apps: RegisteredApp[],
  store: "all" | "appStore" | "googlePlay"
): RegisteredApp[] {
  if (store === "all") return apps;

  return apps.filter((app) => {
    if (store === "appStore") return !!app.appStore;
    if (store === "googlePlay") return !!app.googlePlay;
    return true;
  });
}

/**
 * Format app information
 */
function formatAppInfo(app: RegisteredApp): string {
  const lines: string[] = [];

  lines.push(`📱 **${app.name}** (\`${app.slug}\`)`);

  if (app.appStore) {
    lines.push(`   🍎 App Store: \`${app.appStore.bundleId}\``);
    if (app.appStore.appId) {
      lines.push(`      App ID: ${app.appStore.appId}`);
    }
  }

  if (app.googlePlay) {
    lines.push(`   🤖 Google Play: \`${app.googlePlay.packageName}\``);
  }

  return lines.join("\n");
}

export async function handleSearchApps(options: SearchAppsOptions) {
  const { query, store = "all" } = options;

  try {
    const config = loadRegisteredApps();
    let results: RegisteredApp[];

    if (!query) {
      // If no query, return full list
      results = config.apps;
    } else {
      // Try exact match first
      const exactMatch = findApp(query);
      if (exactMatch) {
        results = [exactMatch];
      } else {
        // Partial match
        results = config.apps.filter((app) => matchesQuery(app, query));
      }
    }

    // Apply store filter
    results = filterByStore(results, store);

    if (results.length === 0) {
      const message = query
        ? `No apps found matching "${query}".`
        : "No apps registered.";

      return {
        content: [
          {
            type: "text" as const,
            text: `❌ ${message}

💡 Register apps using apps-add or apps-init tools.`,
          },
        ],
        _meta: { apps: [], count: 0 },
      };
    }

    const header = query
      ? `🔍 Search results for "${query}": ${results.length}`
      : `📋 Registered app list: ${results.length}`;

    const appList = results.map(formatAppInfo).join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `${header}

${appList}`,
        },
      ],
      _meta: { apps: results, count: results.length },
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ App search failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
