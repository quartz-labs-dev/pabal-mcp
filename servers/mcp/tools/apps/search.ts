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
} from "@/packages/configs/secrets-config/registered-apps";

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

  console.error(
    `[MCP] 🔍 Searching apps (query: ${query || "all"}, store: ${store})`
  );

  try {
    const config = loadRegisteredApps();
    console.error(`[MCP]   Loaded ${config.apps.length} apps from config`);
    if (config.apps.length > 0) {
      console.error(
        `[MCP]   App slugs: ${config.apps.map((a) => a.slug).join(", ")}`
      );
    }
    let results: RegisteredApp[];

    if (!query) {
      // If no query, return full list
      results = config.apps;
    } else {
      // Try exact match first (by slug, bundleId, packageName)
      const exactMatch = findApp(query);

      // Also search for partial matches
      const partialMatches = config.apps.filter((app) =>
        matchesQuery(app, query)
      );

      // Combine results: exact match first, then partial matches
      // Remove duplicates by slug
      const seenSlugs = new Set<string>();
      results = [];

      // Add exact match first if found
      if (exactMatch && !seenSlugs.has(exactMatch.slug)) {
        results.push(exactMatch);
        seenSlugs.add(exactMatch.slug);
      }

      // Add partial matches (excluding exact match if already added)
      for (const app of partialMatches) {
        if (!seenSlugs.has(app.slug)) {
          results.push(app);
          seenSlugs.add(app.slug);
        }
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
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ App search failed: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
