/**
 * auth-check: Check App Store / Google Play authentication status
 */

import { getStoreTargets } from "@/packages/configs/aso-config/store";
import { type StoreType } from "@/packages/configs/aso-config/types";
import { AppStoreService } from "@servers/mcp/core/services/app-store-service";
import { GooglePlayService } from "@servers/mcp/core/services/google-play-service";

const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();

interface AuthCheckOptions {
  store?: StoreType;
}

export async function handleAuthCheck(options: AuthCheckOptions) {
  const { store } = options;
  const {
    store: targetStore,
    includeAppStore,
    includeGooglePlay,
  } = getStoreTargets(store);
  const results: string[] = [];

  console.error(`[MCP] 🔐 Checking authentication (store: ${targetStore})`);

  if (includeAppStore) {
    console.error(`[MCP]   Checking App Store Connect...`);
    const appStoreResult = await appStoreService.verifyAuth(300);
    if (appStoreResult.success && appStoreResult.data) {
      results.push(`✅ **App Store Connect**`);
      results.push(`   Issuer ID: ${appStoreResult.data.payload.iss}`);
      results.push(`   Key ID: ${appStoreResult.data.header.kid}`);
      results.push(`   JWT created successfully`);
    } else {
      results.push(`❌ **App Store Connect**`);
      results.push(`   ${appStoreResult.error || "Authentication failed"}`);
    }
    results.push("");
  }

  if (includeGooglePlay) {
    console.error(`[MCP]   Checking Google Play Console...`);
    const playStoreResult = await googlePlayService.verifyAuth();
    if (playStoreResult.success && playStoreResult.data) {
      results.push(`✅ **Google Play Console**`);
      results.push(`   Project: ${playStoreResult.data.project_id}`);
      results.push(`   Service Account: ${playStoreResult.data.client_email}`);
    } else {
      results.push(`❌ **Google Play Console**`);
      results.push(`   ${playStoreResult.error || "Authentication failed"}`);
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `🔐 **Authentication Status**\n\n${results.join("\n")}`,
      },
    ],
  };
}
