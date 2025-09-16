import { z } from 'zod';

// Zod schema for raw cookie data from cookies.json
export const RawCookieSchema = z.object({
    domain: z.string(),
    expirationDate: z.number().optional(),
    hostOnly: z.boolean(),
    httpOnly: z.boolean(),
    name: z.string(),
    path: z.string(),
    sameSite: z.string(),
    secure: z.boolean(),
    session: z.boolean(),
    storeId: z.string(),
    value: z.string(),
});

// Schema for array of cookies
export const RawCookiesArraySchema = z.array(RawCookieSchema);

// Playwright cookie schema - matching the exact Playwright cookie interface
// Note: Using separate interface for better exactOptionalPropertyTypes compatibility
export interface PlaywrightCookie {
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    partitionKey?: string;
}

export type RawCookie = z.infer<typeof RawCookieSchema>;

// GCP Configuration interface for file operations only
export interface GCPStorageConfig {
    bucketName: string;
    fileName: string;
}

// Environment configuration for Storage client creation
export interface GCPEnvironmentConfig {
    projectId?: string;
    keyFilename?: string;
    // Can be extended with other GCP auth options
}
