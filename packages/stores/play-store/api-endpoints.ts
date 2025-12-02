/**
 * Google Play Console API Endpoints
 *
 * Centralized API endpoint management for androidpublisher v3 API
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { EditSession } from "./types";

export class GooglePlayApiEndpoints {
  constructor(private androidPublisher: any) {}

  /**
   * Edit Operations
   */
  async createEdit(auth: any, packageName: string) {
    return this.androidPublisher.edits.insert({
      auth,
      packageName,
    });
  }

  async deleteEdit(session: EditSession) {
    return this.androidPublisher.edits.delete({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
    });
  }

  async commitEdit(session: EditSession) {
    return this.androidPublisher.edits.commit({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
    });
  }

  /**
   * App Details Operations
   */
  async getAppDetails(session: EditSession) {
    return this.androidPublisher.edits.details.get({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
    });
  }

  async updateAppDetails(
    session: EditSession,
    requestBody: Record<string, string>
  ) {
    return this.androidPublisher.edits.details.update({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
      requestBody,
    });
  }

  /**
   * Listing Operations
   */
  async listListings(session: EditSession) {
    return this.androidPublisher.edits.listings.list({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
    });
  }

  async getListing(session: EditSession, language: string) {
    return this.androidPublisher.edits.listings.get({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
      language,
    });
  }

  async updateListing(
    session: EditSession,
    language: string,
    requestBody: Record<string, string>
  ) {
    return this.androidPublisher.edits.listings.update({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
      language,
      requestBody,
    });
  }

  /**
   * Image Operations
   */
  async listImages(session: EditSession, language: string, imageType: string) {
    return this.androidPublisher.edits.images.list({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
      language,
      imageType,
    });
  }

  async uploadImage(
    session: EditSession,
    language: string,
    imageType: string,
    media: { mimeType: string; body: Buffer }
  ) {
    return this.androidPublisher.edits.images.upload({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
      language,
      imageType,
      media,
    });
  }

  /**
   * Track Operations
   */
  async getTrack(session: EditSession, track: string) {
    return this.androidPublisher.edits.tracks.get({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
      track,
    });
  }

  async updateTrack(session: EditSession, track: string, requestBody: any) {
    return this.androidPublisher.edits.tracks.update({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
      track,
      requestBody,
    });
  }

  async listTracks(session: EditSession) {
    return this.androidPublisher.edits.tracks.list({
      auth: session.auth,
      packageName: session.packageName,
      editId: session.editId,
    });
  }
}
