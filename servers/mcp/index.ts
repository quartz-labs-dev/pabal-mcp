import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chdir } from "node:process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";
import {
  handlePing,
  handleAuthCheck,
  handleSetupApps,
  handleAddApp,
  handleSearchApps,
  handleAsoPull,
  handleAsoPush,
  handleAsoTranslate,
  handleAsoCreateVersion,
  handleAsoPullReleaseNotes,
  handleUpdateNotes,
  handleCheckLatestVersions,
} from "./tools";

// Change to project root first
// tsx automatically resolves tsconfig.json paths when run from project root
const mcpServerFilename = fileURLToPath(import.meta.url);
const mcpServerDirname = dirname(mcpServerFilename);
const projectRoot = join(mcpServerDirname, "../..");
chdir(projectRoot);

const server = new McpServer(
  { name: "pabal-mcp", version: "0.0.1" },
  {
    instructions:
      "Provides tools for App Store/Play Store ASO. Use ping first to verify connection.",
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

  server.registerTool(name, mcpInfo, handler);
}

// Export tool info for documentation
export function getToolInfos(): ToolInfo[] {
  return toolInfos;
}

// ============================================================================
// Health Check
// ============================================================================

registerToolWithInfo(
  "ping",
  {
    description: "Health check for connection verification",
  },
  handlePing,
  "Health Check"
);

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

registerToolWithInfo(
  "aso-translate",
  {
    description:
      "Returns text that needs translation and target locale list. LLM should perform translation directly and pass results to release-update-notes.",
    inputSchema: z.object({
      text: z.string().describe("Source text to translate"),
      sourceLocale: z
        .string()
        .optional()
        .describe("Source locale (default: en-US)"),
      targetLocales: z
        .array(z.string())
        .optional()
        .describe(
          "Target locale array (uses store default locales if not specified)"
        ),
      store: storeSchema.describe(
        "Target store (used to determine locale list)"
      ),
    }),
  },
  handleAsoTranslate,
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
        .describe(
          'Release notes by locale (e.g., { "en-US": "Bug fixes", "ko": "Bug fixes" })'
        ),
    }),
  },
  handleUpdateNotes,
  "Release Management"
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
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
