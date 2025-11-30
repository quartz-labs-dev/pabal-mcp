/**
 * 릴리즈 노트 번역 관련 유틸리티
 * 각 스토어의 지원 로케일에 맞게 번역을 준비합니다.
 */

import type { RegisteredApp } from "./registered-apps";
import type { StoreType } from "@packages/common/types";

export interface TranslationRequest {
  sourceText: string;
  sourceLocale: string;
  targetLocales: string[];
  store: StoreType;
}

export interface TranslationResult {
  translations: Record<string, string>;
}

/**
 * 등록된 앱 정보에서 지원 로케일 수집
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
 * 번역 요청 정보 생성
 * 각 스토어별로 필요한 번역 로케일을 분리하여 반환
 */
export function createTranslationRequests({
  app,
  sourceText,
  sourceLocale = "en-US",
  store = "both",
}: {
  app: RegisteredApp;
  sourceText: string;
  sourceLocale?: string;
  store?: StoreType;
}): {
  appStore?: TranslationRequest;
  googlePlay?: TranslationRequest;
} {
  const { appStore: appStoreLocales, googlePlay: googlePlayLocales } =
    collectSupportedLocales({ app, store });

  const result: {
    appStore?: TranslationRequest;
    googlePlay?: TranslationRequest;
  } = {};

  if (appStoreLocales.length > 0) {
    const targetLocales = appStoreLocales.filter(
      (locale) => locale !== sourceLocale
    );
    if (targetLocales.length > 0 || appStoreLocales.includes(sourceLocale)) {
      result.appStore = {
        sourceText,
        sourceLocale,
        targetLocales,
        store: "appStore",
      };
    }
  }

  if (googlePlayLocales.length > 0) {
    const targetLocales = googlePlayLocales.filter(
      (locale) => locale !== sourceLocale
    );
    if (targetLocales.length > 0 || googlePlayLocales.includes(sourceLocale)) {
      result.googlePlay = {
        sourceText,
        sourceLocale,
        targetLocales,
        store: "googlePlay",
      };
    }
  }

  return result;
}

/**
 * 번역 결과를 각 스토어별로 분리
 */
export function separateTranslationsByStore({
  translations,
  app,
  sourceLocale,
  store,
}: {
  translations: Record<string, string>;
  app: RegisteredApp;
  sourceLocale: string;
  store: StoreType;
}): {
  appStore: Record<string, string>;
  googlePlay: Record<string, string>;
} {
  const { appStore: appStoreLocales, googlePlay: googlePlayLocales } =
    collectSupportedLocales({ app, store });

  const appStoreTranslations: Record<string, string> = {};
  const googlePlayTranslations: Record<string, string> = {};

  // App Store 번역 수집
  // 지원하는 로케일에 대해서만 번역을 포함합니다
  // 번역이 없는 로케일은 포함하지 않습니다 (번역 파이프라인에서 처리해야 함)
  if (appStoreLocales.length > 0) {
    for (const locale of appStoreLocales) {
      if (translations[locale]) {
        // 해당 로케일의 번역이 있으면 사용
        appStoreTranslations[locale] = translations[locale];
      } else if (locale === sourceLocale && translations[sourceLocale]) {
        // sourceLocale과 일치하고 sourceLocale 번역이 있으면 사용
        appStoreTranslations[locale] = translations[sourceLocale];
      }
    }
  }

  // Google Play 번역 수집
  // 지원하는 로케일에 대해서만 번역을 포함합니다
  // 번역이 없는 로케일은 포함하지 않습니다 (번역 파이프라인에서 처리해야 함)
  if (googlePlayLocales.length > 0) {
    for (const locale of googlePlayLocales) {
      if (translations[locale]) {
        // 해당 로케일의 번역이 있으면 사용
        googlePlayTranslations[locale] = translations[locale];
      } else if (locale === sourceLocale && translations[sourceLocale]) {
        // sourceLocale과 일치하고 sourceLocale 번역이 있으면 사용
        googlePlayTranslations[locale] = translations[sourceLocale];
      }
    }
  }

  return {
    appStore: appStoreTranslations,
    googlePlay: googlePlayTranslations,
  };
}
