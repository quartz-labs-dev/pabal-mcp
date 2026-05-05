import { AppError } from "@/packages/common/errors/app-error";
import { ERROR_CODES } from "@/packages/common/errors/error-codes";
import { HTTP_STATUS } from "@/packages/common/errors/status-codes";
import type {
  AsoData,
  GooglePlayMultilingualAsoData,
  GooglePlayReleaseNote,
} from "@/packages/configs/aso-config/types";
import { getAsoPushDir } from "@/packages/configs/aso-config/utils";
import type { EnvConfig } from "@/packages/configs/secrets-config/types";
import type { GooglePlayClient } from "@/packages/stores/play-store/client";
import { verifyPlayStoreAuth } from "@/packages/stores/play-store/verify-auth";
import { createGooglePlayClient } from "@/core/clients/google-play-factory";
import {
  parseGooglePlayScreenshots,
  hasScreenshots,
} from "@/core/helpers/screenshot-helpers";
import {
  checkPushPrerequisites,
  serviceFailure,
  toServiceResult,
  updateRegisteredLocales,
} from "./service-helpers";
import {
  type MaybeResult,
  type ServiceResult,
  type GooglePlayReleaseInfo,
  type UpdatedReleaseNotesResult,
  type PushAsoResult,
  type CreatedGooglePlayVersion,
  type VerifyAuthResult,
} from "./types";

interface GooglePlayAppInfo {
  name?: string;
  supportedLocales?: string[];
}

type GooglePlayScreenshotUploadOption = Parameters<
  GooglePlayClient["uploadScreenshotsForLocales"]
>[0][number];

export function resolveGooglePlayLocales(
  allLocales: string[],
  requestedLocales?: string[]
): { localesToPush: string[]; missingLocales: string[] } {
  if (!requestedLocales?.length) {
    return { localesToPush: allLocales, missingLocales: [] };
  }

  const requested = new Set(requestedLocales);
  return {
    localesToPush: allLocales.filter((locale) => requested.has(locale)),
    missingLocales: requestedLocales.filter(
      (locale) => !allLocales.includes(locale)
    ),
  };
}

export function shouldPushGooglePlayAppDetails({
  hasContactDetails,
  requestedLocales,
}: {
  hasContactDetails: boolean;
  requestedLocales?: string[];
}): boolean {
  return hasContactDetails && !requestedLocales?.length;
}

export function createGooglePlayScreenshotUploadBatches(
  options: GooglePlayScreenshotUploadOption[],
  batchSize?: number
): GooglePlayScreenshotUploadOption[][] {
  if (!batchSize) return options.length > 0 ? [options] : [];

  const batches: GooglePlayScreenshotUploadOption[][] = [];
  for (let offset = 0; offset < options.length; offset += batchSize) {
    batches.push(options.slice(offset, offset + batchSize));
  }

  return batches;
}

/**
 * Google Play-facing service layer that wraps client creation and common operations.
 * Keeps MCP tools independent from client factories and SDK details.
 */
export class GooglePlayService {
  private getClientOrThrow(
    packageName: string,
    existingClient?: GooglePlayClient
  ): GooglePlayClient {
    if (existingClient) return existingClient;
    const clientResult = this.createClient(packageName);
    if (!clientResult.success) {
      throw clientResult.error;
    }
    return clientResult.data;
  }

  createClient(packageName: string): ServiceResult<GooglePlayClient> {
    return toServiceResult(createGooglePlayClient({ packageName }));
  }

  /**
   * Fetch a single app info (with locales) by packageName.
   */
  async fetchAppInfo(
    packageName: string
  ): Promise<MaybeResult<GooglePlayAppInfo>> {
    try {
      const client = this.getClientOrThrow(packageName);
      const appInfo = await client.verifyAppAccess();
      return {
        found: true,
        name: appInfo.title,
        supportedLocales: appInfo.supportedLocales,
      };
    } catch (error) {
      return {
        found: false,
        error: AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.GOOGLE_PLAY_FETCH_APP_INFO_FAILED,
          "Failed to fetch Google Play app info"
        ),
      };
    }
  }

  async getLatestProductionRelease(
    packageName: string
  ): Promise<MaybeResult<GooglePlayReleaseInfo>> {
    try {
      const client = this.getClientOrThrow(packageName);
      const latestRelease = await client.getLatestProductionRelease();
      if (!latestRelease) {
        return { found: false };
      }

      const { versionName, releaseName, status, versionCodes } = latestRelease;

      return {
        found: true,
        versionName,
        releaseName,
        status,
        versionCodes,
      };
    } catch (error) {
      return {
        found: false,
        error: AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.GOOGLE_PLAY_GET_LATEST_RELEASE_FAILED,
          "Failed to fetch latest Google Play release"
        ),
      };
    }
  }

  async updateReleaseNotes(
    packageName: string,
    releaseNotes: Record<string, string>,
    track?: string,
    supportedLocales?: string[]
  ): Promise<ServiceResult<UpdatedReleaseNotesResult>> {
    try {
      const client = this.getClientOrThrow(packageName);
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
        return serviceFailure(
          AppError.validation(
            ERROR_CODES.GOOGLE_PLAY_RELEASE_NOTES_EMPTY,
            "No supported locales found in release notes"
          )
        );
      }

      try {
        const updateResult = await client.updateReleaseNotes({
          releaseNotes: filteredReleaseNotes,
          track: track ?? "production",
        });

        const success = updateResult.failed.length === 0;
        const partialError = !success
          ? AppError.wrap(
              updateResult.failed[0]?.error ??
                "Failed to update some release notes",
              HTTP_STATUS.INTERNAL_SERVER_ERROR,
              ERROR_CODES.GOOGLE_PLAY_UPDATE_RELEASE_NOTES_PARTIAL
            )
          : undefined;
        if (!success) {
          return {
            success: false,
            error:
              partialError ??
              AppError.internal(
                ERROR_CODES.GOOGLE_PLAY_UPDATE_RELEASE_NOTES_FAILED,
                "Failed to update Google Play release notes"
              ),
          };
        }

        return {
          success: true,
          data: {
            updated: updateResult.updated,
            failed: updateResult.failed,
          },
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return serviceFailure(
          AppError.wrap(
            error,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            ERROR_CODES.GOOGLE_PLAY_UPDATE_RELEASE_NOTES_FAILED,
            msg
          )
        );
      }
    } catch (error) {
      return serviceFailure(
        AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.GOOGLE_PLAY_UPDATE_RELEASE_NOTES_FAILED,
          "Failed to update Google Play release notes"
        )
      );
    }
  }

  async pullReleaseNotes(
    packageName: string
  ): Promise<ServiceResult<GooglePlayReleaseNote[]>> {
    try {
      const client = this.getClientOrThrow(packageName);
      const releaseNotes = await client.pullProductionReleaseNotes();
      return { success: true, data: releaseNotes };
    } catch (error) {
      return serviceFailure(
        AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.GOOGLE_PLAY_PULL_RELEASE_NOTES_FAILED,
          "Failed to pull Google Play release notes"
        )
      );
    }
  }

  async createVersion(
    packageName: string,
    versionString: string,
    versionCodes: number[]
  ): Promise<ServiceResult<CreatedGooglePlayVersion>> {
    try {
      const client = this.getClientOrThrow(packageName);
      await client.createProductionRelease({
        versionCodes,
        releaseName: versionString,
        status: "draft",
      });
      return {
        success: true,
        data: {
          versionName: versionString,
          versionCodes,
          status: "DRAFT",
        },
      };
    } catch (error) {
      return serviceFailure(
        AppError.wrap(
          error,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.GOOGLE_PLAY_CREATE_VERSION_FAILED,
          "Failed to create Google Play version"
        )
      );
    }
  }

  async pushAsoData({
    config,
    packageName,
    localAsoData,
    googlePlayDataPath,
    uploadImages = false,
    locales,
    imageUploadTimeoutMs,
    imageLocaleBatchSize,
    slug,
  }: {
    config: EnvConfig;
    packageName?: string;
    localAsoData: AsoData;
    googlePlayDataPath: string;
    uploadImages?: boolean;
    locales?: string[];
    imageUploadTimeoutMs?: number;
    imageLocaleBatchSize?: number;
    slug?: string;
  }): Promise<PushAsoResult> {
    const skip = checkPushPrerequisites({
      storeLabel: "Google Play",
      configured: Boolean(config.playStore),
      identifierLabel: "packageName",
      identifier: packageName,
      hasData: Boolean(localAsoData.googlePlay),
      dataPath: googlePlayDataPath,
    });
    if (skip) return { success: false, error: skip };

    const ensuredPackage = packageName as string;
    const googlePlayData =
      localAsoData.googlePlay as GooglePlayMultilingualAsoData;
    const client = this.getClientOrThrow(ensuredPackage);

    console.error(`[MCP]   📤 Pushing to Google Play...`);
    console.error(`[MCP]     Package: ${packageName}`);

    try {
      const allLocales = Object.keys(googlePlayData.locales);
      const { localesToPush, missingLocales } = resolveGooglePlayLocales(
        allLocales,
        locales
      );
      if (missingLocales.length) {
        console.error(
          `[GooglePlay]   ⚠️  Requested locale(s) not found in local ASO data: ${missingLocales.join(", ")}`
        );
      }

      if (localesToPush.length === 0) {
        return {
          success: false,
          error: AppError.validation(
            ERROR_CODES.GOOGLE_PLAY_ASO_DATA_EMPTY,
            "No matching Google Play locales found to push"
          ),
        };
      }

      for (const locale of localesToPush) {
        console.error(`[GooglePlay]   📤 Preparing locale: ${locale}`);
      }

      // Push locale data as-is from aso-data.json
      await client.pushMultilingualAsoData({
        ...googlePlayData,
        locales: Object.fromEntries(
          localesToPush.map((locale) => [
            locale,
            googlePlayData.locales[locale],
          ])
        ),
      });

      // Push app-level contact information once for full pushes. Partial locale
      // pushes are commonly batched, and repeating details edits can invalidate
      // otherwise-successful listing commits on Google Play.
      if (
        shouldPushGooglePlayAppDetails({
          hasContactDetails: Boolean(
            googlePlayData.contactEmail || googlePlayData.contactWebsite
          ),
          requestedLocales: locales,
        })
      ) {
        console.error(`[GooglePlay]   📤 Pushing app details...`);
        await client.pushAppDetails({
          contactEmail: googlePlayData.contactEmail,
          contactWebsite: googlePlayData.contactWebsite,
        });
        console.error(`[GooglePlay]   ✅ App details uploaded successfully`);
      } else if (locales?.length) {
        console.error(
          `[GooglePlay]   ⏭️  Skipping app details for partial locale push`
        );
      }

      // Upload screenshots if enabled
      if (uploadImages && slug) {
        console.error(`[GooglePlay]   📤 Uploading screenshots...`);
        const pushDataDir = getAsoPushDir();
        const screenshotsBaseDir = `${pushDataDir}/products/${slug}/store`;

        const uploadedLocales: string[] = [];
        const skippedLocales: string[] = [];
        const failedLocales: string[] = [];
        const screenshotUploadOptions: GooglePlayScreenshotUploadOption[] = [];

        for (const locale of localesToPush) {
          try {
            const localeData = googlePlayData.locales[locale];

            // Check if images are defined in aso-data.json
            const hasImagesInJson =
              Boolean(localeData?.featureGraphic) ||
              Boolean(
                localeData?.screenshots &&
                ((localeData.screenshots.phone &&
                  localeData.screenshots.phone.length > 0) ||
                  (localeData.screenshots.tablet &&
                    localeData.screenshots.tablet.length > 0))
              );

            let screenshots: {
              phone: string[];
              tablet: string[];
              featureGraphic: string | null;
            };

            if (hasImagesInJson) {
              // Use screenshots from aso-data.json (relative paths)
              console.error(
                `[GooglePlay]   📋 Using screenshots from aso-data.json for ${locale}`
              );
              const relativePaths = localeData.screenshots;
              // Google Play upload strategy:
              // - phone array → uploads to both phoneScreenshots AND sevenInchScreenshots
              // - tablet array → uploads to tenInchScreenshots only
              screenshots = {
                phone: (relativePaths.phone || []).map(
                  (p) => `${screenshotsBaseDir}/${p}`
                ),
                tablet: (relativePaths.tablet || []).map(
                  (p) => `${screenshotsBaseDir}/${p}`
                ),
                featureGraphic: localeData.featureGraphic
                  ? `${screenshotsBaseDir}/${localeData.featureGraphic}`
                  : null,
              };
            } else {
              // Fallback: Parse from file system (backward compatibility)
              const screenshotsFsDir = `${screenshotsBaseDir}/google-play/screenshots`;
              if (!hasScreenshots(screenshotsFsDir, locale)) {
                console.error(
                  `[GooglePlay]   ⏭️  Skipping ${locale} - no screenshots in aso-data.json or file system`
                );
                skippedLocales.push(locale);
                continue;
              }

              console.error(
                `[GooglePlay]   📂 Parsing screenshots from file system for ${locale}`
              );
              const fsScreenshots = parseGooglePlayScreenshots(
                screenshotsFsDir,
                locale
              );
              // File system fallback: use tablet10 as tablet
              screenshots = {
                phone: fsScreenshots.phone,
                tablet: fsScreenshots.tablet10,
                featureGraphic: fsScreenshots.featureGraphic,
              };
            }

            // Google Play requires minimum 2 phone screenshots for that image type.
            const phoneCount = screenshots.phone.length;
            if (phoneCount > 0 && phoneCount < 2) {
              console.error(
                `[GooglePlay]   ⚠️  Skipping phone screenshots for ${locale} - needs at least 2 (found ${phoneCount})`
              );
              screenshots.phone = [];
            }

            const hasImagesToUpload =
              screenshots.phone.length > 0 ||
              screenshots.tablet.length > 0 ||
              Boolean(screenshots.featureGraphic);
            if (!hasImagesToUpload) {
              console.error(
                `[GooglePlay]   ⏭️  Skipping ${locale} - no uploadable images found`
              );
              skippedLocales.push(locale);
              continue;
            }

            console.error(
              `[GooglePlay]   📋 Queued screenshots for ${locale} (batch mode - will replace existing)...`
            );

            // Google Play upload strategy:
            // - phone → uploads to phoneScreenshots AND sevenInchScreenshots (both use same images)
            // - tablet → uploads to tenInchScreenshots only
            screenshotUploadOptions.push({
              language: locale,
              phoneScreenshots: screenshots.phone,
              sevenInchScreenshots: screenshots.phone,
              tenInchScreenshots: screenshots.tablet,
              featureGraphic: screenshots.featureGraphic || undefined,
              imageUploadTimeoutMs,
            });
          } catch (error) {
            console.error(
              `[GooglePlay]   ❌ Failed to upload screenshots for ${locale}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            failedLocales.push(locale);
          }
        }

        const screenshotBatches = createGooglePlayScreenshotUploadBatches(
          screenshotUploadOptions,
          imageLocaleBatchSize
        );
        for (const batch of screenshotBatches) {
          try {
            console.error(
              `[GooglePlay]   📤 Uploading screenshots for ${batch.length} locale(s) in one edit...`
            );
            const uploadResults =
              await client.uploadScreenshotsForLocales(batch);

            for (const uploadResult of uploadResults) {
              console.error(
                `[GooglePlay]   ✅ Images uploaded for ${uploadResult.language}: ${uploadResult.uploaded.phoneScreenshots} phone, ${uploadResult.uploaded.sevenInchScreenshots} 7-inch, ${uploadResult.uploaded.tenInchScreenshots} 10-inch, feature graphic ${uploadResult.uploaded.featureGraphic ? "yes" : "no"}`
              );
              uploadedLocales.push(uploadResult.language);
            }
          } catch (error) {
            const failedBatchLocales = batch.map((option) => option.language);
            console.error(
              `[GooglePlay]   ❌ Batch screenshot upload failed for ${failedBatchLocales.join(", ")}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            failedLocales.push(...failedBatchLocales);
          }
        }

        console.error(
          `[GooglePlay]   📊 Screenshot upload summary: ${uploadedLocales.length} succeeded, ${skippedLocales.length} skipped, ${failedLocales.length} failed`
        );
        if (uploadedLocales.length > 0) {
          console.error(
            `[GooglePlay]     ✅ Uploaded: ${uploadedLocales.join(", ")}`
          );
        }
        if (skippedLocales.length > 0) {
          console.error(
            `[GooglePlay]     ⏭️  Skipped: ${skippedLocales.join(", ")}`
          );
        }
        if (failedLocales.length > 0) {
          const uniqueFailedLocales = [...new Set(failedLocales)];
          console.error(
            `[GooglePlay]     ❌ Failed: ${uniqueFailedLocales.join(", ")}`
          );
          throw new Error(
            `Screenshot upload failed for locales: ${uniqueFailedLocales.join(", ")}`
          );
        }
      }

      try {
        const updated = updateRegisteredLocales(
          ensuredPackage,
          "googlePlay",
          localesToPush
        );
        if (updated) {
          console.error(
            `[MCP]   ✅ Updated registered-apps.json with ${localesToPush.length} Google Play locales`
          );
        }
      } catch (updateError) {
        console.error(
          `[MCP]   ⚠️ Failed to update registered-apps.json: ${
            updateError instanceof Error
              ? updateError.message
              : String(updateError)
          }`
        );
      }

      return {
        success: true,
        localesPushed: localesToPush,
      };
    } catch (error) {
      const wrapped = AppError.wrap(
        error,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.GOOGLE_PLAY_PUSH_FAILED,
        error instanceof Error ? error.message : String(error)
      );
      console.error(`[GooglePlay] ❌ Push failed: ${wrapped.message}`, error);
      return { success: false, error: wrapped };
    }
  }

  async verifyAuth(): Promise<
    VerifyAuthResult<{ client_email: string; project_id: string }>
  > {
    const result = verifyPlayStoreAuth();

    if (!result.success) {
      return {
        success: false,
        error: AppError.wrap(
          result.error ?? "Unknown error",
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.GOOGLE_PLAY_VERIFY_AUTH_FAILED,
          "Failed to verify Google Play auth"
        ),
      };
    }

    return { success: true, data: result.data };
  }
}
