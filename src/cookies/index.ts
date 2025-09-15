// Export all types and schemas
export * from './types.js';

// Export cookie transformation functionality
export * from './transformer.js';

// Export GCP loader functionality
export * from './gcp-loader.js';

// Main utility function that combines loading and transforming
import { Storage } from '@google-cloud/storage';
import { transformCookies } from './transformer.js';
import { loadCookiesFromGCP } from './gcp-loader.js';
import { type PlaywrightCookie, type GCPStorageConfig } from './types.js';

export type CookiesLoader = () => Promise<PlaywrightCookie[]>

/**
 * Loads cookies from Google Cloud Storage and transforms them to Playwright format
 * @param storage - Configured Google Cloud Storage instance
 * @param config - GCP storage configuration (bucket name, file name, etc.)
 * @returns Array of Playwright compatible cookies ready to use with browser context
 */
export function makeCookiesLoader(
  storage: Storage,
  config: GCPStorageConfig
): CookiesLoader {
  return async () => {
    const rawCookies = await loadCookiesFromGCP(storage, config);
    return transformCookies(rawCookies);
  };
}
