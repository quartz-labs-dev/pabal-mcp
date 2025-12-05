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

- Data directory: outputs default to the project root. Override with `dataDir` in `secrets/aso-config.json` (absolute or repo-relative).

## Run locally

- Start the MCP server with `npm run dev:mcp` from the project root (stdio server).
- When connecting from an MCP client, call `run-mcp.sh` so paths resolve correctly. Set `dataDir` in `secrets/aso-config.json`.

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

- `packages/*`: SDK layer only (e.g., `aso-config`, `config`). Holds API clients, request/response types, and low-level helpers. Do not put domain logic or error formatting here.
- `packages/secrets-config`: Secret-backed helpers (e.g., registered-apps IO in `secrets/`, secret-loaded config). Keep this limited to IO and simple CRUD; domain decisions stay in services.
- `services` (`servers/mcp/core/services/*`): Domain layer. Creates clients, validates inputs, calls SDKs, and returns data in `ServiceResult`/`MaybeResult` shapes. Uses shared helpers (`service-helpers`, `client-factory-helpers`).
- `workflows` (`servers/mcp/core/workflows/*`): Optional orchestration (e.g., version-info) that combines multiple services and formats messages. Keep services data-only; do formatting here or in tool-level helpers.
- `helpers` (`servers/mcp/core/helpers/*`): Formatting utilities (`formatters`), shared pure functions.
- `tools` (`servers/mcp/tools/*`): MCP tool entrypoints. Parse user input, call services/workflows, format output. No direct SDK/client usage.
- `tests`: Unit tests for clients/services/workflows.

Rules:

- Services must use `toServiceResult`/`toErrorMessage`/`serviceSuccess`/`serviceFailure`; avoid manual `{ success: false }`.
- Tools must not create clients or import SDKs directly; go through services/workflows.
- Keep message formatting out of services; use helper/workflow layer.

## Naming & File Layout

- Store suffix: store-specific files/namespaces use `*.app-store.ts`, `*.google-play.ts` (if the directory already names the store, keep the file name as the feature only). Shared logic uses no suffix or `.shared.ts`.
- SDK packages (`packages/<store>`): split into `api/` (remote call wrappers), `types.ts` (types/guards), `constants.ts` (constants), `client.ts` (entry point). Root `index.ts` only re-exports.
- Shared packages (`packages/aso-config`, `packages/config`, `packages/secrets-config`): split constants/types/utils (`constants.ts`/`types.ts`/`utils.ts`). Move domain logic to `servers/mcp/core/services`; keep `secrets-config` limited to secret-backed IO.
- Services/workflows/tools: name by role first (`*-service.ts`, `*-workflow.ts`, `*-tool.ts`); store variants follow the suffix rule above.
- Tests: target file name + `.test.ts` (e.g., `app-store-service.test.ts`), placed alongside the target layer.

## Review/Lint Policy

- Layer boundaries
  - packages: only SDK/types/constants. No file IO, config loading, registered-app mutations, or message formatting.
  - services: client creation/validation via `client-factory-helpers`/factories; result wrapping via `service-helpers` (`toServiceResult`/`serviceSuccess`/`serviceFailure`/`toErrorMessage`) only. Do not handcraft `{ success: false }`.
  - tools/workflows: no direct SDK imports. Call services/workflows. Use helpers for formatting (e.g., `formatPushResult`, `formatReleaseNotesUpdate`) or add new formatters under helpers.
- Error/log/skip formatting: define in `servers/mcp/core/helpers` and reuse. Avoid hardcoded messages in services; unify skip messages via helpers.
- Naming/structure checks: new files follow Naming & File Layout. For store-specific branching, split files or apply the suffix rule.
- Validation: during review, check for layer-boundary violations (import paths), missing helper usage, and literal success/failure objects; add unit tests for service methods/formatters when needed.

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
