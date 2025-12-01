/**
 * Release notes update tool
 *
 * Supports both App Store and Google Play.
 * Automatically translates to all supported languages if text is provided.
 */

import { type StoreType } from "@packages/common/types";
import {
  createTranslationRequests,
  separateTranslationsByStore,
  collectSupportedLocales,
} from "@packages/utils/translate-release-notes";
import {
  AppResolutionService,
  AppStoreService,
  GooglePlayService,
} from "@servers/mcp/core/services";
import { formatReleaseNotesUpdate } from "@servers/mcp/core/helpers/formatters";

const appStoreService = new AppStoreService();
const googlePlayService = new GooglePlayService();
const appResolutionService = new AppResolutionService();

interface UpdateNotesOptions {
  app?: string;
  bundleId?: string;
  packageName?: string;
  store?: StoreType;
  versionId?: string;
  whatsNew?: Record<string, string>;
  text?: string; // Source text to translate
  sourceLocale?: string; // Source locale (default: "en-US")
}

export async function handleUpdateNotes(options: UpdateNotesOptions) {
  const {
    app,
    versionId,
    whatsNew,
    text,
    sourceLocale = "en-US",
    store = "both",
  } = options;
  let { bundleId, packageName } = options;

  const { loadConfig } = await import("@packages/common");

  const resolved = appResolutionService.resolve({
    slug: app,
    bundleId,
    packageName,
  });

  if (!resolved.success) {
    return {
      content: [
        {
          type: "text" as const,
          text: resolved.error,
        },
      ],
    };
  }

  const {
    slug,
    bundleId: resolvedBundleId,
    packageName: resolvedPackageName,
    hasAppStore,
    hasGooglePlay,
    app: registeredApp,
  } = resolved.data;

  bundleId = resolvedBundleId;
  packageName = resolvedPackageName;

  const includeAppStore = store === "both" || store === "appStore";
  const includeGooglePlay = store === "both" || store === "googlePlay";

  // Determine what to update
  let finalWhatsNew: Record<string, string> = {};

  if (whatsNew && Object.keys(whatsNew).length > 0) {
    // Step 1: Get supported locales for the app
    const config = loadConfig();
    let appStoreLocales: string[] = [];
    let googlePlayLocales: string[] = [];

    // Check if locales are already in registered app
    const {
      appStore: existingAppStoreLocales,
      googlePlay: existingGooglePlayLocales,
    } = collectSupportedLocales({ app: registeredApp, store });

    // If locales are missing, fetch from API
    if (includeAppStore && hasAppStore && bundleId) {
      if (existingAppStoreLocales.length > 0) {
        appStoreLocales = existingAppStoreLocales;
      } else if (config.appStore) {
        // Fetch from App Store API
        const appInfo = await appStoreService.fetchAppInfo(bundleId);

        if (appInfo.found) {
          if (appInfo.supportedLocales) {
            appStoreLocales = appInfo.supportedLocales;
            // Update registered app with fetched locales
            if (registeredApp.appStore) {
              registeredApp.appStore.supportedLocales =
                appInfo.supportedLocales;
            }
          }
        } else if (appInfo.error) {
          console.error(
            `[MCP]   ⚠️ Failed to fetch App Store locales: ${appInfo.error}`
          );
        }
      }
    }

    if (includeGooglePlay && hasGooglePlay && packageName) {
      if (existingGooglePlayLocales.length > 0) {
        googlePlayLocales = existingGooglePlayLocales;
      } else if (config.playStore?.serviceAccountJson) {
        // Fetch from Google Play API
        const appInfo = await googlePlayService.fetchAppInfo(packageName);

        if (appInfo.found) {
          if (appInfo.supportedLocales) {
            googlePlayLocales = appInfo.supportedLocales;
            // Update registered app with fetched locales
            if (registeredApp.googlePlay) {
              registeredApp.googlePlay.supportedLocales =
                appInfo.supportedLocales;
            }
          }
        } else if (appInfo.error) {
          console.error(
            `[MCP]   ⚠️ Failed to fetch Google Play locales: ${appInfo.error}`
          );
        }
      }
    }

    // Collect all unique supported locales
    const allSupportedLocales = new Set<string>();
    if (appStoreLocales.length > 0) {
      appStoreLocales.forEach((locale) => allSupportedLocales.add(locale));
    }
    if (googlePlayLocales.length > 0) {
      googlePlayLocales.forEach((locale) => allSupportedLocales.add(locale));
    }

    // Step 2: Check if all supported locales are provided
    const providedLocales = Object.keys(whatsNew);
    const missingLocales = Array.from(allSupportedLocales).filter(
      (locale) => !providedLocales.includes(locale)
    );

    // Step 3: Detect the language of provided whatsNew
    const providedText = Object.values(whatsNew)[0]; // Get first provided text
    const detectedLocale = providedLocales[0]; // Use first provided locale as detected locale

    // If not all supported locales are provided, request translation
    if (missingLocales.length > 0 && providedText) {
      // Step 3a: If detected locale is not sourceLocale, translate to sourceLocale first
      if (detectedLocale !== sourceLocale) {
        return {
          content: [
            {
              type: "text" as const,
              text: `🌐 Translation Pipeline Required

**Step 1: Translate to Default Locale**

**Detected Locale**: ${detectedLocale}
**Default Locale** (sourceLocale): ${sourceLocale}

**Text to translate** (${detectedLocale}):
${providedText}

**Instructions**:
1. First, translate the text from "${detectedLocale}" to "${sourceLocale}" (default locale)
2. Then, translate the ${sourceLocale} text to all missing supported locales
3. Call this function again with the \`whatsNew\` parameter containing all translations

**App Store Supported Locales** (${appStoreLocales.length}):
${appStoreLocales.length > 0 ? appStoreLocales.join(", ") : "N/A"}

**Google Play Supported Locales** (${googlePlayLocales.length}):
${googlePlayLocales.length > 0 ? googlePlayLocales.join(", ") : "N/A"}

**Provided Locales** (${providedLocales.length}):
${providedLocales.join(", ")}

**Missing Locales** (${missingLocales.length}):
${missingLocales.join(", ")}

**All Required Locales** (${Array.from(allSupportedLocales).length}):
${Array.from(allSupportedLocales).join(", ")}

Example:
\`\`\`json
{
  "app": "${slug}",
  "store": "${store}",
  "whatsNew": {
    "${detectedLocale}": "${providedText}",
    "${sourceLocale}": "Translated to default locale",
    "${missingLocales.join(`": "Translation", "`)}": "Translation",
    ...
  }
}
\`\`\`

Note: Provide translations for ALL supported locales including the ones already provided.`,
            },
          ],
          _meta: {
            translationPipeline: {
              step: 1,
              detectedLocale,
              sourceLocale,
              providedText,
              providedLocales,
              missingLocales: Array.from(missingLocales),
              allSupportedLocales: Array.from(allSupportedLocales),
              appStoreLocales,
              googlePlayLocales,
            },
            registeredApp,
            slug,
            store,
            versionId,
          },
        };
      }

      // Step 3b: If sourceLocale is already provided or detected, translate to all missing locales
      const hasSourceLocale =
        providedLocales.includes(sourceLocale) ||
        detectedLocale === sourceLocale;
      const sourceText = whatsNew[sourceLocale] || providedText;

      if (hasSourceLocale) {
        return {
          content: [
            {
              type: "text" as const,
              text: `🌐 Translation Required

**Step 2: Translate Default Locale to All Supported Locales**

**Source Text** (${sourceLocale}):
${sourceText}

**App Store Supported Locales** (${appStoreLocales.length}):
${appStoreLocales.length > 0 ? appStoreLocales.join(", ") : "N/A"}

**Google Play Supported Locales** (${googlePlayLocales.length}):
${googlePlayLocales.length > 0 ? googlePlayLocales.join(", ") : "N/A"}

**Already Provided Locales** (${providedLocales.length}):
${providedLocales.join(", ")}

**Missing Locales to Translate** (${missingLocales.length}):
${missingLocales.join(", ")}

**Instructions**:
Translate the ${sourceLocale} text to all missing supported locales and call this function again with the \`whatsNew\` parameter containing ALL translations (including the ones already provided).

Example:
\`\`\`json
{
  "app": "${slug}",
  "store": "${store}",
  "whatsNew": {
    "${providedLocales.join(`": "${whatsNew[providedLocales[0]]}", "`)}": "${whatsNew[providedLocales[0]]}",
    "${sourceLocale}": "${sourceText}",
    "${missingLocales.join(`": "Translation", "`)}": "Translation",
    ...
  }
}
\`\`\`

Note: Provide translations for ALL supported locales. Include the already provided translations as well.`,
            },
          ],
          _meta: {
            translationPipeline: {
              step: 2,
              sourceLocale,
              sourceText,
              providedLocales,
              missingLocales: Array.from(missingLocales),
              allSupportedLocales: Array.from(allSupportedLocales),
              appStoreLocales,
              googlePlayLocales,
            },
            registeredApp,
            slug,
            store,
            versionId,
          },
        };
      }
    }

    // All supported locales are provided, use directly
    finalWhatsNew = whatsNew;
  } else if (text) {
    // Step 1: Get supported locales for the app (from registered app or fetch from API)
    const config = loadConfig();
    let appStoreLocales: string[] = [];
    let googlePlayLocales: string[] = [];

    // Check if locales are already in registered app
    const {
      appStore: existingAppStoreLocales,
      googlePlay: existingGooglePlayLocales,
    } = collectSupportedLocales({ app: registeredApp, store });

    // If locales are missing, fetch from API
    if (includeAppStore && hasAppStore && bundleId) {
      if (existingAppStoreLocales.length > 0) {
        appStoreLocales = existingAppStoreLocales;
      } else if (config.appStore) {
        // Fetch from App Store API
        const appInfo = await appStoreService.fetchAppInfo(bundleId);

        if (appInfo.found) {
          if (appInfo.supportedLocales) {
            appStoreLocales = appInfo.supportedLocales;
            // Update registered app with fetched locales
            if (registeredApp.appStore) {
              registeredApp.appStore.supportedLocales =
                appInfo.supportedLocales;
            }
          }
        } else if (appInfo.error) {
          console.error(
            `[MCP]   ⚠️ Failed to fetch App Store locales: ${appInfo.error}`
          );
        }
      }
    }

    if (includeGooglePlay && hasGooglePlay && packageName) {
      if (existingGooglePlayLocales.length > 0) {
        googlePlayLocales = existingGooglePlayLocales;
      } else if (config.playStore?.serviceAccountJson) {
        // Fetch from Google Play API
        const appInfo = await googlePlayService.fetchAppInfo(packageName);

        if (appInfo.found) {
          if (appInfo.supportedLocales) {
            googlePlayLocales = appInfo.supportedLocales;
            // Update registered app with fetched locales
            if (registeredApp.googlePlay) {
              registeredApp.googlePlay.supportedLocales =
                appInfo.supportedLocales;
            }
          }
        } else if (appInfo.error) {
          console.error(
            `[MCP]   ⚠️ Failed to fetch Google Play locales: ${appInfo.error}`
          );
        }
      }
    }

    // Collect all unique locales that need translation
    const allLocales = new Set<string>();
    if (appStoreLocales.length > 0) {
      appStoreLocales.forEach((locale) => allLocales.add(locale));
    }
    if (googlePlayLocales.length > 0) {
      googlePlayLocales.forEach((locale) => allLocales.add(locale));
    }

    // If no locales found, return error
    if (allLocales.size === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ No supported locales found for the app. Please ensure the app is registered and has supported locales configured, or check authentication settings.`,
          },
        ],
      };
    }

    // Add source locale if not already in the set
    allLocales.add(sourceLocale);

    const targetLocales = Array.from(allLocales).filter(
      (locale) => locale !== sourceLocale
    );

    // Step 2: Return translation request
    // The calling LLM should perform the translation and call this function again with whatsNew
    return {
      content: [
        {
          type: "text" as const,
          text: `🌐 Translation Required

**Source Text** (${sourceLocale}):
${text}

**App Store Supported Locales** (${appStoreLocales.length}):
${appStoreLocales.length > 0 ? appStoreLocales.join(", ") : "N/A"}

**Google Play Supported Locales** (${googlePlayLocales.length}):
${googlePlayLocales.length > 0 ? googlePlayLocales.join(", ") : "N/A"}

**All Target Locales to Translate** (${targetLocales.length}):
${targetLocales.join(", ")}

**Instructions**:
Please translate the text to all target locales and call this function again with the \`whatsNew\` parameter containing all translations.

Example:
\`\`\`json
{
  "app": "${slug}",
  "store": "${store}",
  "whatsNew": {
    "${sourceLocale}": "${text}",
    "ko": "번역된 텍스트",
    "ko-KR": "번역된 텍스트",
    "en-US": "Translated text",
    ...
  }
}
\`\`\`

Note: App Store and Google Play may use different locale formats (e.g., "ko" vs "ko-KR"). Please provide translations for all supported locales.`,
        },
      ],
      _meta: {
        translationRequests: {
          appStore:
            appStoreLocales.length > 0
              ? {
                  sourceText: text,
                  sourceLocale,
                  targetLocales: appStoreLocales.filter(
                    (l) => l !== sourceLocale
                  ),
                  store: "appStore" as const,
                }
              : undefined,
          googlePlay:
            googlePlayLocales.length > 0
              ? {
                  sourceText: text,
                  sourceLocale,
                  targetLocales: googlePlayLocales.filter(
                    (l) => l !== sourceLocale
                  ),
                  store: "googlePlay" as const,
                }
              : undefined,
        },
        registeredApp,
        slug,
        store,
        versionId,
      },
    };
  } else {
    return {
      content: [
        {
          type: "text" as const,
          text: "❌ Either whatsNew or text is required. Provide whatsNew directly or text to translate to all supported languages.",
        },
      ],
    };
  }

  // Continue with update logic only if finalWhatsNew is set
  if (Object.keys(finalWhatsNew).length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "❌ No release notes to update.",
        },
      ],
    };
  }

  const config = loadConfig();

  console.error(`[MCP] 📝 Updating release notes`);
  console.error(`[MCP]   Store: ${store}`);
  console.error(`[MCP]   App: ${slug}`);
  if (packageName) console.error(`[MCP]   Package Name: ${packageName}`);
  if (bundleId) console.error(`[MCP]   Bundle ID: ${bundleId}`);
  if (versionId) console.error(`[MCP]   Version ID: ${versionId}`);

  const results: string[] = [];
  const appStoreResults: string[] = [];
  const googlePlayResults: string[] = [];

  // Separate translations by store
  const { appStore: appStoreTranslations, googlePlay: googlePlayTranslations } =
    separateTranslationsByStore({
      translations: finalWhatsNew,
      app: registeredApp,
      sourceLocale,
      store,
    });

  console.error(
    `[MCP]   📝 Locales to update: ${Object.keys(finalWhatsNew).length}`
  );
  if (Object.keys(appStoreTranslations).length > 0) {
    console.error(
      `[MCP]   🍎 App Store locales: ${Object.keys(appStoreTranslations).join(
        ", "
      )}`
    );
  }
  if (Object.keys(googlePlayTranslations).length > 0) {
    console.error(
      `[MCP]   🤖 Google Play locales: ${Object.keys(
        googlePlayTranslations
      ).join(", ")}`
    );
  }

  // App Store update
  if ((store === "both" || store === "appStore") && bundleId) {
    console.error(`[MCP]   📤 Updating App Store release notes...`);
    if (!config.appStore) {
      appStoreResults.push("❌ App Store authentication not configured.");
    } else if (Object.keys(appStoreTranslations).length === 0) {
      appStoreResults.push(
        "⚠️ No translations available for App Store locales."
      );
    } else {
      const updateResult = await appStoreService.updateReleaseNotes(
        bundleId,
        appStoreTranslations,
        versionId,
        registeredApp.appStore?.supportedLocales
      );

      if (!updateResult.success) {
        appStoreResults.push(
          `❌ App Store release notes update failed: ${updateResult.error}`
        );
      } else {
        console.error(
          `[MCP]     ✅ Updated ${updateResult.data.updated.length} locales`
        );
        appStoreResults.push(
          ...formatReleaseNotesUpdate("App Store", updateResult.data)
        );
      }
    }
  }

  // Google Play update
  if ((store === "both" || store === "googlePlay") && packageName) {
    if (!config.playStore?.serviceAccountJson) {
      googlePlayResults.push("❌ Google Play authentication not configured.");
    } else if (Object.keys(googlePlayTranslations).length === 0) {
      googlePlayResults.push(
        "⚠️ No translations available for Google Play locales."
      );
    } else {
      console.error(`[MCP]   📤 Updating Google Play release notes...`);
      const updateResult = await googlePlayService.updateReleaseNotes(
        packageName,
        googlePlayTranslations,
        "production",
        registeredApp.googlePlay?.supportedLocales
      );

      if (!updateResult.success) {
        googlePlayResults.push(
          `❌ Google Play release notes update failed: ${updateResult.error}`
        );
      } else {
        console.error(
          `[MCP]     ✅ Updated ${updateResult.data.updated.length} locales`
        );
        googlePlayResults.push(
          ...formatReleaseNotesUpdate("Google Play", updateResult.data)
        );
      }
    }
  }

  // Combine results
  if (appStoreResults.length > 0) {
    results.push(`**🍎 App Store:**`);
    results.push(...appStoreResults.map((r) => `  ${r}`));
  }
  if (googlePlayResults.length > 0) {
    results.push(`**🤖 Google Play:**`);
    results.push(...googlePlayResults.map((r) => `  ${r}`));
  }

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: "⚠️ No store to update. Please check bundleId or packageName.",
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `📝 Release Notes Update Results:\n\n${results.join("\n")}`,
      },
    ],
  };
}
