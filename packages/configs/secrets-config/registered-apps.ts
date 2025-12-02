/**
 * Registered app management
 * Manage app list through secrets/registered-apps.json file
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

  if (!existsSync(filePath)) {
    return { apps: [] };
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as RegisteredAppsConfig;
  } catch (error) {
    console.error("❌ Failed to load registered apps:", error);
    return { apps: [] };
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
    console.error("❌ Failed to save registered apps:", error);
    throw error;
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
    throw new Error(`App with slug "${app.slug}" already exists`);
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
    return false;
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
      return false;
    }
    app.appStore.supportedLocales = mergedLocales;
  } else {
    if (!app.googlePlay) {
      return false;
    }
    app.googlePlay.supportedLocales = mergedLocales;
  }

  saveRegisteredApps(config);
  return true;
}
