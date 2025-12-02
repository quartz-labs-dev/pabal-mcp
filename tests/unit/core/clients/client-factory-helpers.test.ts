import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  success,
  failure,
  toErrorMessage,
  isNonEmptyString,
} from "@servers/mcp/core/clients/client-factory-helpers";

describe("client-factory-helpers", () => {
  describe("success", () => {
    it("should create success result with client", () => {
      const client = { id: "test-client" };
      const result = success(client);

      assert.equal(result.success, true);
      if (result.success) {
        assert.deepEqual(result.client, client);
        assert.ok(!("error" in result));
      }
    });

    it("should work with different client types", () => {
      const stringClient = "string-client";
      const numberClient = 123;
      const objectClient = { data: "test" };

      const result1 = success(stringClient);
      const result2 = success(numberClient);
      const result3 = success(objectClient);

      assert.equal(result1.success, true);
      assert.equal(result2.success, true);
      assert.equal(result3.success, true);
    });

    it("should preserve client reference", () => {
      const client = { value: "test" };
      const result = success(client);

      if (result.success) {
        assert.strictEqual(result.client, client);
      }
    });
  });

  describe("failure", () => {
    it("should create failure result with error message", () => {
      const errorMessage = "Connection failed";
      const result = failure(errorMessage);

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error, errorMessage);
        assert.ok(!("client" in result));
      }
    });

    it("should handle different error messages", () => {
      const result1 = failure("Error 1");
      const result2 = failure("Error 2");

      if (!result1.success && !result2.success) {
        assert.equal(result1.error, "Error 1");
        assert.equal(result2.error, "Error 2");
      }
    });

    it("should handle empty error message", () => {
      const result = failure("");

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error, "");
      }
    });
  });

  describe("toErrorMessage", () => {
    it("should extract message from Error instance", () => {
      const error = new Error("Test error message");
      const message = toErrorMessage(error);

      assert.equal(message, "Test error message");
    });

    it("should handle TypeError", () => {
      const error = new TypeError("Type error message");
      const message = toErrorMessage(error);

      assert.equal(message, "Type error message");
    });

    it("should convert string to string", () => {
      const message = toErrorMessage("Plain string error");

      assert.equal(message, "Plain string error");
    });

    it("should convert number to string", () => {
      const message = toErrorMessage(404);

      assert.equal(message, "404");
    });

    it("should convert boolean to string", () => {
      const message1 = toErrorMessage(true);
      const message2 = toErrorMessage(false);

      assert.equal(message1, "true");
      assert.equal(message2, "false");
    });

    it("should handle null", () => {
      const message = toErrorMessage(null);

      assert.equal(message, "null");
    });

    it("should handle undefined", () => {
      const message = toErrorMessage(undefined);

      assert.equal(message, "undefined");
    });

    it("should convert object to string", () => {
      const message = toErrorMessage({ code: 500 });

      assert.ok(message.includes("object"));
    });

    it("should handle Error with empty message", () => {
      const error = new Error("");
      const message = toErrorMessage(error);

      assert.equal(message, "");
    });
  });

  describe("isNonEmptyString", () => {
    describe("Valid strings (returns true)", () => {
      it("should return true for non-empty string", () => {
        assert.equal(isNonEmptyString("hello"), true);
      });

      it("should return true for string with multiple words", () => {
        assert.equal(isNonEmptyString("hello world"), true);
      });

      it("should return true for string with special characters", () => {
        assert.equal(isNonEmptyString("test@example.com"), true);
      });

      it("should return true for string with numbers", () => {
        assert.equal(isNonEmptyString("test123"), true);
      });

      it("should return true for string with unicode", () => {
        assert.equal(isNonEmptyString("안녕하세요"), true);
      });
    });

    describe("Invalid strings (returns false)", () => {
      it("should return false for empty string", () => {
        assert.equal(isNonEmptyString(""), false);
      });

      it("should return false for whitespace-only string", () => {
        assert.equal(isNonEmptyString("   "), false);
      });

      it("should return false for tab-only string", () => {
        assert.equal(isNonEmptyString("\t\t"), false);
      });

      it("should return false for newline-only string", () => {
        assert.equal(isNonEmptyString("\n\n"), false);
      });

      it("should return false for mixed whitespace", () => {
        assert.equal(isNonEmptyString(" \t\n "), false);
      });
    });

    describe("Non-string values (returns false)", () => {
      it("should return false for null", () => {
        assert.equal(isNonEmptyString(null), false);
      });

      it("should return false for undefined", () => {
        assert.equal(isNonEmptyString(undefined), false);
      });

      it("should return false for number", () => {
        assert.equal(isNonEmptyString(123), false);
      });

      it("should return false for boolean", () => {
        assert.equal(isNonEmptyString(true), false);
        assert.equal(isNonEmptyString(false), false);
      });

      it("should return false for object", () => {
        assert.equal(isNonEmptyString({}), false);
        assert.equal(isNonEmptyString({ value: "test" }), false);
      });

      it("should return false for array", () => {
        assert.equal(isNonEmptyString([]), false);
        assert.equal(isNonEmptyString(["test"]), false);
      });
    });

    describe("Edge cases", () => {
      it("should return true for string with leading/trailing spaces after trim", () => {
        assert.equal(isNonEmptyString("  hello  "), true);
      });

      it("should return false for string with only spaces", () => {
        assert.equal(isNonEmptyString("     "), false);
      });

      it("should work as type guard", () => {
        const value: unknown = "test";

        if (isNonEmptyString(value)) {
          // TypeScript should know value is string here
          const upper: string = value.toUpperCase();
          assert.equal(upper, "TEST");
        }
      });
    });
  });

  describe("Result Type Discrimination", () => {
    it("success and failure should have different discriminated types", () => {
      const successResult = success({ id: 1 });
      const failureResult = failure("error");

      // Type guard test
      if (successResult.success) {
        assert.ok("client" in successResult);
        assert.ok(!("error" in successResult));
      }

      if (!failureResult.success) {
        assert.ok("error" in failureResult);
        assert.ok(!("client" in failureResult));
      }
    });

    it("should work with type narrowing", () => {
      const result = Math.random() > 0.5 ? success("data") : failure("error");

      if (result.success) {
        assert.ok(typeof result.client === "string");
      } else {
        assert.ok(typeof result.error === "string");
      }
    });
  });
});
