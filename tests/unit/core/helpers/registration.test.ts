import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toRegisteredAppStoreInfo,
  toRegisteredGooglePlayInfo,
} from "@servers/mcp/core/helpers/registration";

describe("registration", () => {
  describe("toRegisteredAppStoreInfo", () => {
    const bundleId = "com.example.test";

    it("should return undefined when app is not found", () => {
      const result = toRegisteredAppStoreInfo({
        bundleId,
        appInfo: { found: false },
      });

      assert.equal(result, undefined);
    });

    it("should return complete info when all fields present", () => {
      const result = toRegisteredAppStoreInfo({
        bundleId,
        appInfo: {
          found: true,
          appId: "123456",
          name: "Test App",
          supportedLocales: ["en-US", "ko"],
        },
      });

      assert.deepEqual(result, {
        bundleId,
        appId: "123456",
        name: "Test App",
        supportedLocales: ["en-US", "ko"],
      });
    });

    it("should handle missing optional fields", () => {
      const result = toRegisteredAppStoreInfo({
        bundleId,
        appInfo: {
          found: true,
        },
      });

      assert.deepEqual(result, {
        bundleId,
        appId: undefined,
        name: undefined,
        supportedLocales: undefined,
      });
    });

    it("should preserve bundleId from parameter", () => {
      const result = toRegisteredAppStoreInfo({
        bundleId: "com.custom.bundle",
        appInfo: {
          found: true,
          name: "Test",
        },
      });

      assert.equal(result?.bundleId, "com.custom.bundle");
    });

    it("should handle empty supportedLocales array", () => {
      const result = toRegisteredAppStoreInfo({
        bundleId,
        appInfo: {
          found: true,
          supportedLocales: [],
        },
      });

      assert.deepEqual(result?.supportedLocales, []);
    });
  });

  describe("toRegisteredGooglePlayInfo", () => {
    const packageName = "com.example.test";

    it("should return undefined when app is not found", () => {
      const result = toRegisteredGooglePlayInfo({
        packageName,
        appInfo: { found: false },
      });

      assert.equal(result, undefined);
    });

    it("should return complete info when all fields present", () => {
      const result = toRegisteredGooglePlayInfo({
        packageName,
        appInfo: {
          found: true,
          name: "Test App",
          supportedLocales: ["en-US", "ko-KR"],
        },
      });

      assert.deepEqual(result, {
        packageName,
        name: "Test App",
        supportedLocales: ["en-US", "ko-KR"],
      });
    });

    it("should handle missing optional fields", () => {
      const result = toRegisteredGooglePlayInfo({
        packageName,
        appInfo: {
          found: true,
        },
      });

      assert.deepEqual(result, {
        packageName,
        name: undefined,
        supportedLocales: undefined,
      });
    });

    it("should preserve packageName from parameter", () => {
      const result = toRegisteredGooglePlayInfo({
        packageName: "com.custom.package",
        appInfo: {
          found: true,
          name: "Test",
        },
      });

      assert.equal(result?.packageName, "com.custom.package");
    });

    it("should handle empty supportedLocales array", () => {
      const result = toRegisteredGooglePlayInfo({
        packageName,
        appInfo: {
          found: true,
          supportedLocales: [],
        },
      });

      assert.deepEqual(result?.supportedLocales, []);
    });
  });

  describe("Consistency between stores", () => {
    it("should handle not found consistently", () => {
      const appStoreResult = toRegisteredAppStoreInfo({
        bundleId: "com.test",
        appInfo: { found: false },
      });

      const googlePlayResult = toRegisteredGooglePlayInfo({
        packageName: "com.test",
        appInfo: { found: false },
      });

      assert.equal(appStoreResult, undefined);
      assert.equal(googlePlayResult, undefined);
    });

    it("should preserve structure when found", () => {
      const appStoreResult = toRegisteredAppStoreInfo({
        bundleId: "com.test",
        appInfo: {
          found: true,
          name: "Test",
          supportedLocales: ["en-US"],
        },
      });

      const googlePlayResult = toRegisteredGooglePlayInfo({
        packageName: "com.test",
        appInfo: {
          found: true,
          name: "Test",
          supportedLocales: ["en-US"],
        },
      });

      assert.ok(appStoreResult);
      assert.ok(googlePlayResult);
      assert.equal(appStoreResult.name, googlePlayResult.name);
      assert.deepEqual(
        appStoreResult.supportedLocales,
        googlePlayResult.supportedLocales
      );
    });
  });
});
