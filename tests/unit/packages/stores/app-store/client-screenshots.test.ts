import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppStoreClient } from "@/packages/stores/app-store/client";
import type {
  ApiResponse,
  AppStoreScreenshot,
} from "@/packages/stores/app-store/types";

interface ScreenshotDeletionTestClient {
  listScreenshots(
    screenshotSetId: string
  ): Promise<ApiResponse<AppStoreScreenshot[]>>;
  deleteScreenshot(screenshotId: string): Promise<void>;
  deleteAllScreenshotsInSet(screenshotSetId: string): Promise<number>;
}

const createClient = (): ScreenshotDeletionTestClient =>
  new AppStoreClient({
    issuerId: "issuer-id",
    keyId: "key-id",
    privateKey:
      "-----BEGIN PRIVATE KEY-----\nfake-private-key\n-----END PRIVATE KEY-----",
    bundleId: "com.example.app",
  }) as unknown as ScreenshotDeletionTestClient;

describe("AppStoreClient screenshot deletion", () => {
  it("deletes only appScreenshots and skips app preview resources", async () => {
    const client = createClient();
    const deletedIds: string[] = [];

    client.listScreenshots = async () =>
      ({
        data: [
          { id: "screenshot-1", type: "appScreenshots" },
          { id: "preview-1", type: "appPreviews" },
          { id: "screenshot-2", type: "appScreenshots" },
        ],
      }) as unknown as ApiResponse<AppStoreScreenshot[]>;
    client.deleteScreenshot = async (screenshotId: string) => {
      deletedIds.push(screenshotId);
    };

    const deletedCount = await client.deleteAllScreenshotsInSet("set-1");

    assert.equal(deletedCount, 2);
    assert.deepEqual(deletedIds, ["screenshot-1", "screenshot-2"]);
  });
});
