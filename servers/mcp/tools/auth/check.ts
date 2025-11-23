/**
 * auth-check: Check App Store / Google Play authentication status
 */

import { verifyAppStoreAuth } from "@packages/app-store";
import { verifyPlayStoreAuth } from "@packages/play-store";
import { type StoreType } from "@packages/shared/types";

interface AuthCheckOptions {
  store?: StoreType;
}

export async function handleAuthCheck(options: AuthCheckOptions) {
  const { store = "both" } = options;
  const results: string[] = [];

  if (store === "appStore" || store === "both") {
    const appStoreResult = await verifyAppStoreAuth({ expirationSeconds: 300 });
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

  if (store === "googlePlay" || store === "both") {
    const playStoreResult = verifyPlayStoreAuth();
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
