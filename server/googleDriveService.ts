import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';

export class GoogleDriveService {
  private oauth2Client: OAuth2Client;
  private drive: any;

  constructor() {
    // We'll dynamically configure OAuth per user request
    this.oauth2Client = new OAuth2Client();
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  // Configure OAuth client with environment credentials
  configureOAuth(redirectUri: string) {
    // Check if Google OAuth credentials are available
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
    }
    
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  // Generate Google OAuth URL for user authentication
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  // Set tokens for authenticated requests
  setTokens(tokens: any) {
    this.oauth2Client.setCredentials(tokens);
  }

  // List PDF files from user's Google Drive
  async listPdfFiles(pageToken?: string) {
    try {
      const response = await this.drive.files.list({
        q: "mimeType='application/pdf' and trashed=false",
        fields: 'nextPageToken, files(id, name, size, modifiedTime, webViewLink, thumbnailLink)',
        pageSize: 20,
        pageToken,
        orderBy: 'modifiedTime desc'
      });

      return {
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      console.error('Error listing Google Drive files:', error);
      throw new Error('Failed to access Google Drive files');
    }
  }

  // Download file from Google Drive
  async downloadFile(fileId: string): Promise<{ buffer: Buffer, metadata: any }> {
    try {
      // Get file metadata
      const metadataResponse = await this.drive.files.get({
        fileId,
        fields: 'id, name, size, mimeType, modifiedTime'
      });

      // Download file content
      const response = await this.drive.files.get({
        fileId,
        alt: 'media'
      }, { responseType: 'arraybuffer' });

      return {
        buffer: Buffer.from(response.data),
        metadata: metadataResponse.data
      };
    } catch (error) {
      console.error('Error downloading file from Google Drive:', error);
      throw new Error('Failed to download file from Google Drive');
    }
  }

  // Search for files in Google Drive
  async searchFiles(query: string, pageToken?: string) {
    try {
      const searchQuery = `name contains '${query}' and mimeType='application/pdf' and trashed=false`;
      
      const response = await this.drive.files.list({
        q: searchQuery,
        fields: 'nextPageToken, files(id, name, size, modifiedTime, webViewLink, thumbnailLink)',
        pageSize: 20,
        pageToken,
        orderBy: 'modifiedTime desc'
      });

      return {
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      console.error('Error searching Google Drive files:', error);
      throw new Error('Failed to search Google Drive files');
    }
  }
}