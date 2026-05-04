import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAppStoreLocales } from "@/core/services/app-store-service";

describe("app-store-service", () => {
  describe("resolveAppStoreLocales", () => {
    it("should return every locale when no allowlist is provided", () => {
      const result = resolveAppStoreLocales(["en-US", "ko-KR"]);

      assert.deepEqual(result, {
        localesToPush: ["en-US", "ko-KR"],
        missingLocales: [],
      });
    });

    it("should return only requested locales that exist locally", () => {
      const result = resolveAppStoreLocales(
        ["en-US", "ko-KR", "ja-JP"],
        ["ko-KR"]
      );

      assert.deepEqual(result, {
        localesToPush: ["ko-KR"],
        missingLocales: [],
      });
    });

    it("should report requested locales missing from local ASO data", () => {
      const result = resolveAppStoreLocales(
        ["en-US", "ko-KR"],
        ["ko-KR", "fr-FR"]
      );

      assert.deepEqual(result, {
        localesToPush: ["ko-KR"],
        missingLocales: ["fr-FR"],
      });
    });
  });
});
