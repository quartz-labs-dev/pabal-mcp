import { GooglePlayClient } from "@packages/play-store/client";
import { loadConfig } from "@packages/common/config";
import {
  failure,
  isNonEmptyString,
  success,
  toErrorMessage,
} from "./client-factory-helpers";
import type { ClientFactoryResult } from "./types";

/**
 * Result type for Google Play client creation
 */
export type GooglePlayClientResult = ClientFactoryResult<GooglePlayClient>;

/**
 * Configuration for Google Play client creation
 */
export interface GooglePlayClientConfig {
  packageName: string;
}

/**
 * Create Google Play client with fresh config loading and Result pattern
 *
 * Stateless factory - loads config on every call to ensure MCP works from any directory
 *
 * @param config - Package name configuration
 * @returns Result with client or error message
 *
 * @example
 * const result = createGooglePlayClient({ packageName: "com.example.app" });
 * if (result.success) {
 *   const data = await result.client.getApp();
 * } else {
 *   console.error(result.error);
 * }
 */
export function createGooglePlayClient(
  config: GooglePlayClientConfig
): GooglePlayClientResult {
  // Validate input
  if (!config) {
    return failure("Google Play client configuration is missing");
  }

  const { packageName } = config;

  if (!isNonEmptyString(packageName)) {
    return failure("Package name is required and must be a non-empty string");
  }

  // Load fresh config (stateless - works from any directory)
  let playStoreConfig;
  try {
    const fullConfig = loadConfig();
    playStoreConfig = fullConfig.playStore;
  } catch (error) {
    return failure(
      `Failed to load Google Play configuration: ${toErrorMessage(error)}`
    );
  }

  // Validate required credentials
  if (!playStoreConfig) {
    return failure("Google Play configuration is missing in config file");
  }

  const { serviceAccountJson } = playStoreConfig;

  if (!isNonEmptyString(serviceAccountJson)) {
    return failure(
      "Google Play service account JSON is required in configuration"
    );
  }

  // Parse and validate service account JSON
  let serviceAccountKey: Record<string, unknown>;
  try {
    const parsed = JSON.parse(serviceAccountJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return failure("Service account JSON must be a valid JSON object");
    }
    serviceAccountKey = parsed;
  } catch (error) {
    return failure(
      `Invalid Google Play service account JSON: ${toErrorMessage(error)}`
    );
  }

  // Create client
  try {
    const client = new GooglePlayClient({
      packageName,
      serviceAccountKey,
    });

    return success(client);
  } catch (error) {
    return failure(
      `Failed to create Google Play client: ${toErrorMessage(error)}`
    );
  }
}
