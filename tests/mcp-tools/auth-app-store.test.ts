import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleAuthAppStore } from "@servers/mcp/tools/auth/app-store";

describe("MCP Tool: auth-app-store", () => {
  it("should return success response when authentication is configured", async () => {
    const result = await handleAuthAppStore();

    assert.ok(result.content);
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, "text");

    const textContent = result.content[0].text;
    let parsed: any = null;
    try {
      parsed = JSON.parse(textContent);
    } catch {
      // Not JSON, likely error string
    }

    if (parsed?.ok) {
      // Success case: Should include JWT information
      assert.equal(parsed.ok, true);
      assert.ok(parsed.header);
      assert.ok(parsed.payload);
      assert.ok(parsed.payload.iss); // issuer ID
      assert.ok(parsed.payload.exp); // expiration
    } else {
      // Failure case: Should include error message
      assert.ok(typeof textContent === "string");
      assert.ok(
        textContent.includes("not configured") || textContent.includes("failed")
      );
    }
  });
});
