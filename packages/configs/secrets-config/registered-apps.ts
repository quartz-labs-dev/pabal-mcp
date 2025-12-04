/**
 * Registered app management
 * Manage app list through secrets/registered-apps.json file
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppError } from "@/packages/common/errors/app-error";
import { ERROR_CODES } from "@/packages/common/errors/error-codes";
import { getProjectRoot } from "@/packages/configs/secrets-config/config";

// ============================================================================
// Type Definitions
// ============================================================================

export interface RegisteredAppStoreInfo {
  bundleId: string;
  appId?: string;
  name?: string;
  supportedLocales?: string[];
}

export interface RegisteredGooglePlayInfo {
  packageName: string;
  name?: string;
  supportedLocales?: string[];
}

export interface RegisteredApp {
  /** App identifier (user-defined, must be unique) */
  slug: string;
  /** Display name */
  name: string;
  /** App Store information */
  appStore?: RegisteredAppStoreInfo;
  /** Google Play information */
  googlePlay?: RegisteredGooglePlayInfo;
}

export interface RegisteredAppsConfig {
  apps: RegisteredApp[];
}

// ============================================================================
// File Paths
// ============================================================================

function getRegisteredAppsPath(): string {
  return resolve(getProjectRoot(), "secrets", "registered-apps.json");
}

// ============================================================================
// CRUD Functions
// ============================================================================

/**
 * Load registered app list
 */
export function loadRegisteredApps(): RegisteredAppsConfig {
  const filePath = getRegisteredAppsPath();

  console.error(`[RegisteredApps] 🔍 Loading registered apps...`);
  console.error(`[RegisteredApps]   File path: ${filePath}`);
  console.error(`[RegisteredApps]   File exists: ${existsSync(filePath)}`);

  if (!existsSync(filePath)) {
    console.error(
      `[RegisteredApps]   ⚠️  File not found, returning empty list`
    );
    return { apps: [] };
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const config = JSON.parse(content) as RegisteredAppsConfig;
    console.error(
      `[RegisteredApps]   ✅ Loaded ${config.apps.length} apps: ${config.apps.map((a) => a.slug).join(", ")}`
    );
    return config;
  } catch (error) {
    throw AppError.validation(
      ERROR_CODES.REGISTERED_APPS_READ_FAILED,
      `Failed to load registered apps: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { filePath }
    );
  }
}

/**
 * Save registered app list
 */
export function saveRegisteredApps(config: RegisteredAppsConfig): void {
  const filePath = getRegisteredAppsPath();

  try {
    writeFileSync(filePath, JSON.stringify(config, null, 2));
  } catch (error) {
    throw AppError.io(
      ERROR_CODES.REGISTERED_APPS_WRITE_FAILED,
      `Failed to save registered apps: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { filePath }
    );
  }
}

/**
 * Register app
 */
export function registerApp(app: RegisteredApp): RegisteredApp {
  const config = loadRegisteredApps();

  // Check for duplicates
  const existing = config.apps.find((a) => a.slug === app.slug);
  if (existing) {
    throw AppError.conflict(
      ERROR_CODES.REGISTERED_APP_DUPLICATE,
      `App with slug "${app.slug}" already exists`
    );
  }

  config.apps.push(app);
  saveRegisteredApps(config);

  return app;
}

/**
 * Find app (search by slug, bundleId, packageName)
 */
export function findApp(identifier: string): RegisteredApp | undefined {
  const config = loadRegisteredApps();

  return config.apps.find(
    (app) =>
      app.slug === identifier ||
      app.appStore?.bundleId === identifier ||
      app.googlePlay?.packageName === identifier
  );
}

/**
 * Update supported locales for an app
 */
export function updateAppSupportedLocales({
  identifier,
  store,
  locales,
}: {
  identifier: string;
  store: "appStore" | "googlePlay";
  locales: string[];
}): boolean {
  const config = loadRegisteredApps();
  const appIndex = config.apps.findIndex(
    (app) =>
      app.slug === identifier ||
      app.appStore?.bundleId === identifier ||
      app.googlePlay?.packageName === identifier
  );

  if (appIndex === -1) {
    throw AppError.notFound(
      ERROR_CODES.REGISTERED_APP_NOT_FOUND,
      `App "${identifier}" not found in registered apps`
    );
  }

  const app = config.apps[appIndex];

  // Merge and deduplicate locales
  const existingLocales =
    store === "appStore"
      ? app.appStore?.supportedLocales || []
      : app.googlePlay?.supportedLocales || [];

  const mergedLocales = Array.from(
    new Set([...existingLocales, ...locales])
  ).sort();

  // Update the app
  if (store === "appStore") {
    if (!app.appStore) {
      throw AppError.validation(
        ERROR_CODES.REGISTERED_APP_STORE_INFO_MISSING,
        `App "${identifier}" is missing App Store info`
      );
    }
    app.appStore.supportedLocales = mergedLocales;
  } else {
    if (!app.googlePlay) {
      throw AppError.validation(
        ERROR_CODES.REGISTERED_APP_STORE_INFO_MISSING,
        `App "${identifier}" is missing Google Play info`
      );
    }
    app.googlePlay.supportedLocales = mergedLocales;
  }

  saveRegisteredApps(config);
  return true;
}
