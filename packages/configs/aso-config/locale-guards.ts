import {
  APP_STORE_SUPPORTED_LOCALES,
  GOOGLE_PLAY_SUPPORTED_LANGUAGES,
} from "./constants";
import type { AppStoreLocale, GooglePlayLanguage } from "./types";

export function isAppStoreLocale(locale: string): locale is AppStoreLocale {
  return APP_STORE_SUPPORTED_LOCALES.includes(locale as AppStoreLocale);
}

export function isGooglePlayLanguage(
  language: string
): language is GooglePlayLanguage {
  return GOOGLE_PLAY_SUPPORTED_LANGUAGES.includes(
    language as GooglePlayLanguage
  );
}
