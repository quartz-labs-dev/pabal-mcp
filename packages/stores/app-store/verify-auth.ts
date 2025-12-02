import { loadConfig } from "@/packages/configs/secrets-config/config";
import { createAppStoreJWT, decodeJwt } from "@/packages/stores/app-store/auth";

export interface VerifyAppStoreAuthResult {
  success: boolean;
  error?: string;
  data?: {
    header: Record<string, unknown>;
    payload: Record<string, unknown>;
  };
}

/**
 * Verify App Store Connect authentication configuration and generate JWT token for validation.
 * @param expirationSeconds JWT token expiration time (seconds). Default: 300 seconds
 * @returns Authentication verification result
 */
export async function verifyAppStoreAuth({
  expirationSeconds = 300,
}: {
  expirationSeconds?: number;
} = {}): Promise<VerifyAppStoreAuthResult> {
  try {
    const cfg = loadConfig().appStore;
    if (!cfg) {
      return {
        success: false,
        error:
          "App Store configuration not found in secrets/aso-config.json file.",
      };
    }

    const token = await createAppStoreJWT(cfg, { expirationSeconds });
    const decoded = decodeJwt(token);

    return {
      success: true,
      data: {
        header: decoded.header,
        payload: decoded.payload,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `App Store authentication verification failed: ${message}`,
    };
  }
}
