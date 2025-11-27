# pabal-mcp

MCP server that provides App Store / Play Store ASO workflows as tools. Run it as a stdio MCP server (e.g., with Claude Desktop or MCP Inspector) to manage app metadata and releases.

## Setup

- Requirements: Node.js 18+.
- Install dependencies: `npm install`.
- Add credentials under `secrets/` (gitignored):
  - App Store Connect: save the API key file as `secrets/app-store-key.p8`, and note the Issuer ID and Key ID.
  - Google Play Console: save the service account JSON as `secrets/google-play-service-account.json` and ensure the account has store access.
- Create `secrets/aso-config.json` pointing to the credential files:

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

- Data directory: by default, files are written to the project root. Override with `PABAL_MCP_DATA_DIR` (absolute or repo-relative).

## Run the MCP server

- Local development: `npm run dev:mcp` (starts a stdio MCP server in the project root).
- From an MCP client, use the `run-mcp.sh` wrapper so paths resolve correctly. Example Claude Desktop config:

```json
{
  "mcpServers": {
    "pabal-mcp": {
      "command": "bash",
      "args": ["/Users/you/path/to/pabal-mcp/run-mcp.sh"],
      "cwd": "/Users/you/path/to/pabal-mcp",
      "env": {
        "PABAL_MCP_DATA_DIR": "/Users/you/path/to/pabal-web"
      }
    }
  }
}
```

## MCP tools (current)

- Authentication
  - `auth-check`: Check App Store Connect / Google Play authentication (`store`: appStore | googlePlay | both).
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

Run `npm run tools` to print the current tool list directly from the server code.

## Testing

- Run all tests: `npm test`
