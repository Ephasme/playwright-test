import { Storage } from '@google-cloud/storage';
import { transformCookie } from './transformCookie.js';
import {
    RawCookiesArraySchema,
    type PlaywrightCookie,
    type GCPStorageConfig
} from './types.js';

export type CookiesLoader = () => Promise<PlaywrightCookie[]>

/**
 * Loads cookies from Google Cloud Storage and transforms them to Playwright format
 * @param storage - Configured Google Cloud Storage instance
 * @param config - GCP storage configuration (bucket name, file name, etc.)
 * @returns A function that loads and transforms cookies from GCP
 */
export function makeCookiesLoader(
    storage: Storage,
    config: GCPStorageConfig
): CookiesLoader {
    return async () => {
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

            // Validate and transform cookies in one step
            const rawCookies = RawCookiesArraySchema.parse(cookiesData);
            return rawCookies.map(transformCookie);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to load cookies from GCP: ${error.message}`);
            }
            throw new Error('Failed to load cookies from GCP: Unknown error');
        }
    };
}
