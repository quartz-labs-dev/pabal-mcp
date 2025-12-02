import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatPushResult,
  formatReleaseNotesUpdate,
} from "@servers/mcp/core/helpers/formatters";
import type { PushAsoResult } from "@servers/mcp/core/services/types";

describe("formatters", () => {
  describe("formatPushResult", () => {
    describe("Success Cases", () => {
      it("should format complete success with multiple locales", () => {
        const result: PushAsoResult = {
          success: true,
          localesPushed: ["en-US", "ko-KR", "ja-JP"],
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("✅"));
        assert.ok(formatted.includes("App Store"));
        assert.ok(formatted.includes("3 locales"));
      });

      it("should format success with single locale", () => {
        const result: PushAsoResult = {
          success: true,
          localesPushed: ["en-US"],
        };

        const formatted = formatPushResult("Google Play", result);

        assert.ok(formatted.includes("✅"));
        assert.ok(formatted.includes("Google Play"));
        assert.ok(formatted.includes("1 locales"));
      });

      it("should distinguish between App Store and Google Play labels", () => {
        const result: PushAsoResult = {
          success: true,
          localesPushed: ["en-US"],
        };

        const appStoreFormatted = formatPushResult("App Store", result);
        const googlePlayFormatted = formatPushResult("Google Play", result);

        assert.ok(appStoreFormatted.includes("App Store"));
        assert.ok(!appStoreFormatted.includes("Google Play"));
        assert.ok(googlePlayFormatted.includes("Google Play"));
        assert.ok(!googlePlayFormatted.includes("App Store"));
      });
    });

    describe("Partial Success Cases", () => {
      it("should format partial success with failed fields", () => {
        const result: PushAsoResult = {
          success: true,
          localesPushed: ["en-US", "ko-KR"],
          failedFields: [
            { locale: "en-US", fields: ["name"] },
            { locale: "ko-KR", fields: ["subtitle"] },
          ],
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("⚠️"));
        assert.ok(formatted.includes("partial failures"));
        assert.ok(formatted.includes("2 locales"));
        assert.ok(formatted.includes("en-US"));
        assert.ok(formatted.includes("ko-KR"));
      });

      it("should format multiple failed fields in same locale", () => {
        const result: PushAsoResult = {
          success: true,
          localesPushed: ["en-US"],
          failedFields: [{ locale: "en-US", fields: ["name", "subtitle"] }],
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("⚠️"));
        assert.ok(formatted.includes("en-US"));
        assert.ok(formatted.includes("Name"));
        assert.ok(formatted.includes("Subtitle"));
      });

      it("should format unknown field names as-is", () => {
        const result: PushAsoResult = {
          success: true,
          localesPushed: ["en-US"],
          failedFields: [{ locale: "en-US", fields: ["unknownField"] }],
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("unknownField"));
      });

      it("should handle empty failedFields array (treat as complete success)", () => {
        const result: PushAsoResult = {
          success: true,
          localesPushed: ["en-US"],
          failedFields: [],
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("✅"));
        assert.ok(!formatted.includes("⚠️"));
        assert.ok(!formatted.includes("partial"));
      });
    });

    describe("Failure Cases", () => {
      it("should format simple failure", () => {
        const result: PushAsoResult = {
          success: false,
          error: "Network timeout",
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("❌"));
        assert.ok(formatted.includes("App Store"));
        assert.ok(formatted.includes("push failed"));
        assert.ok(formatted.includes("Network timeout"));
      });

      it("should format failure with different store label", () => {
        const result: PushAsoResult = {
          success: false,
          error: "Authentication failed",
        };

        const formatted = formatPushResult("Google Play", result);

        assert.ok(formatted.includes("❌"));
        assert.ok(formatted.includes("Google Play"));
        assert.ok(formatted.includes("Authentication failed"));
      });

      it("should format failure due to missing version", () => {
        const result: PushAsoResult = {
          success: false,
          error: "No editable version found",
          needsNewVersion: false,
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("❌"));
        assert.ok(formatted.includes("No editable version found"));
      });
    });

    describe("New Version Created Cases", () => {
      it("should format new version creation success", () => {
        const result: PushAsoResult = {
          success: false,
          error: "",
          needsNewVersion: true,
          versionInfo: {
            versionId: "abc123",
            versionString: "1.2.3",
            locales: ["en-US"],
          },
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("✅"));
        assert.ok(formatted.includes("New version"));
        assert.ok(formatted.includes("1.2.3"));
        assert.ok(formatted.includes("abc123"));
        assert.ok(!formatted.includes("failed"));
      });

      it("should not show version creation without versionInfo", () => {
        const result: PushAsoResult = {
          success: false,
          error: "Some error",
          needsNewVersion: true,
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("❌"));
        assert.ok(!formatted.includes("New version"));
        assert.ok(formatted.includes("Some error"));
      });

      it("should not show version creation without needsNewVersion flag", () => {
        const result: PushAsoResult = {
          success: false,
          error: "Some error",
          versionInfo: {
            versionId: "abc123",
            versionString: "1.2.3",
            locales: ["en-US"],
          },
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("❌"));
        assert.ok(!formatted.includes("New version"));
        assert.ok(formatted.includes("Some error"));
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty error message", () => {
        const result: PushAsoResult = {
          success: false,
          error: "",
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("❌"));
        assert.ok(formatted.includes("App Store"));
      });

      it("should handle empty localesPushed array", () => {
        const result: PushAsoResult = {
          success: true,
          localesPushed: [],
        };

        const formatted = formatPushResult("App Store", result);

        assert.ok(formatted.includes("✅"));
        assert.ok(formatted.includes("0 locales"));
      });

      it("should return consistent format for same input", () => {
        const result: PushAsoResult = {
          success: true,
          localesPushed: ["en-US"],
        };

        const formatted1 = formatPushResult("App Store", result);
        const formatted2 = formatPushResult("App Store", result);

        assert.equal(formatted1, formatted2);
      });
    });
  });

  describe("formatReleaseNotesUpdate", () => {
    it("should include updated and failed entries with proper formatting", () => {
      const result = formatReleaseNotesUpdate("App Store", {
        updated: ["en-US", "ko"],
        failed: [
          { locale: "ja", error: "Missing data" },
          { locale: "fr", error: "Network error" },
        ],
      });

      assert.deepEqual(result, [
        "**App Store**",
        "  ✅ Updated: en-US, ko",
        "  ❌ ja: Missing data",
        "  ❌ fr: Network error",
      ]);
    });

    it("should return only header when nothing was updated or failed", () => {
      const result = formatReleaseNotesUpdate("Google Play", {
        updated: [],
        failed: [],
      });

      assert.deepEqual(result, ["**Google Play**"]);
    });
  });
});
