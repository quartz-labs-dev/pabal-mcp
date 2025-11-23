/**
 * ASO translation request tool
 *
 * This tool returns text that needs translation and target locale list.
 * LLM performs translation directly, then passes results to other ASO tools.
 */

import { APP_STORE_SUPPORTED_LOCALES, GOOGLE_PLAY_SUPPORTED_LANGUAGES } from "@packages/aso-core";
import { type StoreType } from "@packages/shared/types";

interface AsoTranslateOptions {
  text: string;
  sourceLocale?: string;
  targetLocales?: string[];
  store?: StoreType;
}

interface TranslationRequest {
  sourceText: string;
  sourceLocale: string;
  targetLocales: string[];
  instructions: string;
}

/**
 * Return default locale list by store type
 */
function getDefaultLocales(store: StoreType): string[] {
  switch (store) {
    case "appStore":
      return [...APP_STORE_SUPPORTED_LOCALES];
    case "googlePlay":
      return [...GOOGLE_PLAY_SUPPORTED_LANGUAGES];
    case "both":
      const combined = new Set([
        ...APP_STORE_SUPPORTED_LOCALES,
        ...GOOGLE_PLAY_SUPPORTED_LANGUAGES,
      ]);
      return Array.from(combined);
  }
}

/**
 * Create translation request
 */
export async function handleAsoTranslate(options: AsoTranslateOptions) {
  const {
    text,
    sourceLocale = "en-US",
    targetLocales,
    store = "both"
  } = options;

  if (!text || text.trim().length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "❌ Text to translate is required.",
        },
      ],
    };
  }

  const locales = targetLocales && targetLocales.length > 0
    ? targetLocales
    : getDefaultLocales(store);

  const filteredLocales = locales.filter(locale => locale !== sourceLocale);

  const request: TranslationRequest = {
    sourceText: text,
    sourceLocale,
    targetLocales: filteredLocales,
    instructions: `Please translate the following text for each locale.
Maintain a tone appropriate for app store release notes/What's New.
Consider the cultural context of each locale and translate naturally.

Provide translation results in the following JSON format:
{
  "translations": {
    "ko": "Translated text",
    "ja": "翻訳されたテキスト",
    ...
  }
}`,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: `🌐 Translation Request

**Source Text** (${sourceLocale}):
${text}

**Target Locales** (${filteredLocales.length}):
${filteredLocales.join(", ")}

**Instructions**:
${request.instructions}

---
After completing translation, use the \`release:update-notes\` tool to update release notes for each locale.`,
      },
    ],
    _meta: {
      translationRequest: request,
    },
  };
}
