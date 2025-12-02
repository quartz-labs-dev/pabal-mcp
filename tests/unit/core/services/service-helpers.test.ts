import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkPushPrerequisites } from "@servers/mcp/core/services/service-helpers";

describe("service-helpers", () => {
  describe("checkPushPrerequisites", () => {
    const baseArgs = {
      storeLabel: "App Store",
      configured: true,
      identifierLabel: "Bundle ID",
      identifier: "com.example.app",
      hasData: true,
    };

    describe("Success Cases (returns null)", () => {
      it("should return null when all prerequisites are met", () => {
        const result = checkPushPrerequisites(baseArgs);

        assert.equal(result, null);
      });

      it("should return null when all prerequisites are met without dataPath", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          dataPath: undefined,
        });

        assert.equal(result, null);
      });

      it("should return null when all prerequisites are met with dataPath provided", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          dataPath: "/path/to/data.json",
        });

        assert.equal(result, null);
      });
    });

    describe("Configuration Not Configured Cases", () => {
      it("should return skip message when not configured", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          configured: false,
        });

        assert.ok(result !== null);
        assert.ok(result!.includes("⏭️"));
        assert.ok(result!.includes("Skipping"));
        assert.ok(result!.includes("App Store"));
        assert.ok(result!.includes("not configured"));
        assert.ok(result!.includes("secrets/aso-config.json"));
      });

      it("should use correct store label in skip message", () => {
        const appStoreResult = checkPushPrerequisites({
          ...baseArgs,
          storeLabel: "App Store",
          configured: false,
        });

        const googlePlayResult = checkPushPrerequisites({
          ...baseArgs,
          storeLabel: "Google Play",
          configured: false,
        });

        assert.ok(appStoreResult!.includes("App Store"));
        assert.ok(!appStoreResult!.includes("Google Play"));
        assert.ok(googlePlayResult!.includes("Google Play"));
        assert.ok(!googlePlayResult!.includes("App Store"));
      });

      it("should skip further checks when not configured", () => {
        // Even if identifier and data are missing, should return configuration error first
        const result = checkPushPrerequisites({
          ...baseArgs,
          configured: false,
          identifier: undefined,
          hasData: false,
        });

        assert.ok(result!.includes("not configured"));
        assert.ok(!result!.includes("no Bundle ID"));
        assert.ok(!result!.includes("no data"));
      });
    });

    describe("Identifier Missing Cases", () => {
      it("should return skip message when identifier is undefined", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          identifier: undefined,
        });

        assert.ok(result !== null);
        assert.ok(result!.includes("⏭️"));
        assert.ok(result!.includes("Skipping"));
        assert.ok(result!.includes("App Store"));
        assert.ok(result!.includes("no Bundle ID provided"));
      });

      it("should use correct identifier label in skip message", () => {
        const bundleIdResult = checkPushPrerequisites({
          ...baseArgs,
          identifierLabel: "Bundle ID",
          identifier: undefined,
        });

        const packageNameResult = checkPushPrerequisites({
          ...baseArgs,
          identifierLabel: "Package Name",
          identifier: undefined,
        });

        assert.ok(bundleIdResult!.includes("Bundle ID"));
        assert.ok(!bundleIdResult!.includes("Package Name"));
        assert.ok(packageNameResult!.includes("Package Name"));
        assert.ok(!packageNameResult!.includes("Bundle ID"));
      });

      it("should skip data check when identifier is missing", () => {
        // Even if data is missing, should return identifier error first
        const result = checkPushPrerequisites({
          ...baseArgs,
          identifier: undefined,
          hasData: false,
        });

        assert.ok(result!.includes("no Bundle ID"));
        assert.ok(!result!.includes("no data"));
      });
    });

    describe("Data Missing Cases", () => {
      it("should return skip message when data is missing", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          hasData: false,
        });

        assert.ok(result !== null);
        assert.ok(result!.includes("⏭️"));
        assert.ok(result!.includes("Skipping"));
        assert.ok(result!.includes("App Store"));
        assert.ok(result!.includes("no data found"));
      });

      it("should include store label in data missing message", () => {
        const appStoreResult = checkPushPrerequisites({
          ...baseArgs,
          storeLabel: "App Store",
          hasData: false,
        });

        const googlePlayResult = checkPushPrerequisites({
          ...baseArgs,
          storeLabel: "Google Play",
          hasData: false,
        });

        assert.ok(appStoreResult!.includes("App Store"));
        assert.ok(!appStoreResult!.includes("Google Play"));
        assert.ok(googlePlayResult!.includes("Google Play"));
        assert.ok(!googlePlayResult!.includes("App Store"));
      });

      it("should not reference dataPath when not provided", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          hasData: false,
          dataPath: undefined,
        });

        assert.ok(result!.includes("no data found"));
        // Should not throw, just return error message without path reference
        assert.ok(result !== null);
      });
    });

    describe("Priority Order", () => {
      it("should check configuration first (before identifier)", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          configured: false,
          identifier: undefined,
        });

        assert.ok(result!.includes("not configured"));
        assert.ok(!result!.includes("Bundle ID"));
      });

      it("should check identifier second (before data)", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          identifier: undefined,
          hasData: false,
        });

        assert.ok(result!.includes("Bundle ID"));
        assert.ok(!result!.includes("data"));
      });

      it("should check data last", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          hasData: false,
        });

        assert.ok(result!.includes("data"));
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty string identifier as missing", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          identifier: "",
        });

        // Empty string is falsy in JavaScript, so it's treated as missing identifier
        assert.ok(result !== null);
        assert.ok(result!.includes("no Bundle ID provided"));
      });

      it("should handle whitespace-only storeLabel", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          storeLabel: "   ",
          configured: false,
        });

        assert.ok(result!.includes("Skipping"));
        assert.ok(result!.includes("   "));
      });

      it("should return consistent results for same input", () => {
        const result1 = checkPushPrerequisites(baseArgs);
        const result2 = checkPushPrerequisites(baseArgs);

        assert.equal(result1, result2);
      });

      it("should handle all failures combined (worst case)", () => {
        const result = checkPushPrerequisites({
          storeLabel: "App Store",
          configured: false,
          identifierLabel: "Bundle ID",
          identifier: undefined,
          hasData: false,
          dataPath: "/path/to/data.json",
        });

        // Should return first failure (configuration)
        assert.ok(result!.includes("not configured"));
        assert.ok(!result!.includes("Bundle ID"));
        assert.ok(!result!.includes("data"));
      });
    });

    describe("Return Type Validation", () => {
      it("should return string when prerequisites not met", () => {
        const result = checkPushPrerequisites({
          ...baseArgs,
          configured: false,
        });

        assert.equal(typeof result, "string");
        assert.ok(result!.length > 0);
      });

      it("should return null (not undefined or empty string) when prerequisites met", () => {
        const result = checkPushPrerequisites(baseArgs);

        assert.strictEqual(result, null);
      });
    });
  });
});
