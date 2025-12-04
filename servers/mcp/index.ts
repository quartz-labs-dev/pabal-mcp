import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";
import { handleAuthCheck } from "./tools/auth/check";
import { handleSetupApps } from "./tools/apps/init";
import { handleAddApp } from "./tools/apps/add";
import { handleSearchApps } from "./tools/apps/search";
import { handleAsoPull } from "./tools/aso/pull";
import { handleAsoPush } from "./tools/aso/push";
import { handleAsoCreateVersion } from "./tools/release/create";
import { handleAsoPullReleaseNotes } from "./tools/release/pull-notes";
import { handleUpdateNotes } from "./tools/release/update-notes";
import { handleCheckLatestVersions } from "./tools/release/check-versions";

// MCP config sets cwd to project root, so we don't need to chdir
// Just verify we're in the right place
console.error(`[MCP] 📂 Working directory: ${process.cwd()}`);

const server = new McpServer(
  { name: "pabal-mcp", version: "0.0.1" },
  {
    instructions: "Provides tools for App Store/Play Store ASO.",
  }
);

// ============================================================================
// Common Schemas
// ============================================================================

const storeSchema = z.enum(["appStore", "googlePlay", "both"]).optional();

// ============================================================================
// Tool Registration Info (for documentation)
// ============================================================================

interface ToolInfo {
  name: string;
  description: string;
  inputSchema?: z.ZodObject<any> | z.ZodTypeAny;
  category?: string;
}

const toolInfos: ToolInfo[] = [];

/**
 * Format parameters for logging (hide sensitive data)
 */
function formatParamsForLogging(params: any): string {
  if (!params || typeof params !== "object") return "";

  const safeParams: Record<string, any> = {};
  const sensitiveKeys = [
    "privateKey",
    "serviceAccountJson",
    "serviceAccountKey",
  ];

  for (const [key, value] of Object.entries(params)) {
    if (
      sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))
    ) {
      safeParams[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      safeParams[key] = formatParamsForLogging(value);
    } else {
      safeParams[key] = value;
    }
  }

  const entries = Object.entries(safeParams)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .slice(0, 3); // Limit to first 3 params to keep it concise

  return entries.length > 0 ? ` (${entries.join(", ")})` : "";
}

/**
 * Wrap handler with logging
 */
function wrapHandlerWithLogging(name: string, handler: any) {
  return async (params: any) => {
    const paramsStr = formatParamsForLogging(params);
    console.error(`[MCP] 🔧 ${name}${paramsStr}`);

    const startTime = Date.now();
    try {
      const result = await handler(params);
      const duration = Date.now() - startTime;
      console.error(`[MCP] ✅ ${name} completed (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] ❌ ${name} failed (${duration}ms): ${errorMsg}`);
      throw error;
    }
  };
}

function registerToolWithInfo(
  name: string,
  info: { description: string; inputSchema?: z.ZodObject<any> | z.ZodTypeAny },
  handler: any,
  category?: string
) {
  // Store tool info for documentation (keep zod schema)
  toolInfos.push({
    name,
    description: info.description,
    inputSchema: info.inputSchema,
    category,
  });

  // Convert zod schema to plain object for MCP SDK
  const mcpInfo: { description: string; inputSchema?: any } = {
    description: info.description,
  };

  if (info.inputSchema && info.inputSchema instanceof z.ZodObject) {
    // Convert ZodObject to plain object format expected by MCP SDK
    const shape = info.inputSchema.shape;
    const plainSchema: Record<string, any> = {};
    for (const [key, value] of Object.entries(shape)) {
      plainSchema[key] = value;
    }
    mcpInfo.inputSchema = plainSchema;
  }

  // Wrap handler with logging
  const wrappedHandler = wrapHandlerWithLogging(name, handler);
  server.registerTool(name, mcpInfo, wrappedHandler);
}

// Export tool info for documentation
export function getToolInfos(): ToolInfo[] {
  return toolInfos;
}

// ============================================================================
// Authentication (auth-*)
// ============================================================================

registerToolWithInfo(
  "auth-check",
  {
    description:
      "Check authentication status for App Store Connect / Google Play Console.",
    inputSchema: z.object({
      store: storeSchema.describe("Store to check (default: both)"),
    }),
  },
  handleAuthCheck,
  "Authentication"
);

// ============================================================================
// App Management (apps-*)
// ============================================================================

registerToolWithInfo(
  "apps-init",
  {
    description:
      "Query app list from store API and register automatically. App Store: auto-register all apps, Google Play: packageName required.",
    inputSchema: z.object({
      store: z
        .enum(["appStore", "googlePlay"])
        .optional()
        .describe("Target store (default: appStore)"),
      packageName: z
        .string()
        .optional()
        .describe(
          "Google Play package name (required when setting up Google Play)"
        ),
    }),
  },
  handleSetupApps,
  "App Management"
);

registerToolWithInfo(
  "apps-add",
  {
    description:
      "Register individual app by bundleId or packageName. Automatically checks both stores.",
    inputSchema: z.object({
      identifier: z
        .string()
        .describe(
          "App identifier (bundleId or packageName, e.g., com.example.app)"
        ),
      slug: z
        .string()
        .optional()
        .describe(
          "Custom slug (if not specified, uses last part of identifier)"
        ),
      store: storeSchema.describe("Store to check (default: both)"),
    }),
  },
  handleAddApp,
  "App Management"
);

registerToolWithInfo(
  "apps-search",
  {
    description:
      "Search registered apps. Returns all apps if called without query.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "Search term (slug, bundleId, packageName, name). Returns all apps if empty"
        ),
      store: z
        .enum(["all", "appStore", "googlePlay"])
        .optional()
        .describe("Store filter (default: all)"),
    }),
  },
  handleSearchApps,
  "App Management"
);

// ============================================================================
// ASO Data Sync (aso-*)
// ============================================================================

registerToolWithInfo(
  "aso-pull",
  {
    description:
      "Fetch ASO data from App Store/Google Play and save to local cache.",
    inputSchema: z.object({
      app: z
        .string()
        .optional()
        .describe("Registered app slug (app registered via apps-init)"),
      packageName: z.string().optional().describe("Google Play package name"),
      bundleId: z.string().optional().describe("App Store bundle ID"),
      store: storeSchema.describe("Target store (default: both)"),
      dryRun: z
        .boolean()
        .optional()
        .describe("If true, only outputs result without actually saving"),
    }),
  },
  handleAsoPull,
  "ASO Data Sync"
);

registerToolWithInfo(
  "aso-push",
  {
    description: "Push ASO data from local cache to App Store/Google Play.",
    inputSchema: z.object({
      app: z.string().optional().describe("Registered app slug"),
      packageName: z.string().optional().describe("Google Play package name"),
      bundleId: z.string().optional().describe("App Store bundle ID"),
      store: storeSchema.describe("Target store (default: both)"),
      uploadImages: z
        .boolean()
        .optional()
        .describe("Whether to upload images as well"),
      dryRun: z
        .boolean()
        .optional()
        .describe("If true, only outputs result without actually pushing"),
    }),
  },
  handleAsoPush,
  "ASO Data Sync"
);

// ============================================================================
// Release Management (release-*)
// ============================================================================

registerToolWithInfo(
  "release-check-versions",
  {
    description: "Check latest versions from App Store/Google Play.",
    inputSchema: z.object({
      app: z.string().optional().describe("Registered app slug"),
      packageName: z.string().optional().describe("Google Play package name"),
      bundleId: z.string().optional().describe("App Store bundle ID"),
      store: storeSchema.describe("Target store (default: both)"),
    }),
  },
  handleCheckLatestVersions,
  "Release Management"
);

registerToolWithInfo(
  "release-create",
  {
    description:
      "Create a new version on App Store/Google Play. If version is not provided, checks and displays latest versions from each store.",
    inputSchema: z.object({
      app: z.string().optional().describe("Registered app slug"),
      packageName: z.string().optional().describe("Google Play package name"),
      bundleId: z.string().optional().describe("App Store bundle ID"),
      version: z
        .string()
        .optional()
        .describe(
          "Version string to create (e.g., 1.2.0). If not provided, will check and display latest versions."
        ),
      store: storeSchema.describe("Target store (default: both)"),
      versionCodes: z
        .array(z.number())
        .optional()
        .describe(
          "Version code array for Google Play (required when creating Google Play version)"
        ),
    }),
  },
  handleAsoCreateVersion,
  "Release Management"
);

registerToolWithInfo(
  "release-pull-notes",
  {
    description: "Fetch release notes from App Store/Google Play.",
    inputSchema: z.object({
      app: z.string().optional().describe("Registered app slug"),
      packageName: z.string().optional().describe("Google Play package name"),
      bundleId: z.string().optional().describe("App Store bundle ID"),
      store: storeSchema.describe("Target store (default: both)"),
      dryRun: z
        .boolean()
        .optional()
        .describe("If true, only outputs result without actually saving"),
    }),
  },
  handleAsoPullReleaseNotes,
  "Release Management"
);

registerToolWithInfo(
  "release-update-notes",
  {
    description:
      "Update release notes (What's New) for App Store/Google Play version.",
    inputSchema: z.object({
      app: z.string().optional().describe("Registered app slug"),
      packageName: z.string().optional().describe("Google Play package name"),
      bundleId: z.string().optional().describe("App Store bundle ID"),
      store: storeSchema.describe("Target store (default: both)"),
      versionId: z
        .string()
        .optional()
        .describe(
          "App Store version ID (auto-detects editable version if not specified)"
        ),
      whatsNew: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          'Release notes by locale (e.g., { "en-US": "Bug fixes", "ko": "Bug fixes" })'
        ),
      text: z
        .string()
        .optional()
        .describe("Source text to translate to all supported languages"),
      sourceLocale: z
        .string()
        .optional()
        .describe("Source locale (default: en-US)"),
    }),
  },
  handleUpdateNotes,
  "Release Management"
);

async function main() {
  console.error("[MCP] 🚀 Starting pabal-mcp server...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP] ✅ Server connected and ready");
}

// Only start server if this file is run directly (not imported)
// Check if the current file is the main module being executed
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  main().catch((error) => {
    console.error("MCP server failed to start", error);
    process.exit(1);
  });
}
