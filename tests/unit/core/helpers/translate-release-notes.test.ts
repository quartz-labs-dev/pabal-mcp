import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectSupportedLocales,
  createTranslationRequests,
  separateTranslationsByStore,
} from "@servers/mcp/core/helpers/translate-release-notes";
import type { RegisteredApp } from "@/packages/configs/secrets-config/registered-apps";

describe("translate-release-notes", () => {
  describe("collectSupportedLocales", () => {
    const mockApp: RegisteredApp = {
      slug: "test-app",
      name: "Test App",
      appStore: {
        bundleId: "com.example.test",
        supportedLocales: ["en-US", "ko", "ja"],
      },
      googlePlay: {
        packageName: "com.example.test",
        supportedLocales: ["en-US", "ko-KR", "ja-JP"],
      },
    };

    describe("Store: 'both'", () => {
      it("should return locales from both stores", () => {
        const result = collectSupportedLocales({
          app: mockApp,
          store: "both",
        });

        assert.deepEqual(result.appStore, ["en-US", "ko", "ja"]);
        assert.deepEqual(result.googlePlay, ["en-US", "ko-KR", "ja-JP"]);
      });
    });

    describe("Store: 'appStore'", () => {
      it("should return only App Store locales", () => {
        const result = collectSupportedLocales({
          app: mockApp,
          store: "appStore",
        });

        assert.deepEqual(result.appStore, ["en-US", "ko", "ja"]);
        assert.deepEqual(result.googlePlay, []);
      });
    });

    describe("Store: 'googlePlay'", () => {
      it("should return only Google Play locales", () => {
        const result = collectSupportedLocales({
          app: mockApp,
          store: "googlePlay",
        });

        assert.deepEqual(result.appStore, []);
        assert.deepEqual(result.googlePlay, ["en-US", "ko-KR", "ja-JP"]);
      });
    });

    describe("Missing Store Data", () => {
      it("should handle missing appStore data", () => {
        const appWithoutAppStore: RegisteredApp = {
          slug: "test-app",
          name: "Test App",
          googlePlay: {
            packageName: "com.example.test",
            supportedLocales: ["en-US"],
          },
        };

        const result = collectSupportedLocales({
          app: appWithoutAppStore,
          store: "both",
        });

        assert.deepEqual(result.appStore, []);
        assert.deepEqual(result.googlePlay, ["en-US"]);
      });

      it("should handle missing googlePlay data", () => {
        const appWithoutGooglePlay: RegisteredApp = {
          slug: "test-app",
          name: "Test App",
          appStore: {
            bundleId: "com.example.test",
            supportedLocales: ["en-US"],
          },
        };

        const result = collectSupportedLocales({
          app: appWithoutGooglePlay,
          store: "both",
        });

        assert.deepEqual(result.appStore, ["en-US"]);
        assert.deepEqual(result.googlePlay, []);
      });

      it("should handle missing supportedLocales array", () => {
        const appWithoutLocales: RegisteredApp = {
          slug: "test-app",
          name: "Test App",
          appStore: {
            bundleId: "com.example.test",
          },
          googlePlay: {
            packageName: "com.example.test",
          },
        };

        const result = collectSupportedLocales({
          app: appWithoutLocales,
          store: "both",
        });

        assert.deepEqual(result.appStore, []);
        assert.deepEqual(result.googlePlay, []);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty supportedLocales arrays", () => {
        const appWithEmptyLocales: RegisteredApp = {
          slug: "test-app",
          name: "Test App",
          appStore: {
            bundleId: "com.example.test",
            supportedLocales: [],
          },
          googlePlay: {
            packageName: "com.example.test",
            supportedLocales: [],
          },
        };

        const result = collectSupportedLocales({
          app: appWithEmptyLocales,
          store: "both",
        });

        assert.deepEqual(result.appStore, []);
        assert.deepEqual(result.googlePlay, []);
      });
    });
  });

  describe("createTranslationRequests", () => {
    const sourceLocale = "en-US";
    const sourceText = "Bug fixes";

    it("should create separate requests when both stores have targets", () => {
      const result = createTranslationRequests({
        store: "both",
        targetLocales: {
          appStore: ["ko", "ja"],
          googlePlay: ["ko-KR"],
        },
        sourceLocale,
        sourceText,
      });

      assert.deepEqual(result, [
        {
          store: "appStore",
          sourceText,
          sourceLocale,
          targetLocales: ["ko", "ja"],
        },
        {
          store: "googlePlay",
          sourceText,
          sourceLocale,
          targetLocales: ["ko-KR"],
        },
      ]);
    });

    it("should return empty array when no target locales are provided", () => {
      const result = createTranslationRequests({
        store: "both",
        targetLocales: {
          appStore: [],
          googlePlay: [],
        },
        sourceLocale,
        sourceText,
      });

      assert.deepEqual(result, []);
    });
  });

  describe("separateTranslationsByStore", () => {
    const mockApp: RegisteredApp = {
      slug: "test-app",
      name: "Test App",
      appStore: {
        bundleId: "com.example.test",
        supportedLocales: ["en-US", "ko", "ja"],
      },
      googlePlay: {
        packageName: "com.example.test",
        supportedLocales: ["en-US", "ko-KR", "ja-JP"],
      },
    };

    describe("Store: 'both'", () => {
      it("should distribute translations to both stores based on supported locales", () => {
        const translations = {
          "en-US": "Bug fixes",
          ko: "버그 수정",
          "ko-KR": "버그 수정",
          ja: "バグ修正",
          "ja-JP": "バグ修正",
        };

        const result = separateTranslationsByStore({
          store: "both",
          translations,
          app: mockApp,
          sourceLocale: "en-US",
        });

        assert.deepEqual(result.appStore, {
          "en-US": "Bug fixes",
          ko: "버그 수정",
          ja: "バグ修正",
        });
        assert.deepEqual(result.googlePlay, {
          "en-US": "Bug fixes",
          "ko-KR": "버그 수정",
          "ja-JP": "バグ修正",
        });
      });

      it("should filter out unsupported locales", () => {
        const translations = {
          "en-US": "Bug fixes",
          fr: "Corrections de bugs", // Not supported
          de: "Fehlerbehebungen", // Not supported
        };

        const result = separateTranslationsByStore({
          store: "both",
          translations,
          app: mockApp,
          sourceLocale: "en-US",
        });

        assert.deepEqual(result.appStore, {
          "en-US": "Bug fixes",
        });
        assert.deepEqual(result.googlePlay, {
          "en-US": "Bug fixes",
        });
      });
    });

    describe("Store: 'appStore'", () => {
      it("should only include App Store translations", () => {
        const translations = {
          "en-US": "Bug fixes",
          ko: "버그 수정",
          "ko-KR": "버그 수정",
        };

        const result = separateTranslationsByStore({
          store: "appStore",
          translations,
          app: mockApp,
          sourceLocale: "en-US",
        });

        assert.deepEqual(result.appStore, {
          "en-US": "Bug fixes",
          ko: "버그 수정",
        });
        assert.deepEqual(result.googlePlay, {});
      });
    });

    describe("Store: 'googlePlay'", () => {
      it("should only include Google Play translations", () => {
        const translations = {
          "en-US": "Bug fixes",
          ko: "버그 수정",
          "ko-KR": "버그 수정",
        };

        const result = separateTranslationsByStore({
          store: "googlePlay",
          translations,
          app: mockApp,
          sourceLocale: "en-US",
        });

        assert.deepEqual(result.appStore, {});
        assert.deepEqual(result.googlePlay, {
          "en-US": "Bug fixes",
          "ko-KR": "버그 수정",
        });
      });
    });

    describe("Source Locale Handling", () => {
      it("should always include sourceLocale if provided and missing", () => {
        const translations = {
          "en-US": "Bug fixes",
          ko: "버그 수정",
        };

        const appWithMissingSourceLocale: RegisteredApp = {
          ...mockApp,
          appStore: {
            bundleId: "com.example.test",
            supportedLocales: ["ko", "ja"], // en-US not in list
          },
        };

        const result = separateTranslationsByStore({
          store: "appStore",
          translations,
          app: appWithMissingSourceLocale,
          sourceLocale: "en-US",
        });

        // Should include sourceLocale even though it's not in supportedLocales
        assert.deepEqual(result.appStore, {
          "en-US": "Bug fixes",
          ko: "버그 수정",
        });
      });

      it("should not duplicate sourceLocale if already included", () => {
        const translations = {
          "en-US": "Bug fixes",
          ko: "버그 수정",
        };

        const result = separateTranslationsByStore({
          store: "both",
          translations,
          app: mockApp,
          sourceLocale: "en-US",
        });

        // Count occurrences of en-US
        const appStoreKeys = Object.keys(result.appStore);
        const googlePlayKeys = Object.keys(result.googlePlay);

        assert.equal(appStoreKeys.filter((k) => k === "en-US").length, 1);
        assert.equal(googlePlayKeys.filter((k) => k === "en-US").length, 1);
      });

      it("should not add sourceLocale if not in translations", () => {
        const translations = {
          ko: "버그 수정",
          ja: "バグ修正",
        };

        const result = separateTranslationsByStore({
          store: "both",
          translations,
          app: mockApp,
          sourceLocale: "en-US",
        });

        assert.ok(!("en-US" in result.appStore));
        assert.ok(!("en-US" in result.googlePlay));
      });
    });

    describe("Missing Supported Locales", () => {
      it("should include all translations when supportedLocales is undefined", () => {
        const appWithoutLocales: RegisteredApp = {
          slug: "test-app",
          name: "Test App",
          appStore: {
            bundleId: "com.example.test",
            // No supportedLocales
          },
          googlePlay: {
            packageName: "com.example.test",
            // No supportedLocales
          },
        };

        const translations = {
          "en-US": "Bug fixes",
          ko: "버그 수정",
          fr: "Corrections",
        };

        const result = separateTranslationsByStore({
          store: "both",
          translations,
          app: appWithoutLocales,
          sourceLocale: "en-US",
        });

        // Should include all translations when no supported locales defined
        assert.deepEqual(result.appStore, translations);
        assert.deepEqual(result.googlePlay, translations);
      });
    });

    describe("Empty Inputs", () => {
      it("should handle empty translations object", () => {
        const result = separateTranslationsByStore({
          store: "both",
          translations: {},
          app: mockApp,
          sourceLocale: "en-US",
        });

        assert.deepEqual(result.appStore, {});
        assert.deepEqual(result.googlePlay, {});
      });

      it("should handle empty supportedLocales arrays", () => {
        const appWithEmptyLocales: RegisteredApp = {
          slug: "test-app",
          name: "Test App",
          appStore: {
            bundleId: "com.example.test",
            supportedLocales: [],
          },
          googlePlay: {
            packageName: "com.example.test",
            supportedLocales: [],
          },
        };

        const translations = {
          "en-US": "Bug fixes",
          ko: "버그 수정",
        };

        const result = separateTranslationsByStore({
          store: "both",
          translations,
          app: appWithEmptyLocales,
          sourceLocale: "en-US",
        });

        // Should filter out all locales (none are supported)
        assert.deepEqual(result.appStore, {
          "en-US": "Bug fixes", // Added because it's sourceLocale
        });
        assert.deepEqual(result.googlePlay, {
          "en-US": "Bug fixes", // Added because it's sourceLocale
        });
      });
    });

    describe("Complex Scenarios", () => {
      it("should handle store-specific locale formats", () => {
        const translations = {
          "en-US": "Bug fixes",
          ko: "버그 수정", // App Store format
          "ko-KR": "버그 수정", // Google Play format
        };

        const result = separateTranslationsByStore({
          store: "both",
          translations,
          app: mockApp,
          sourceLocale: "en-US",
        });

        // Each store gets its own locale format
        assert.ok("ko" in result.appStore);
        assert.ok(!("ko-KR" in result.appStore));
        assert.ok("ko-KR" in result.googlePlay);
        assert.ok(!("ko" in result.googlePlay));
      });

      it("should maintain translation text integrity", () => {
        const translations = {
          "en-US": "Original text with special chars: !@#$%",
          ko: "특수 문자가 포함된 원본 텍스트: !@#$%",
        };

        const result = separateTranslationsByStore({
          store: "both",
          translations,
          app: mockApp,
          sourceLocale: "en-US",
        });

        // Text should not be modified
        assert.equal(
          result.appStore["en-US"],
          "Original text with special chars: !@#$%"
        );
        assert.equal(
          result.appStore["ko"],
          "특수 문자가 포함된 원본 텍스트: !@#$%"
        );
      });
    });
  });
});
