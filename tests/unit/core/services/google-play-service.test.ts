import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveGooglePlayLocales,
  shouldPushGooglePlayAppDetails,
} from "@/core/services/google-play-service";

describe("google-play-service", () => {
  describe("resolveGooglePlayLocales", () => {
    it("should return every locale when no allowlist is provided", () => {
      const result = resolveGooglePlayLocales(["en-US", "ko-KR"]);

      assert.deepEqual(result, {
        localesToPush: ["en-US", "ko-KR"],
        missingLocales: [],
      });
    });

    it("should return only requested locales that exist locally", () => {
      const result = resolveGooglePlayLocales(
        ["en-US", "ko-KR", "ja-JP"],
        ["ko-KR"]
      );

      assert.deepEqual(result, {
        localesToPush: ["ko-KR"],
        missingLocales: [],
      });
    });

    it("should report requested locales missing from local ASO data", () => {
      const result = resolveGooglePlayLocales(
        ["en-US", "ko-KR"],
        ["ko-KR", "fr-FR"]
      );

      assert.deepEqual(result, {
        localesToPush: ["ko-KR"],
        missingLocales: ["fr-FR"],
      });
    });
  });

  describe("shouldPushGooglePlayAppDetails", () => {
    it("should push app details for full pushes with contact details", () => {
      const result = shouldPushGooglePlayAppDetails({
        hasContactDetails: true,
      });

      assert.equal(result, true);
    });

    it("should skip app details for partial locale pushes", () => {
      const result = shouldPushGooglePlayAppDetails({
        hasContactDetails: true,
        requestedLocales: ["ko-KR"],
      });

      assert.equal(result, false);
    });

    it("should skip app details when there are no contact details", () => {
      const result = shouldPushGooglePlayAppDetails({
        hasContactDetails: false,
      });

      assert.equal(result, false);
    });
  });
});
