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

- Data directory: outputs default to the project root. Override with `PABAL_MCP_DATA_DIR` (absolute or repo-relative).

## Run locally

- Start the MCP server with `npm run dev:mcp` from the project root (stdio server).
- When connecting from an MCP client, call `run-mcp.sh` so paths resolve correctly and pass any env vars (e.g., `PABAL_MCP_DATA_DIR`).

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
