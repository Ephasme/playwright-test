import { Storage } from '@google-cloud/storage';
import {
  RawCookiesArraySchema,
  type RawCookie,
  type GCPStorageConfig,
} from './types.js';

/**
 * Downloads cookies from Google Cloud Storage and validates them
 * @param storage - Configured Google Cloud Storage instance
 * @param config - GCP storage configuration (bucket name, file name, etc.)
 * @returns Array of validated raw cookies
 */
export async function loadCookiesFromGCP(
  storage: Storage,
  config: GCPStorageConfig
): Promise<RawCookie[]> {
  try {
    // Get reference to bucket and file
    const bucket = storage.bucket(config.bucketName);
    const file = bucket.file(config.fileName);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(
        `File ${config.fileName} does not exist in bucket ${config.bucketName}`
      );
    }

    // Download file content as buffer
    const [contents] = await file.download();

    // Parse JSON content
    const cookiesData = JSON.parse(contents.toString('utf-8'));

    // Validate and return cookies
    return RawCookiesArraySchema.parse(cookiesData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load cookies from GCP: ${error.message}`);
    }
    throw new Error('Failed to load cookies from GCP: Unknown error');
  }
}

/**
 * Downloads cookies from GCP to a local file, then loads them
 * @param storage - Configured Google Cloud Storage instance
 * @param config - GCP storage configuration
 * @param localPath - Local path to save the downloaded file
 * @returns Array of validated raw cookies
 */
export async function downloadAndLoadCookiesFromGCP(
  storage: Storage,
  config: GCPStorageConfig,
  localPath: string
): Promise<RawCookie[]> {
  try {
    // Get reference to bucket and file
    const bucket = storage.bucket(config.bucketName);
    const file = bucket.file(config.fileName);

    // Download file to local path
    await file.download({ destination: localPath });

    console.log(
      `Downloaded ${config.fileName} from ${config.bucketName} to ${localPath}`
    );

    // Load and validate the downloaded file directly
    const fs = await import('fs');
    const cookiesData = fs.readFileSync(localPath, 'utf-8');
    const rawCookiesData = JSON.parse(cookiesData);
    return RawCookiesArraySchema.parse(rawCookiesData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to download and load cookies from GCP: ${error.message}`
      );
    }
    throw new Error(
      'Failed to download and load cookies from GCP: Unknown error'
    );
  }
}
