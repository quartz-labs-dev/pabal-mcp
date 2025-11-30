/**
 * Google Play 릴리즈 노트 가져오기 로직
 */

import type { GooglePlayClient } from "./client";
import type { GooglePlayReleaseNote } from "@packages/aso-core/types";

export interface PullGooglePlayReleaseNotesOptions {
  client: GooglePlayClient;
}

export interface PullGooglePlayReleaseNotesResult {
  releaseNotes: GooglePlayReleaseNote[];
}

/**
 * Google Play 릴리즈 노트 가져오기 (Production 트랙)
 */
export async function pullGooglePlayReleaseNotes({
  client,
}: PullGooglePlayReleaseNotesOptions): Promise<PullGooglePlayReleaseNotesResult> {
  const releaseNotes = await client.pullProductionReleaseNotes();

  return {
    releaseNotes,
  };
}
