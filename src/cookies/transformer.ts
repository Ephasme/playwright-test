import { type RawCookie, type PlaywrightCookie } from './types.js';

/**
 * Maps sameSite value from raw cookie format to Playwright format
 * @param sameSite - Raw cookie sameSite value
 * @returns Playwright compatible sameSite value
 */
function mapSameSiteValue(sameSite: string): 'Strict' | 'Lax' | 'None' {
  if (sameSite === 'strict') return 'Strict';
  if (sameSite === 'lax') return 'Lax';
  if (sameSite === 'no_restriction') return 'None';
  if (sameSite === 'unspecified') return 'Lax';
  return 'Lax'; // default fallback
}

/**
 * Transforms a single raw cookie to Playwright cookie format
 * @param cookie - Raw cookie from cookies.json
 * @returns Playwright compatible cookie
 */
export function transformCookie(cookie: RawCookie): PlaywrightCookie {
  const sameSite = mapSameSiteValue(cookie.sameSite);

  // Build cookie object with only defined properties to satisfy exactOptionalPropertyTypes
  const playwrightCookie: PlaywrightCookie = {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: sameSite,
  };

  // Only add expires if expirationDate is defined
  if (cookie.expirationDate) {
    playwrightCookie.expires = Math.floor(cookie.expirationDate);
  }

  return playwrightCookie;
}

/**
 * Transforms an array of raw cookies to Playwright cookie format
 * @param rawCookies - Array of raw cookies from cookies.json
 * @returns Array of Playwright compatible cookies
 */
export function transformCookies(rawCookies: RawCookie[]): PlaywrightCookie[] {
  return rawCookies.map(transformCookie);
}
