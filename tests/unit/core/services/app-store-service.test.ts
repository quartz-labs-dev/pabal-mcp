import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AppStoreService,
  resolveAppStoreLocales,
} from "@/core/services/app-store-service";
import type { ServiceResult } from "@/core/services/types";
import type { AppStoreClient } from "@/packages/stores/app-store/client";

const createEditableVersion = () => [
  {
    id: "version-1",
    attributes: { appStoreState: "PREPARE_FOR_SUBMISSION" },
  },
];

class TestAppStoreService extends AppStoreService {
  constructor(private readonly client: AppStoreClient) {
    super();
  }

  override createClient(): ServiceResult<AppStoreClient> {
    return { success: true, data: this.client };
  }
}

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

  describe("updateReleaseNotes", () => {
    it("should update App Store release notes with bounded concurrency", async () => {
      const locales = Array.from(
        { length: 10 },
        (_, index) => `locale-${index}`
      );
      let activeUpdates = 0;
      let maxActiveUpdates = 0;

      const client = {
        getAllVersions: async () => createEditableVersion(),
        updateWhatsNew: async () => {
          activeUpdates += 1;
          maxActiveUpdates = Math.max(maxActiveUpdates, activeUpdates);
          await new Promise((resolve) => setTimeout(resolve, 20));
          activeUpdates -= 1;
        },
      } as unknown as AppStoreClient;

      const service = new TestAppStoreService(client);
      const result = await service.updateReleaseNotes(
        "com.example.app",
        Object.fromEntries(locales.map((locale) => [locale, "Updated notes"]))
      );

      assert.equal(result.success, true);
      if (!result.success) return;
      assert.deepEqual(result.data.updated, locales);
      assert.equal(maxActiveUpdates, 5);
    });

    it("should continue updating remaining locales after one locale fails", async () => {
      const locales = ["en-US", "ko", "ja", "fr-FR", "de-DE", "es-ES"];
      const attemptedLocales: string[] = [];

      const client = {
        getAllVersions: async () => createEditableVersion(),
        updateWhatsNew: async ({ locale }: { locale: string }) => {
          attemptedLocales.push(locale);
          if (locale === "ja") throw new Error("App Store rejected locale");
        },
      } as unknown as AppStoreClient;

      const service = new TestAppStoreService(client);
      const result = await service.updateReleaseNotes(
        "com.example.app",
        Object.fromEntries(locales.map((locale) => [locale, "Updated notes"]))
      );

      assert.equal(result.success, false);
      assert.deepEqual(attemptedLocales.sort(), [...locales].sort());
    });
  });
});
