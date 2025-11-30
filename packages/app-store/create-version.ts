/**
 * App Store 버전 생성 로직
 */

import type { AppStoreClient } from "./client";

export interface CreateAppStoreVersionOptions {
  client: AppStoreClient;
  versionString: string;
}

export interface CreateAppStoreVersionResult {
  version: {
    id: string;
    attributes: {
      versionString: string;
      platform: string;
      appStoreState?: string;
      releaseType?: string;
    };
  };
}

/**
 * App Store 버전 생성
 */
export async function createAppStoreVersion({
  client,
  versionString,
}: CreateAppStoreVersionOptions): Promise<CreateAppStoreVersionResult> {
  const version = await client.createNewVersion(versionString);

  return {
    version,
  };
}

export interface CreateAppStoreVersionWithAutoIncrementOptions {
  client: AppStoreClient;
  baseVersion?: string;
}

/**
 * App Store 버전 자동 증가 생성
 */
export async function createAppStoreVersionWithAutoIncrement({
  client,
  baseVersion,
}: CreateAppStoreVersionWithAutoIncrementOptions): Promise<CreateAppStoreVersionResult> {
  const version = await client.createNewVersionWithAutoIncrement(baseVersion);

  return {
    version,
  };
}
