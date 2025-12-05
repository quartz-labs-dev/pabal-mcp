![Cover](public/cover.gif)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=pabal-mcp&config=eyJjb21tYW5kIjoiYmFzaCIsImFyZ3MiOlsiL0FCU09MVVRFL1BBVEgvVE8vcGFiYWwtbWNwL3J1bi1tY3Auc2giXSwiY3dkIjoiL0FCU09MVVRFL1BBVEgvVE8vcGFiYWwtbWNwIn0%3D)

[![한국어 docs](https://img.shields.io/badge/docs-Korean-green)](./i18n/README.ko.md)

# MCP server for App Store Connect & Play Console API

Up-to-date ASO workflows exposed as MCP tools. Run it as a stdio MCP server (Claude Code, Cursor, MCP Inspector, etc.) to manage metadata, releases, and store syncs without leaving your AI client.

> [!NOTE]
> Runs 100% locally on your machine, so credentials and cached ASO data never leave your environment (store API calls are made directly from your device).

## ❌ Without pabal-mcp

- Manual App Store Connect and Google Play Console clicks for every update
- Copy-paste errors across locales and release notes
- Repeating the same setup per client or project

## ✅ With pabal-mcp

- One MCP server that handles ASO pulls/pushes for both stores
- Consistent release note updates and version checks from your AI client
- Reusable, scriptable workflows backed by local cache and config

## 🛠️ Quick Setup

1. Requirements: Node.js 18+
2. Install dependencies: `yarn install`
3. Add credentials under `secrets/` (gitignored):
   - App Store Connect: save the API key file as `secrets/app-store-key.p8`, and note the Issuer ID and Key ID.
   - Google Play Console: save the service account JSON as `secrets/google-play-service-account.json` and ensure the account has store access.
   - `secrets/aso-config.json` pointing to the credential files:

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

Data directory: by default, files are written to the project root. Override with `dataDir` in `secrets/aso-config.json` (absolute or repo-relative).

## 🛠️ Installation

### Requirements

- Node.js >= 18
- MCP client: Cursor, Claude Code, VS Code, Windsurf, etc.
- App Store / Google Play credentials + `secrets/aso-config.json`

> [!TIP]
> If you repeatedly do ASO/store tasks, add a client rule like “always use pabal-mcp” so the MCP server auto-invokes without typing it every time.

> [!IMPORTANT]
> Replace every `/ABSOLUTE/PATH/TO/pabal-mcp` placeholder with your real local repo path (e.g., `/Users/you/path/to/pabal-mcp`). One-click badges include this placeholder—edit after clicking if needed.

<details>
<summary><b>Install in Cursor</b></summary>

- One-click: [![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=pabal-mcp&config=eyJjb21tYW5kIjoiYmFzaCIsImFyZ3MiOlsiL0FCU09MVVRFL1BBVEgvVE8vcGFiYWwtbWNwL3J1bi1tY3Auc2giXSwiY3dkIjoiL0FCU09MVVRFL1BBVEgvVE8vcGFiYWwtbWNwIn0%3D)
- Or add to `~/.cursor/mcp.json` (global) or project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pabal-mcp": {
      "command": "bash",
      "args": ["/ABSOLUTE/PATH/TO/pabal-mcp/run-mcp.sh"],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-mcp"
    }
  }
}
```

`run-mcp.sh` keeps TypeScript paths resolved from the repo root.

</details>

<details>
<summary><b>Install in VS Code</b></summary>

Example `settings.json` MCP section (local project run):

```json
"mcp": {
  "servers": {
    "pabal-mcp": {
      "type": "stdio",
      "command": "bash",
      "args": ["/ABSOLUTE/PATH/TO/pabal-mcp/run-mcp.sh"],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-mcp"
    }
  }
}
```

Switch `command` to `npx` and `args` to `["-y", "pabal-mcp@latest"]` to run the published package instead.

</details>

<details>
<summary><b>Install in Claude Code</b></summary>

Local (bash) run:

```sh
claude mcp add pabal-mcp -- bash /ABSOLUTE/PATH/TO/pabal-mcp/run-mcp.sh
```

Published package (npx):

```sh
claude mcp add pabal-mcp -- npx -y pabal-mcp@latest
```

</details>

<details>
<summary><b>Install in Windsurf</b></summary>

```json
{
  "mcpServers": {
    "pabal-mcp": {
      "command": "bash",
      "args": ["/ABSOLUTE/PATH/TO/pabal-mcp/run-mcp.sh"],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-mcp"
    }
  }
}
```

You can swap `command`/`args` to `npx` + `pabal-mcp@latest` for direct package execution.

</details>

> Other MCP clients generally work the same: point `command`/`args` to `run-mcp.sh` or `npx -y pabal-mcp@latest`.

## 🚀 Run the MCP Server

- Local development: `npm run dev:mcp` (starts a stdio MCP server in the project root).
- From an MCP client, use the `run-mcp.sh` wrapper so paths resolve correctly. Example Claude Desktop config:

```json
{
  "mcpServers": {
    "pabal-mcp": {
      "command": "bash",
      "args": ["/ABSOLUTE/PATH/TO/pabal-mcp/run-mcp.sh"],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-mcp"
    }
  }
}
```

Set `dataDir` in `secrets/aso-config.json` to control where data is written.

## 🔧 MCP Tools

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

## ✅ Testing

- Run all tests: `npm test`
