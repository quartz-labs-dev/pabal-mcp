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
   1. App Store Connect API key:
      - [App Store Connect > Users and Access > Keys](https://appstoreconnect.apple.com/access/integrations/api) → “Generate API Key.” Use Admin/App Manager, download the `.p8` (only downloadable once), and save it as `secrets/app-store-key.p8`.
      - Copy the Issuer ID and Key ID from the key details; you’ll paste them into `aso-config.json`.
   2. Google Play service account JSON:
      - [Google Cloud Manage service accounts](https://console.cloud.google.com/projectselector2/iam-admin/serviceaccounts?supportedpurview=project) → create a service account (name it `pabal` for clarity) → Create key → JSON.
      - Save the downloaded JSON as `secrets/google-play-service-account.json`.
      - Grant Play Console access to that service account email: go to [Users and permissions](https://play.google.com/console/u/0/developers/users-and-permissions) → Invite new user → enter the service account email → choose the ASO apps → enable:
        - View app information and download bulk reports (read-only)
        - Create, edit, and delete drafts of apps
        - Release to production
        - Manage device exclusion lists
        - Use Play App Signing
        - Manage store presence
   3. Configure `secrets/aso-config.json` to point at those files:

   ```json
   {
     "appStore": {
       "issuerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
       "keyId": "XXXXXXXXXX",
       "privateKeyPath": "./secrets/app-store-key.p8" // don't change this
     },
     "googlePlay": {
       "serviceAccountKeyPath": "./secrets/google-play-service-account.json" // don't change this
     }
   }
   ```

Data directory: by default, files are written to the project root. Override with `dataDir` in `secrets/aso-config.json` (absolute path).

4. Pull store datas

   Use `apps-init` to fetch and auto-register existing apps from the store APIs

   This will populate your `secrets/registered-apps.json` with the apps available in your stores.

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

> [!TIP]
> See the [official Claude Code MCP documentation](https://code.claude.com/docs/en/mcp#setting-up-enterprise-mcp-configuration) for detailed configuration options.

Add to Claude Code MCP settings (JSON format):

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

> [!NOTE]
> CLI (`claude mcp add`) does not support args and cwd settings, so you must edit the JSON configuration directly.

`run-mcp.sh` keeps TypeScript paths resolved from the repo root.

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

## 🔧 MCP Tools

- Authentication
  - `auth-check`: Check App Store Connect / Google Play authentication.
- App management
  - `apps-init`: Fetch apps from the store API and auto-register them (Google Play needs `packageName`).
  - `apps-add`: Register a single app by bundleId/packageName.
  - `apps-search`: Search registered apps.
- ASO data sync
  - `aso-pull`: Fetch ASO data to the `.aso/` local cache.
  - `aso-push`: Push ASO data from `.aso/` to the stores.
- Release management
  - `release-check-versions`: Show the latest versions per store.
  - `release-create`: Create a new version.
  - `release-pull-notes`: Pull release notes to the `.aso/` cache.
  - `release-update-notes`: Update release notes/what's new.

## ✅ Testing

- Run all tests: `npm test`

---

## 🌐 Pabal Web

Want to manage ASO and SEO together? Check out **Pabal Web**.

[![Pabal Web](public/pabal-web.png)](https://pabal.quartz.best/)

**Pabal Web** is a Next.js-based web interface that provides a complete solution for unified management of ASO, SEO, Google Search Console indexing, and more.

👉 [Visit Pabal Web](https://pabal.quartz.best/)
