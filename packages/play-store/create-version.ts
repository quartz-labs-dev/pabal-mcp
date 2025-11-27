/**
 * Google Play 버전 생성 로직
 */

import type { GooglePlayClient } from "./client";

export interface CreateGooglePlayVersionOptions {
  client: GooglePlayClient;
  versionString: string;
  versionCodes: number[];
}

export interface CreateGooglePlayVersionResult {
  success: boolean;
}

/**
 * Google Play Production 릴리즈 생성
 */
export async function createGooglePlayVersion({
  client,
  versionString,
  versionCodes,
}: CreateGooglePlayVersionOptions): Promise<CreateGooglePlayVersionResult> {
  await client.createProductionRelease({
    versionCodes,
    releaseName: versionString,
    status: "draft",
  });

  return {
    success: true,
  };
}








