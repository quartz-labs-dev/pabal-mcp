/**
 * Release notes translation utilities.
 * Prepares translation requests per store and gathers supported locales from registered apps.
 */

import type { RegisteredApp } from "@/packages/configs/secrets-config/registered-apps";
import type { StoreType } from "@/packages/configs/aso-config/types";

export interface TranslationRequest {
  sourceText: string;
  sourceLocale: string;
  targetLocales: string[];
  store: StoreType;
}

/**
 * Collect supported locales from registered app info
 */
export function collectSupportedLocales({
  app,
  store,
}: {
  app: RegisteredApp;
  store: StoreType;
}): {
  appStore: string[];
  googlePlay: string[];
} {
  const appStoreLocales: string[] = [];
  const googlePlayLocales: string[] = [];

  if (
    (store === "both" || store === "appStore") &&
    app.appStore?.supportedLocales
  ) {
    appStoreLocales.push(...app.appStore.supportedLocales);
  }

  if (
    (store === "both" || store === "googlePlay") &&
    app.googlePlay?.supportedLocales
  ) {
    googlePlayLocales.push(...app.googlePlay.supportedLocales);
  }

  return {
    appStore: appStoreLocales,
    googlePlay: googlePlayLocales,
  };
}

/**
 * Create translation requests per store
 */
export function createTranslationRequests({
  store,
  targetLocales,
  sourceLocale,
  sourceText,
}: {
  store: StoreType;
  targetLocales: {
    appStore: string[];
    googlePlay: string[];
  };
  sourceLocale: string;
  sourceText: string;
}): TranslationRequest[] {
  const requests: TranslationRequest[] = [];

  if (store === "both" || store === "appStore") {
    if (targetLocales.appStore.length > 0) {
      requests.push({
        store: "appStore",
        sourceText,
        sourceLocale,
        targetLocales: targetLocales.appStore,
      });
    }
  }

  if (store === "both" || store === "googlePlay") {
    if (targetLocales.googlePlay.length > 0) {
      requests.push({
        store: "googlePlay",
        sourceText,
        sourceLocale,
        targetLocales: targetLocales.googlePlay,
      });
    }
  }

  return requests;
}

/**
 * Separate translations by store
 */
export function separateTranslationsByStore({
  store,
  translations,
  app,
  sourceLocale,
}: {
  store: StoreType;
  translations: Record<string, string>;
  app: RegisteredApp;
  sourceLocale: string;
}): {
  appStore: Record<string, string>;
  googlePlay: Record<string, string>;
} {
  const appStoreTranslations: Record<string, string> = {};
  const googlePlayTranslations: Record<string, string> = {};

  const appStoreLocales = app.appStore?.supportedLocales;
  const googlePlayLocales = app.googlePlay?.supportedLocales;

  for (const [locale, text] of Object.entries(translations)) {
    if (store === "both" || store === "appStore") {
      if (!appStoreLocales || appStoreLocales.includes(locale)) {
        appStoreTranslations[locale] = text;
      }
    }
    if (store === "both" || store === "googlePlay") {
      if (!googlePlayLocales || googlePlayLocales.includes(locale)) {
        googlePlayTranslations[locale] = text;
      }
    }
  }

  // Always include sourceLocale if provided and missing
  if (store === "both" || store === "appStore") {
    if (translations[sourceLocale] && !(sourceLocale in appStoreTranslations)) {
      appStoreTranslations[sourceLocale] = translations[sourceLocale];
    }
  }
  if (store === "both" || store === "googlePlay") {
    if (
      translations[sourceLocale] &&
      !(sourceLocale in googlePlayTranslations)
    ) {
      googlePlayTranslations[sourceLocale] = translations[sourceLocale];
    }
  }

  return {
    appStore: appStoreTranslations,
    googlePlay: googlePlayTranslations,
  };
}
