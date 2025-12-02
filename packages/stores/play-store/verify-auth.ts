import { loadConfig } from "@/packages/configs/secrets-config/config";

export interface VerifyPlayStoreAuthResult {
  success: boolean;
  error?: string;
  data?: {
    client_email: string;
    project_id: string;
  };
}

/**
 * Verify Google Play Store service account authentication configuration.
 * @returns Authentication verification result
 */
export function verifyPlayStoreAuth(): VerifyPlayStoreAuthResult {
  try {
    const cfg = loadConfig().playStore;
    if (!cfg) {
      return {
        success: false,
        error:
          "Play Store configuration not found in secrets/aso-config.json file.",
      };
    }

    const parsed = JSON.parse(cfg.serviceAccountJson);

    return {
      success: true,
      data: {
        client_email: parsed.client_email,
        project_id: parsed.project_id,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Play Store authentication verification failed: ${message}`,
    };
  }
}
