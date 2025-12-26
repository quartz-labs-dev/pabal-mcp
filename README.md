![Cover](public/cover.gif)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=pabal-mcp&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInBhYmFsLW1jcCJdfQ%3D%3D)

[![English docs](https://img.shields.io/badge/docs-English-blue)](./docs/en/README.md) [![한국어 docs](https://img.shields.io/badge/docs-Korean-green)](./docs/ko/README.md)

# MCP server for App Store Connect & Play Console API

Up-to-date ASO workflows exposed as MCP tools. Run it as a stdio MCP server (Claude Code, Cursor, MCP Inspector, etc.) to manage metadata, releases, and store syncs without leaving your AI client.

> [!NOTE]
> Runs 100% locally on your machine, so credentials and cached ASO data never leave your environment (store API calls are made directly from your device).

<br>

## Quick Start

### Install

```bash
npm install -g pabal-mcp
```

### Configure

1. Create config directory:

```bash
mkdir -p ~/.config/pabal-mcp
chmod 700 ~/.config/pabal-mcp
```

2. Add your credentials to `~/.config/pabal-mcp/config.json`:
   - **App Store Connect**: API key (`.p8` file) with `issuerId` and `keyId`
   - **Google Play**: Service account JSON key

3. Set up MCP client (Cursor, VS Code, Claude Code, etc.) to use `pabal-mcp`

<br>

## Features

- ✅ **ASO Data Sync**: Pull/push metadata from App Store and Google Play
- ✅ **Release Management**: Create versions and update release notes
- ✅ **App Management**: Auto-register apps from store APIs
- ✅ **100% Local**: All operations run on your machine

<br>

## MCP Tools

- **Authentication**: `auth-check`
- **App Management**: `apps-init`, `apps-add`, `apps-search`
- **ASO Sync**: `aso-pull`, `aso-push`
- **Release Management**: `release-check-versions`, `release-create`, `release-pull-notes`, `release-update-notes`

<br>

## Documentation

📖 **[Full Documentation (English)](./docs/en/README.md)**
📖 **[전체 문서 (한국어)](./docs/ko/README.md)**

<br>

## Development

```bash
git clone https://github.com/quartz-labs-dev/pabal-mcp.git
cd pabal-mcp
yarn install
yarn dev:mcp
```

<br>

## License

MIT

<br>

---

<br>

## 🌐 Pabal Web

Want to manage ASO and SEO together? Check out **Pabal Web**.

[![Pabal Web](public/pabal-web.png)](https://pabal.quartz.best/)

**Pabal Web** is a Next.js-based web interface that provides a complete solution for unified management of ASO, SEO, Google Search Console indexing, and more.

👉 [Visit Pabal Web](https://pabal.quartz.best/)
