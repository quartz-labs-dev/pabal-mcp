import { AppStoreClient } from "@packages/app-store/client";
import { loadConfig } from "@packages/common/config";
import {
  failure,
  isNonEmptyString,
  success,
  toErrorMessage,
} from "./client-factory-helpers";
import type { ClientFactoryResult } from "./types";

/**
 * Result type for App Store client creation
 */
export type AppStoreClientResult = ClientFactoryResult<AppStoreClient>;

/**
 * Configuration for App Store client creation
 */
export interface AppStoreClientConfig {
  bundleId: string;
}

/**
 * Create App Store client with fresh config loading and Result pattern
 *
 * Stateless factory - loads config on every call to ensure MCP works from any directory
 *
 * @param config - Bundle ID configuration
 * @returns Result with client or error message
 *
 * @example
 * const result = createAppStoreClient({ bundleId: "com.example.app" });
 * if (result.success) {
 *   const data = await result.client.getApp();
 * } else {
 *   console.error(result.error);
 * }
 */
export function createAppStoreClient(
  config: AppStoreClientConfig
): AppStoreClientResult {
  // Validate input
  if (!config) {
    return failure("App Store client configuration is missing");
  }

  const { bundleId } = config;

  if (!isNonEmptyString(bundleId)) {
    return failure("Bundle ID is required and must be a non-empty string");
  }

  // Load fresh config (stateless - works from any directory)
  let appStoreConfig;
  try {
    const fullConfig = loadConfig();
    appStoreConfig = fullConfig.appStore;
  } catch (error) {
    return failure(
      `Failed to load App Store configuration: ${toErrorMessage(error)}`
    );
  }

  // Validate required credentials
  if (!appStoreConfig) {
    return failure("App Store configuration is missing in config file");
  }

  const { issuerId, keyId, privateKey } = appStoreConfig;

  if (!isNonEmptyString(issuerId)) {
    return failure("App Store Issuer ID is required in configuration");
  }

  if (!isNonEmptyString(keyId)) {
    return failure("App Store Key ID is required in configuration");
  }

  if (!isNonEmptyString(privateKey)) {
    return failure("App Store Private Key is required in configuration");
  }

  // Validate private key format
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    return failure(
      "Invalid Private Key format. PEM format private key is required (must contain 'BEGIN PRIVATE KEY')"
    );
  }

  // Create client
  try {
    const client = new AppStoreClient({
      bundleId,
      issuerId,
      keyId,
      privateKey,
    });

    return success(client);
  } catch (error) {
    return failure(
      `Failed to create App Store client: ${toErrorMessage(error)}`
    );
  }
}
