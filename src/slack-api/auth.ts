import type { Cookie, Page } from "playwright";
import { type CookiesLoader } from "../cookie-management/index.js";

// Regular expression to match Slack xoxc tokens (based on slackdump pattern)
const XOXC_TOKEN_REGEX = /xoxc-[0-9]+-[0-9]+-[0-9]+-[0-9a-z]{64}/;

/**
 * Extracts Slack xoxc token from form data
 * Based on slackdump's token extraction logic
 * @param formData - Raw form data string from POST request
 * @returns The extracted xoxc token or null if not found
 */
export function extractTokenFromFormData(formData: string): string | null {
    if (!formData) {
        return null;
    }

    try {
        // Handle URL-encoded form data (application/x-www-form-urlencoded)
        if (formData.includes('=') && !formData.includes('Content-Disposition')) {
            const params = new URLSearchParams(formData);
            const token = params.get('token');

            if (token && XOXC_TOKEN_REGEX.test(token)) {
                return token;
            }
        }

        // Handle multipart form data (multipart/form-data)
        else if (formData.includes('Content-Disposition')) {
            // Look for token field in multipart data
            const tokenMatch = formData.match(/name="token"[\s\S]*?\r?\n\r?\n(xoxc-[^\r\n]+)/);
            if (tokenMatch && tokenMatch[1]) {
                const token = tokenMatch[1].trim();
                if (XOXC_TOKEN_REGEX.test(token)) {
                    return token;
                }
            }
        }

        // Fallback: search for any xoxc token in the entire form data
        const directMatch = formData.match(XOXC_TOKEN_REGEX);
        if (directMatch && directMatch[0]) {
            return directMatch[0];
        }

    } catch (error) {
        console.warn('Error parsing form data for token:', error);
    }

    return null;
}

export async function interceptSlackAuthWithCookies(
    page: Page,
    cookiesLoader: CookiesLoader,
    workspaceUrl: string
): Promise<{ token: string, cookies: Cookie[] }> {

    let capturedToken: string | null = null;

    // Load your existing cookies first
    const existingCookies = await cookiesLoader();
    await page.context().addCookies(existingCookies);

    // Create a promise that resolves when token is captured
    const tokenPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Token capture timeout after 30 seconds'));
        }, 30000);

        // Set up token interception BEFORE navigation  
        page.route('**/api/api.features*', route => {
            const formData = route.request().postData();
            if (formData) {
                const token = extractTokenFromFormData(formData);
                if (token?.startsWith('xoxc-')) {
                    capturedToken = token;
                    clearTimeout(timeout);
                    resolve(token);
                }
            }
            route.continue();
        });
    });

    // Navigate with cookies - should trigger automatic API calls
    await page.goto(workspaceUrl);

    // Wait for token capture
    const token = await tokenPromise;

    // Get all cookies from the authenticated session
    const allCookies = await page.context().cookies();

    return {
        token,
        cookies: allCookies
    };
}
