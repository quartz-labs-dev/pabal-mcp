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
  prepareScreenshotSetForUpload(
    screenshotSetId: string,
    incomingCount: number
  ): Promise<{
    deletedBeforeUpload: number;
    screenshotsToDeleteAfterUpload: AppStoreScreenshot[];
  }>;
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

  it("deletes only the minimum screenshots needed before uploading a replacement batch", async () => {
    const client = createClient();
    const deletedIds: string[] = [];

    client.listScreenshots = async () =>
      ({
        data: [
          { id: "screenshot-1", type: "appScreenshots" },
          { id: "screenshot-2", type: "appScreenshots" },
          { id: "screenshot-3", type: "appScreenshots" },
          { id: "screenshot-4", type: "appScreenshots" },
          { id: "screenshot-5", type: "appScreenshots" },
          { id: "screenshot-6", type: "appScreenshots" },
          { id: "preview-1", type: "appPreviews" },
        ],
      }) as unknown as ApiResponse<AppStoreScreenshot[]>;
    client.deleteScreenshot = async (screenshotId: string) => {
      deletedIds.push(screenshotId);
    };

    const result = await client.prepareScreenshotSetForUpload("set-1", 6);

    assert.equal(result.deletedBeforeUpload, 2);
    assert.deepEqual(deletedIds, ["screenshot-5", "screenshot-6"]);
    assert.deepEqual(
      result.screenshotsToDeleteAfterUpload.map((screenshot) => screenshot.id),
      ["screenshot-1", "screenshot-2", "screenshot-3", "screenshot-4"]
    );
  });

  it("rejects a screenshot batch larger than the App Store display-type limit before deleting anything", async () => {
    const client = createClient();
    const deletedIds: string[] = [];

    client.listScreenshots = async () =>
      ({
        data: [{ id: "screenshot-1", type: "appScreenshots" }],
      }) as unknown as ApiResponse<AppStoreScreenshot[]>;
    client.deleteScreenshot = async (screenshotId: string) => {
      deletedIds.push(screenshotId);
    };

    await assert.rejects(
      () => client.prepareScreenshotSetForUpload("set-1", 11),
      /allows up to 10 screenshots/
    );
    assert.deepEqual(deletedIds, []);
  });
});
