/**
 * Google Play 릴리즈 노트 업데이트 로직
 */

import type { GooglePlayClient } from "./client";
import type { RegisteredGooglePlayInfo } from "@packages/shared/registered-apps";

export interface UpdateGooglePlayReleaseNotesOptions {
  client: GooglePlayClient;
  releaseNotes: Record<string, string>; // { "ko-KR": "사용성을 개선하였습니다", "en-US": "Improved usability" }
  track?: string;
  supportedLocales?: string[];
}

export interface UpdateGooglePlayReleaseNotesResult {
  success: boolean;
  updated: string[];
  failed: Array<{ locale: string; error: string }>;
}

/**
 * Google Play 릴리즈 노트 업데이트
 * 지원하는 로케일에 대해서만 업데이트를 시도합니다.
 */
export async function updateGooglePlayReleaseNotes({
  client,
  releaseNotes,
  track = "production",
  supportedLocales,
}: UpdateGooglePlayReleaseNotesOptions): Promise<UpdateGooglePlayReleaseNotesResult> {
  const result: UpdateGooglePlayReleaseNotesResult = {
    success: true,
    updated: [],
    failed: [],
  };

  // 지원 로케일 필터링
  const filteredReleaseNotes: Record<string, string> = {};
  if (supportedLocales) {
    for (const locale of supportedLocales) {
      if (releaseNotes[locale]) {
        filteredReleaseNotes[locale] = releaseNotes[locale];
      }
    }
  } else {
    Object.assign(filteredReleaseNotes, releaseNotes);
  }

  if (Object.keys(filteredReleaseNotes).length === 0) {
    result.success = false;
    result.failed.push({
      locale: "all",
      error: "No supported locales found in release notes",
    });
    return result;
  }

  try {
    const updateResult = await client.updateReleaseNotes({
      releaseNotes: filteredReleaseNotes,
      track,
    });

    result.updated = updateResult.updated;
    result.failed = updateResult.failed;
    result.success = result.failed.length === 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.failed.push({
      locale: "all",
      error: errorMessage,
    });
  }

  return result;
}
