/**
 * App Store 릴리즈 노트 업데이트 로직
 */

import type { AppStoreClient } from "./client";
import type { RegisteredAppStoreInfo } from "@packages/shared/registered-apps";

export interface UpdateAppStoreReleaseNotesOptions {
  client: AppStoreClient;
  releaseNotes: Record<string, string>; // { "ko": "사용성을 개선하였습니다", "en-US": "Improved usability" }
  versionId?: string;
  supportedLocales?: string[];
}

export interface UpdateAppStoreReleaseNotesResult {
  success: boolean;
  updated: string[];
  failed: Array<{ locale: string; error: string }>;
}

/**
 * App Store 릴리즈 노트 업데이트
 * 지원하는 로케일에 대해서만 업데이트를 시도합니다.
 */
export async function updateAppStoreReleaseNotes({
  client,
  releaseNotes,
  versionId,
  supportedLocales,
}: UpdateAppStoreReleaseNotesOptions): Promise<UpdateAppStoreReleaseNotesResult> {
  const result: UpdateAppStoreReleaseNotesResult = {
    success: true,
    updated: [],
    failed: [],
  };

  // versionId가 없으면 편집 가능한 버전 찾기
  let targetVersionId = versionId;
  if (!targetVersionId) {
    const versions = await client.getAllVersions();
    const editableVersion = versions.find(
      (v) => v.attributes.appStoreState === "PREPARE_FOR_SUBMISSION"
    );
    if (!editableVersion) {
      result.success = false;
      result.failed.push({
        locale: "all",
        error: "No editable version found",
      });
      return result;
    }
    targetVersionId = editableVersion.id;
  }

  // 지원 로케일 필터링
  const localesToUpdate = supportedLocales
    ? Object.keys(releaseNotes).filter((locale) =>
        supportedLocales.includes(locale)
      )
    : Object.keys(releaseNotes);

  // 각 로케일별로 업데이트
  for (const locale of localesToUpdate) {
    try {
      await client.updateWhatsNew({
        versionId: targetVersionId!,
        locale,
        whatsNew: releaseNotes[locale],
      });
      result.updated.push(locale);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.failed.push({
        locale,
        error: errorMessage,
      });
      result.success = false;
    }
  }

  return result;
}
