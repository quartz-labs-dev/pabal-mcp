/**
 * App Store 릴리즈 노트 가져오기 로직
 */

import type { AppStoreClient } from "./client";
import type { AppStoreReleaseNote } from "@packages/aso-core/types";

export interface PullAppStoreReleaseNotesOptions {
  client: AppStoreClient;
}

export interface PullAppStoreReleaseNotesResult {
  releaseNotes: AppStoreReleaseNote[];
}

/**
 * App Store 릴리즈 노트 가져오기
 */
export async function pullAppStoreReleaseNotes({
  client,
}: PullAppStoreReleaseNotesOptions): Promise<PullAppStoreReleaseNotesResult> {
  const releaseNotes = await client.pullReleaseNotes();

  return {
    releaseNotes,
  };
}








