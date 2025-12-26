![Cover](../../public/cover.gif)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=pabal-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInBhYmFsLW1jcCJdfQ%3D%3D)

[![한국어 docs](https://img.shields.io/badge/docs-Korean-green)](../ko/README.md)

# MCP server for App Store Connect & Play Console API

Up-to-date ASO workflows exposed as MCP tools. Run it as a stdio MCP server (Claude Code, Cursor, MCP Inspector, etc.) to manage metadata, releases, and store syncs without leaving your AI client.

> [!NOTE]
> Runs 100% locally on your machine, so credentials and cached ASO data never leave your environment (store API calls are made directly from your device).

<br>

## ❌ Without pabal-mcp

- Manual App Store Connect and Google Play Console clicks for every update
- Copy-paste errors across locales and release notes
- Repeating the same setup per client or project

<br>

## ✅ With pabal-mcp

- One MCP server that handles ASO pulls/pushes for both stores
- Consistent release note updates and version checks from your AI client
- Reusable, scriptable workflows backed by local cache and config

<br>

## 🛠️ MCP Client Installation

### Requirements

- Node.js >= 18
- MCP client: Cursor, Claude Code, VS Code, Windsurf, etc.

> [!TIP]
> If you repeatedly do ASO/store tasks, add a client rule like "always use pabal-mcp" so the MCP server auto-invokes without typing it every time.

### Global install (recommended)

```bash
npm install -g pabal-mcp
# or
yarn global add pabal-mcp
```

Install globally first for fastest starts and to avoid npm download issues (proxy/firewall/offline). You can still use `npx -y pabal-mcp`, but global install is recommended. After global install, set your MCP config to `command: "pabal-mcp"` (no `npx` needed).

<details>
<summary><b>Install in Cursor</b></summary>

Add to `~/.cursor/mcp.json` (global) or project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pabal-mcp": {
      "command": "npx",
      "args": ["-y", "pabal-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in VS Code</b></summary>

Example `settings.json` MCP section:

```json
"mcp": {
  "servers": {
    "pabal-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "pabal-mcp"]
    }
  }
}
```

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
      "command": "npx",
      "args": ["-y", "pabal-mcp"]
    }
  }
}
```

Or if installed globally (`npm install -g pabal-mcp`):

```json
{
  "mcpServers": {
    "pabal-mcp": {
      "command": "pabal-mcp"
    }
  }
}
```

</details>

<details>
<summary><b>Install in Windsurf</b></summary>

```json
{
  "mcpServers": {
    "pabal-mcp": {
      "command": "npx",
      "args": ["-y", "pabal-mcp"]
    }
  }
}
```

</details>

<br>

## 🔐 Configure Credentials

1. Create config directory and set permissions:

```bash
mkdir -p ~/.config/pabal-mcp
chmod 700 ~/.config/pabal-mcp
open ~/.config/pabal-mcp
```

2. Create the config file (pre-filled placeholders):

```bash
cat <<'EOF' > ~/.config/pabal-mcp/config.json
{
  "dataDir": "/ABSOLUTE/PATH/TO/pabal-web",
  "appStore": {
    "issuerId": "xxxx",
    "keyId": "xxxx",
    "privateKeyPath": "./app-store-key.p8"
  },
  "googlePlay": {
    "serviceAccountKeyPath": "./google-play-service-account.json"
  }
}
EOF
```

Replace the `issuerId` and `keyId` placeholders in the next step after you grab your App Store Connect keys.
`dataDir` is the absolute path where raw data pulled from each store is stored (e.g., `/ABSOLUTE/PATH/TO/pabal-web`).

3. Add your credentials to `~/.config/pabal-mcp/`:

   **App Store Connect API key**:
   - [App Store Connect > Users and Access > Keys](https://appstoreconnect.apple.com/access/integrations/api) → "Generate API Key." Use Admin/App Manager, download the `.p8` (only downloadable once), and save it as `~/.config/pabal-mcp/app-store-key.p8`.
   - Copy the Issuer ID and Key ID from the key details, then update `issuerId` and `keyId` in `~/.config/pabal-mcp/config.json` with those values.

   **Google Play service account JSON**:
   - [Google Cloud Manage service accounts](https://console.cloud.google.com/projectselector2/iam-admin/serviceaccounts?supportedpurview=project) → create a service account (name it `pabal` for clarity) → Create key → JSON.
   - Save the downloaded JSON as `~/.config/pabal-mcp/google-play-service-account.json`.
   - Grant Play Console access to that service account email: go to [Users and permissions](https://play.google.com/console/u/0/developers/users-and-permissions) → Invite new user → enter the service account email → choose the ASO apps → enable:
     - View app information and download bulk reports (read-only)
     - Create, edit, and delete drafts of apps
     - Release to production
     - Manage device exclusion lists
     - Use Play App Signing
     - Manage store presence

   **Config file shape (after updating your IDs):**

   ```json
   {
     "dataDir": "/ABSOLUTE/PATH/TO/pabal-web",
     "appStore": {
       "issuerId": "<your-issuer-id>",
       "keyId": "<your-key-id>",
       "privateKeyPath": "./app-store-key.p8"
     },
     "googlePlay": {
       "serviceAccountKeyPath": "./google-play-service-account.json"
     }
   }
   ```

4. Pull store data

   Use `apps-init` to fetch and auto-register existing apps from the store APIs.
   This will populate your `~/.config/pabal-mcp/registered-apps.json` with the apps available in your stores.

5. Lock file permissions (all files in the config folder):

```bash
chmod 600 ~/.config/pabal-mcp/*
```

This applies to every file under `~/.config/pabal-mcp/`; rerun after adding any new credential file.

<br>

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

<br>

## 🏗️ Development

### From source

```bash
git clone https://github.com/quartz-labs-dev/pabal-mcp.git
cd pabal-mcp
yarn install
yarn dev:mcp
```

### Testing

Run all tests: `npm test`

<br>

## License

MIT

<br>

---

<br>

## 🌐 Pabal Web

Want to manage ASO and SEO together? Check out **Pabal Web**.

[![Pabal Web](../../public/pabal-web.png)](https://pabal.quartz.best/)

**Pabal Web** is a Next.js-based web interface that provides a complete solution for unified management of ASO, SEO, Google Search Console indexing, and more.

👉 [Visit Pabal Web](https://pabal.quartz.best/)
