/**
 * Google Play Console API Client
 *
 * Authentication: Service account JSON key file required
 * API Documentation: https://developers.google.com/android-publisher
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { existsSync, readFileSync } from "node:fs";
import { google } from "googleapis";
import type {
  GooglePlayAsoData,
  GooglePlayMultilingualAsoData,
  GooglePlayReleaseNote,
} from "@/packages/configs/aso-config/types";
import { DEFAULT_LOCALE } from "@/packages/configs/aso-config/constants";
import { GooglePlayApiEndpoints } from "./api-endpoints";
import {
  fetchScreenshotsAndFeatureGraphic,
  convertToAsoData,
  convertToLocaleAsoData,
  convertToMultilingualAsoData,
  buildListingRequestBody,
  buildDetailsRequestBody,
  convertToReleaseNote,
  convertReleaseNotesToApiFormat,
  extractLatestRelease,
} from "./api-converters";
import type {
  GooglePlayClientConfig,
  EditSession,
  AppAccessInfo,
  LatestReleaseInfo,
  ReleaseUpdateResult,
  CreateReleaseOptions,
  UploadScreenshotOptions,
  UpdateReleaseNotesOptions,
  AppDetailsData,
} from "./types";
import {
  DEFAULT_TRACK,
  DEFAULT_LANGUAGE,
  DEFAULT_RELEASE_STATUS,
} from "./constants";

export class GooglePlayClient {
  private auth: any;
  private androidPublisher: any;
  private packageName: string;
  private apiEndpoints: GooglePlayApiEndpoints;

  constructor(config: GooglePlayClientConfig) {
    this.packageName = config.packageName;

    let key = config.serviceAccountKey;
    if (config.serviceAccountKeyPath && !key) {
      const content = readFileSync(config.serviceAccountKeyPath, "utf-8");
      key = JSON.parse(content);
    }

    if (!key) {
      throw new Error("Google Play service account key is required.");
    }

    this.auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });

    this.androidPublisher = google.androidpublisher("v3");
    this.apiEndpoints = new GooglePlayApiEndpoints(this.androidPublisher);
  }

  /**
   * Verify app access (returns app information)
   * Google Play API does not support listing apps, so only verifies access by package name
   */
  async verifyAppAccess(): Promise<AppAccessInfo> {
    const authClient = await this.auth.getClient();
    const appResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = appResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    try {
      const appDetails = await this.apiEndpoints.getAppDetails(session);
      const listingsResponse = await this.apiEndpoints.listListings(session);

      const listings = listingsResponse.data.listings || [];
      const defaultListing = listings[0];
      const supportedLocales = listings
        .map((l: any) => l.language)
        .filter((lang: string | undefined): lang is string => !!lang)
        .sort();

      return {
        packageName: this.packageName,
        title: defaultListing?.title ?? undefined,
        defaultLanguage: appDetails.data.defaultLanguage ?? undefined,
        supportedLocales,
      };
    } finally {
      try {
        await this.apiEndpoints.deleteEdit(session);
      } catch {
        // Ignore deletion failure
      }
    }
  }

  async pullAllLanguagesAsoData(): Promise<GooglePlayMultilingualAsoData> {
    const authClient = await this.auth.getClient();
    const appResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = appResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    try {
      const appDetails = await this.apiEndpoints.getAppDetails(session);
      const listingsResponse = await this.apiEndpoints.listListings(session);

      const allListings = listingsResponse.data.listings || [];
      console.log(
        `🌍 Found ${allListings.length} Google Play languages: ${allListings
          .map((l: any) => l.language)
          .join(", ")}`
      );

      const locales: Record<string, GooglePlayAsoData> = {};
      let defaultLanguage: string | undefined;

      for (const listing of allListings) {
        const language = listing.language;
        if (!language) {
          console.warn(`⚠️  Listing has no language`);
          continue;
        }

        const listingDetail = await this.apiEndpoints.getListing(
          session,
          language
        );

        const { screenshots, featureGraphic } =
          await fetchScreenshotsAndFeatureGraphic(
            (imageType) =>
              this.apiEndpoints.listImages(session, language, imageType),
            language
          );

        locales[language] = convertToLocaleAsoData(
          listingDetail.data,
          appDetails.data,
          screenshots,
          featureGraphic,
          this.packageName,
          language
        );

        if (!defaultLanguage && language === DEFAULT_LOCALE) {
          defaultLanguage = language;
        }
      }

      return convertToMultilingualAsoData(locales, defaultLanguage);
    } finally {
      await this.apiEndpoints.deleteEdit(session);
    }
  }

  async pullAsoData(): Promise<GooglePlayAsoData> {
    const authClient = await this.auth.getClient();
    const appResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = appResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    try {
      const appDetails = await this.apiEndpoints.getAppDetails(session);
      const listings = await this.apiEndpoints.listListings(session);

      const defaultListing = listings.data.listings?.[0];
      const defaultLanguage = defaultListing?.language || DEFAULT_LANGUAGE;

      const listing = await this.apiEndpoints.getListing(
        session,
        defaultLanguage
      );

      const { screenshots, featureGraphic } =
        await fetchScreenshotsAndFeatureGraphic(
          (imageType) =>
            this.apiEndpoints.listImages(session, defaultLanguage, imageType),
          defaultLanguage
        );

      return convertToAsoData(
        listing.data,
        appDetails.data,
        screenshots,
        featureGraphic,
        this.packageName,
        defaultLanguage
      );
    } finally {
      await this.apiEndpoints.deleteEdit(session);
    }
  }

  async pushAsoData(data: Partial<GooglePlayAsoData>): Promise<void> {
    const authClient = await this.auth.getClient();
    const editResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = editResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    try {
      const language = data.defaultLanguage || DEFAULT_LANGUAGE;

      if (data.title || data.shortDescription || data.fullDescription) {
        const listingBody = buildListingRequestBody({
          title: data.title,
          shortDescription: data.shortDescription,
          fullDescription: data.fullDescription,
        });

        console.error(
          `[GooglePlayClient] Updating listing for ${language}:`,
          JSON.stringify(listingBody, null, 2)
        );

        try {
          await this.apiEndpoints.updateListing(session, language, listingBody);
          console.error(
            `[GooglePlayClient] ✅ Listing updated for ${language}`
          );
        } catch (listingError: any) {
          console.error(
            `[GooglePlayClient] ❌ Listing update failed for ${language}`
          );
          console.error(`[GooglePlayClient] Error code:`, listingError.code);
          console.error(
            `[GooglePlayClient] Error message:`,
            listingError.message
          );
          if (listingError.errors) {
            console.error(
              `[GooglePlayClient] Error details:`,
              JSON.stringify(listingError.errors, null, 2)
            );
          }
          if (listingError.response?.data) {
            console.error(
              `[GooglePlayClient] Response data:`,
              JSON.stringify(listingError.response.data, null, 2)
            );
          }
          throw listingError;
        }
      }

      if (data.contactEmail || data.contactPhone || data.contactWebsite) {
        const detailsBody = buildDetailsRequestBody({
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          contactWebsite: data.contactWebsite,
        });

        console.error(
          `[GooglePlayClient] Updating details:`,
          JSON.stringify(detailsBody, null, 2)
        );

        try {
          await this.apiEndpoints.updateAppDetails(session, detailsBody);
          console.error(`[GooglePlayClient] ✅ Details updated`);
        } catch (detailsError: any) {
          console.error(`[GooglePlayClient] ❌ Details update failed`);
          console.error(`[GooglePlayClient] Error code:`, detailsError.code);
          console.error(
            `[GooglePlayClient] Error message:`,
            detailsError.message
          );
          if (detailsError.errors) {
            console.error(
              `[GooglePlayClient] Error details:`,
              JSON.stringify(detailsError.errors, null, 2)
            );
          }
          if (detailsError.response?.data) {
            console.error(
              `[GooglePlayClient] Response data:`,
              JSON.stringify(detailsError.response.data, null, 2)
            );
          }
          throw detailsError;
        }
      }

      console.error(`[GooglePlayClient] Committing edit...`);
      await this.apiEndpoints.commitEdit(session);
      console.error(`[GooglePlayClient] ✅ Edit committed successfully`);
    } catch (error) {
      console.error(`[GooglePlayClient] Rolling back edit due to error...`);
      await this.apiEndpoints.deleteEdit(session);
      throw error;
    }
  }

  /**
   * Push multilingual ASO data in a single edit session
   * This prevents backendError from rapid successive commits
   */
  async pushMultilingualAsoData(
    data: GooglePlayMultilingualAsoData
  ): Promise<void> {
    const authClient = await this.auth.getClient();
    const editResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = editResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    const locales = Object.keys(data.locales);

    console.error(
      `[GooglePlayClient] Starting multilingual push for ${locales.length} locale(s): ${locales.join(", ")}`
    );

    try {
      // Update listings for all languages in a single edit session
      for (const [language, localeData] of Object.entries(data.locales)) {
        if (
          localeData.title ||
          localeData.shortDescription ||
          localeData.fullDescription
        ) {
          const listingBody = buildListingRequestBody({
            title: localeData.title,
            shortDescription: localeData.shortDescription,
            fullDescription: localeData.fullDescription,
          });

          console.error(
            `[GooglePlayClient] Updating listing for ${language}...`
          );

          try {
            await this.apiEndpoints.updateListing(
              session,
              language,
              listingBody
            );
            console.error(
              `[GooglePlayClient] ✅ Listing prepared for ${language}`
            );
          } catch (listingError: any) {
            console.error(
              `[GooglePlayClient] ❌ Listing update failed for ${language}`
            );
            console.error(`[GooglePlayClient] Error code:`, listingError.code);
            console.error(
              `[GooglePlayClient] Error message:`,
              listingError.message
            );
            if (listingError.errors) {
              console.error(
                `[GooglePlayClient] Error details:`,
                JSON.stringify(listingError.errors, null, 2)
              );
            }
            throw listingError;
          }
        }
      }

      // NOTE: App details (contactEmail, contactPhone, contactWebsite) must be updated
      // in a separate edit session using pushAppDetails() method.
      // Google Play API returns 500 Internal Server Error when updating details
      // in the same edit session as listings.

      // Commit all changes at once
      console.error(`[GooglePlayClient] Committing all changes...`);
      try {
        await this.apiEndpoints.commitEdit(session);
        console.error(
          `[GooglePlayClient] ✅ All ${locales.length} locale(s) committed successfully`
        );
      } catch (commitError: any) {
        console.error(`[GooglePlayClient] ❌ Commit failed`);
        console.error(`[GooglePlayClient] Error code:`, commitError.code);
        console.error(`[GooglePlayClient] Error message:`, commitError.message);
        console.error(`[GooglePlayClient] Error status:`, commitError.status);
        if (commitError.errors) {
          console.error(
            `[GooglePlayClient] Error details:`,
            JSON.stringify(commitError.errors, null, 2)
          );
        }
        if (commitError.response?.data) {
          console.error(
            `[GooglePlayClient] Response data:`,
            JSON.stringify(commitError.response.data, null, 2)
          );
        }
        if (commitError.response?.status) {
          console.error(
            `[GooglePlayClient] Response status:`,
            commitError.response.status
          );
        }
        if (commitError.response?.statusText) {
          console.error(
            `[GooglePlayClient] Response statusText:`,
            commitError.response.statusText
          );
        }
        if (commitError.response?.headers) {
          console.error(
            `[GooglePlayClient] Response headers:`,
            JSON.stringify(commitError.response.headers, null, 2)
          );
        }
        throw commitError;
      }
    } catch (error: any) {
      console.error(`[GooglePlayClient] Rolling back edit due to error...`);
      console.error(
        `[GooglePlayClient] Full error object:`,
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );
      try {
        await this.apiEndpoints.deleteEdit(session);
      } catch {
        // Ignore deletion failure
      }
      throw error;
    }
  }

  /**
   * Push app details (contactEmail, contactPhone, contactWebsite) in a separate edit session
   * This must be called separately from pushMultilingualAsoData due to Google Play API limitations
   * NOTE: defaultLanguage is required - it will be fetched from current app details if not provided
   */
  async pushAppDetails(details: AppDetailsData): Promise<void> {
    if (
      !details.contactEmail &&
      !details.contactPhone &&
      !details.contactWebsite
    ) {
      console.error(`[GooglePlayClient] No app details to update, skipping`);
      return;
    }

    const authClient = await this.auth.getClient();
    const editResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = editResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    console.error(`[GooglePlayClient] Starting app details update...`);

    try {
      // defaultLanguage is required for details.update API
      // If not provided, fetch current value first
      let defaultLanguage = details.defaultLanguage;
      if (!defaultLanguage) {
        console.error(`[GooglePlayClient] Fetching current defaultLanguage...`);
        const currentDetails = await this.apiEndpoints.getAppDetails(session);
        defaultLanguage =
          currentDetails.data.defaultLanguage || DEFAULT_LANGUAGE;
        console.error(
          `[GooglePlayClient] Current defaultLanguage: ${defaultLanguage}`
        );
      }

      const detailsBody = buildDetailsRequestBody({
        defaultLanguage: defaultLanguage!,
        contactEmail: details.contactEmail,
        contactPhone: details.contactPhone,
        contactWebsite: details.contactWebsite,
      });

      console.error(
        `[GooglePlayClient] Updating details:`,
        JSON.stringify(detailsBody, null, 2)
      );

      await this.apiEndpoints.updateAppDetails(session, detailsBody);
      console.error(`[GooglePlayClient] ✅ Details prepared`);

      console.error(`[GooglePlayClient] Committing app details...`);
      await this.apiEndpoints.commitEdit(session);
      console.error(`[GooglePlayClient] ✅ App details committed successfully`);
    } catch (error: any) {
      console.error(`[GooglePlayClient] Rolling back edit due to error...`);
      console.error(`[GooglePlayClient] Error:`, error.message);
      if (error.errors) {
        console.error(
          `[GooglePlayClient] Error details:`,
          JSON.stringify(error.errors, null, 2)
        );
      }
      try {
        await this.apiEndpoints.deleteEdit(session);
      } catch {
        // Ignore deletion failure
      }
      throw error;
    }
  }

  async uploadScreenshot(options: UploadScreenshotOptions): Promise<void> {
    const { imagePath, imageType, language = DEFAULT_LANGUAGE } = options;

    if (!existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const authClient = await this.auth.getClient();
    const editResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = editResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    try {
      const imageBuffer = readFileSync(imagePath);

      await this.apiEndpoints.uploadImage(session, language, imageType, {
        mimeType: "image/png",
        body: imageBuffer,
      });

      await this.apiEndpoints.commitEdit(session);
    } catch (error) {
      await this.apiEndpoints.deleteEdit(session);
      throw error;
    }
  }

  async getLatestProductionRelease(): Promise<LatestReleaseInfo | null> {
    const authClient = await this.auth.getClient();
    const editResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = editResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    try {
      const trackResponse = await this.apiEndpoints.getTrack(
        session,
        DEFAULT_TRACK
      );
      const releases = trackResponse.data.releases || [];

      return extractLatestRelease(releases);
    } finally {
      await this.apiEndpoints.deleteEdit(session);
    }
  }

  async createProductionRelease(options: CreateReleaseOptions): Promise<void> {
    const {
      versionCodes,
      releaseName,
      status = DEFAULT_RELEASE_STATUS,
    } = options;

    if (!versionCodes || versionCodes.length === 0) {
      throw new Error(
        "At least one versionCode is required to create a release."
      );
    }

    const authClient = await this.auth.getClient();
    const editResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = editResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    try {
      await this.apiEndpoints.updateTrack(session, DEFAULT_TRACK, {
        track: DEFAULT_TRACK,
        releases: [
          {
            name: releaseName,
            status,
            versionCodes: versionCodes.map(String),
          },
        ],
      });

      await this.apiEndpoints.commitEdit(session);
    } catch (error) {
      await this.apiEndpoints.deleteEdit(session);
      throw error;
    }
  }

  /**
   * Update release notes for production track
   */
  async updateReleaseNotes(
    options: UpdateReleaseNotesOptions
  ): Promise<ReleaseUpdateResult> {
    const { releaseNotes, track = DEFAULT_TRACK } = options;

    const authClient = await this.auth.getClient();
    const editResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = editResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    try {
      // Get current track information
      const trackResponse = await this.apiEndpoints.getTrack(session, track);

      const releases = trackResponse.data.releases || [];
      if (releases.length === 0) {
        throw new Error(`No releases found in ${track} track`);
      }

      // Add release notes to latest release
      const latestRelease = releases[0];
      const releaseNotesArray = convertReleaseNotesToApiFormat(releaseNotes);

      // Update track
      await this.apiEndpoints.updateTrack(session, track, {
        track,
        releases: [
          {
            ...latestRelease,
            releaseNotes: releaseNotesArray,
          },
        ],
      });

      // Commit
      await this.apiEndpoints.commitEdit(session);

      return {
        updated: Object.keys(releaseNotes),
        failed: [],
      };
    } catch (error) {
      // Rollback on failure
      try {
        await this.apiEndpoints.deleteEdit(session);
      } catch {
        // Ignore deletion failure
      }
      throw error;
    }
  }

  async pullReleaseNotes(): Promise<GooglePlayReleaseNote[]> {
    const authClient = await this.auth.getClient();
    const editResponse = await this.apiEndpoints.createEdit(
      authClient,
      this.packageName
    );
    const editId = editResponse.data.id!;

    const session: EditSession = {
      auth: authClient,
      packageName: this.packageName,
      editId,
    };

    try {
      const tracksResponse = await this.apiEndpoints.listTracks(session);

      const tracks = tracksResponse.data.tracks || [];
      const releaseNotes: GooglePlayReleaseNote[] = [];

      for (const track of tracks) {
        const trackName = track.track || DEFAULT_TRACK;

        const trackResponse = await this.apiEndpoints.getTrack(
          session,
          trackName
        );

        const releases = trackResponse.data.releases || [];

        for (const release of releases) {
          const versionCodes = release.versionCodes || [];

          for (const versionCode of versionCodes) {
            const releaseNote = convertToReleaseNote(
              release,
              versionCode,
              trackName
            );

            if (releaseNote) {
              releaseNotes.push(releaseNote);
            }
          }
        }
      }

      return releaseNotes;
    } finally {
      await this.apiEndpoints.deleteEdit(session);
    }
  }

  async pullProductionReleaseNotes(): Promise<GooglePlayReleaseNote[]> {
    const allReleaseNotes = await this.pullReleaseNotes();
    return allReleaseNotes.filter((rn) => rn.track === DEFAULT_TRACK);
  }
}
