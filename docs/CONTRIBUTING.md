# Contributing Guide

This project runs as an MCP server for App Store / Play Store ASO workflows. Use the steps below to set up your environment and exercise the existing tools.

## Setup

- Use Node.js 18+ and install dependencies with `npm install`.
- Place credentials under the gitignored `secrets/` directory:
  - App Store Connect: API key file at `secrets/app-store-key.p8` plus Issuer ID and Key ID.
  - Google Play Console: service account JSON at `secrets/google-play-service-account.json` with the required store permissions.
- Create `secrets/aso-config.json` that points to those files:

```json
{
  "dataDir": "/path/to/data/directory",
  "appStore": {
    "issuerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "keyId": "XXXXXXXXXX",
    "privateKeyPath": "./secrets/app-store-key.p8"
  },
  "googlePlay": {
    "serviceAccountKeyPath": "./secrets/google-play-service-account.json"
  }
}
```

- Data directory: outputs default to the project root. Override with `dataDir` in `secrets/aso-config.json` (absolute or repo-relative) or `PABAL_MCP_DATA_DIR` environment variable. Priority: config file > environment variable > project root.

## Run locally

- Start the MCP server with `npm run dev:mcp` from the project root (stdio server).
- When connecting from an MCP client, call `run-mcp.sh` so paths resolve correctly. Set `dataDir` in `secrets/aso-config.json` or pass `PABAL_MCP_DATA_DIR` environment variable if needed.

## Architecture

```
 CLI / MCP client
        │
        ▼
   tools (servers/mcp/tools)
     - MCP entrypoints
     - parse input, call workflows/services, format output
        │
        ▼
   workflows (servers/mcp/core/workflows)
     - optional orchestration across multiple services
     - message aggregation/flow control
        │
        ▼
   services (servers/mcp/core/services) ◀────────────── helpers
     - domain logic, client creation, validation,        (servers/mcp/core/helpers)
       error formatting                                  pure utilities (formatters, shared)
        │                                                no deps on workflows/services
        ▼
   clients/SDK (packages/*/client, API modules)
     - raw API calls, request/response types
        │
        ▼
   External APIs (App Store Connect / Google Play)
```

- `packages/*`: SDK layer only. Holds API clients, request/response types, and low-level helpers. Do not put domain logic or error formatting here.
- `services` (`servers/mcp/core/services/*`): Domain layer. Creates clients, validates inputs, calls SDKs, and returns data in `ServiceResult`/`MaybeResult` shapes. Uses shared helpers (`service-helpers`, `client-factory-helpers`).
- `workflows` (`servers/mcp/core/workflows/*`): Optional orchestration (e.g., version-info) that combines multiple services and formats messages. Keep services data-only; do formatting here or in tool-level helpers.
- `helpers` (`servers/mcp/core/helpers/*`): Formatting utilities (`formatters`), shared pure functions.
- `tools` (`servers/mcp/tools/*`): MCP tool entrypoints. Parse user input, call services/workflows, format output. No direct SDK/client usage.
- `tests`: Unit tests for clients/services/workflows.

Rules:

- Services must use `toServiceResult`/`toErrorMessage`/`serviceSuccess`/`serviceFailure`; avoid manual `{ success: false }`.
- Tools must not create clients or import SDKs directly; go through services/workflows.
- Keep message formatting out of services; use helper/workflow layer.

## Tool reference (current)

- Authentication
  - `auth-check`: Verify App Store Connect / Google Play authentication (`store`: appStore | googlePlay | both).
- App management
  - `apps-init`: Fetch apps from the store API and auto-register them. For Google Play, provide `packageName`.
  - `apps-add`: Register a single app by bundleId/packageName (`identifier`), with optional `slug` and `store`.
  - `apps-search`: Search registered apps (`query`) with optional `store` filter.
- ASO data sync
  - `aso-pull`: Fetch ASO data to the local cache (`app`/`bundleId`/`packageName`, optional `store`, `dryRun`).
  - `aso-push`: Push cached ASO data to the stores (same targeting options, optional `uploadImages`, `dryRun`).
- Release management
  - `release-check-versions`: Show the latest versions per store for the specified app.
  - `release-create`: Create a new version; accepts `version`, `versionCodes` (for Google Play), and standard app targeting options.
  - `release-pull-notes`: Retrieve release notes to the local cache (`dryRun` supported).
  - `release-update-notes`: Update release notes/what's new (`whatsNew` map or `text`+`sourceLocale`, standard targeting).

Run `npm run tools` to print the current list directly from the server code.

## Tests

- Run the suite with `npm test`.
