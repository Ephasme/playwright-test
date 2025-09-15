import type { Cookie, Page } from "playwright";
import { type CookiesLoader } from "../cookies/index.js";
import { type ChromiumBrowser } from "playwright";
import axios from "axios";
import { randomUUID } from "crypto";

// Regular expression to match Slack xoxc tokens (based on slackdump pattern)
const XOXC_TOKEN_REGEX = /xoxc-[0-9]+-[0-9]+-[0-9]+-[0-9a-z]{64}/;

// Slack API Types
export interface SlackChannel {
    id: string;
    name: string;
    is_channel: boolean;
    is_group?: boolean;
    is_im?: boolean;
    is_mpim?: boolean;
    is_private?: boolean;
    is_archived?: boolean;
    created: number;
    creator: string;
    is_shared?: boolean;
    is_org_shared?: boolean;
    shared_team_ids?: string[];
    purpose?: {
        value: string;
        creator: string;
        last_set: number;
    };
    topic?: {
        value: string;
        creator: string;
        last_set: number;
    };
    num_members?: number;
}

export interface SlackResponseMetadata {
    next_cursor?: string;
}

export interface SlackConversationsListResponse {
    ok: boolean;
    channels: SlackChannel[];
    response_metadata?: SlackResponseMetadata;
    error?: string;
}

export interface ChannelListOptions {
    cursor?: string;
    exclude_archived?: boolean;
    limit?: number;
    team_id?: string;
    types?: string; // e.g., "public_channel,private_channel"
}

/**
 * Extracts Slack xoxc token from form data
 * Based on slackdump's token extraction logic
 * @param formData - Raw form data string from POST request
 * @returns The extracted xoxc token or null if not found
 */
function extractTokenFromFormData(formData: string): string | null {
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

export class SlackApi {
    private token: string;
    private cookies: Cookie[];

    constructor(token: string, cookies: Cookie[] = []) {
        this.token = token;
        this.cookies = cookies;
    }

    /**
     * Calls Slack's REAL client.userBoot API - the main bootstrap endpoint
     * Based on reverse engineering from HAR file analysis and slackdump implementation
     * Returns complete workspace data: channels, user info, settings, etc.
     */
    async clientUserBoot(workspaceUrl: string): Promise<any> {
        try {
            // Convert all cookies to cookie string (name=value; name=value; ...)
            const cookieString = this.cookies
                .map(cookie => `${cookie.name}=${cookie.value}`)
                .join('; ');

            // Use the correct Slack API endpoint format
            // The API is hosted on app.slack.com, not the workspace URL
            const endpoint = `https://app.slack.com/api/client.userBoot`;

            // Prepare form data based on slackdump's client.userBoot call
            const formData = new URLSearchParams();
            formData.append('token', this.token);
            formData.append('min_channel_updated', '0');
            formData.append('include_min_version_bump_check', '1');
            formData.append('version_ts', Math.floor(Date.now() / 1000).toString());
            formData.append('build_version_ts', Math.floor(Date.now() / 1000).toString());
            formData.append('_x_reason', 'initial-data');
            formData.append('_x_mode', 'online');
            formData.append('_x_sonic', 'true');
            formData.append('_x_app_name', 'client');

            console.log('🔍 Using REAL client.userBoot endpoint:', endpoint);
            console.log('🎯 Token (first 20 chars):', this.token.substring(0, 20) + '...');
            console.log('🍪 Cookie count:', this.cookies.length);
            console.log('🌍 Workspace URL:', workspaceUrl);
            console.log('📝 Form data being sent:', formData.toString());

            const response = await axios.post(endpoint, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Cookie': cookieString,
                    'Origin': 'https://app.slack.com',
                    'Pragma': 'no-cache',
                    'Referer': workspaceUrl,
                    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"macOS"',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'X-Requested-With': 'XMLHttpRequest',
                    // Critical Slack API headers
                    'X-Slack-Version-Ts': Math.floor(Date.now() / 1000).toString(),
                    'Authorization': `Bearer ${this.token}`
                },
                timeout: 30000,
                // Important: Tell axios to expect JSON but handle text responses
                responseType: 'json',
                validateStatus: (status) => status < 400
            });

            console.log('✅ client.userBoot Response status:', response.status);
            console.log('📊 Response content type:', response.headers['content-type']);

            // Check if we got HTML (login page) instead of JSON
            if (typeof response.data === 'string' && response.data.includes('<html>')) {
                throw new Error('Received HTML response (likely login page) - authentication failed. Check your token and cookie.');
            }

            // Log the actual response structure for debugging
            console.log('📋 Full response data structure:', JSON.stringify(response.data, null, 2));
            console.log('📋 Response data keys:', Object.keys(response.data));
            console.log('📋 Response.ok value:', response.data.ok);
            console.log('📋 Response.error value:', response.data.error);

            if (response.data.channels) {
                console.log(`📋 Found ${response.data.channels.length} channels in userBoot response`);
            }

            if (!response.data.ok) {
                // Much more detailed error information
                const errorDetails = {
                    ok: response.data.ok,
                    error: response.data.error,
                    warning: response.data.warning,
                    needed: response.data.needed,
                    provided: response.data.provided,
                    fullResponse: response.data
                };

                console.error('❌ Detailed Slack API error:', JSON.stringify(errorDetails, null, 2));

                throw new Error(`Slack client.userBoot API error: ${response.data.error ||
                    response.data.warning ||
                    `API returned ok:false without error message. Full response: ${JSON.stringify(response.data)}`
                    }`);
            }

            return response.data;

        } catch (error) {
            console.error('❌ Slack client.userBoot API call failed:', error);
            if (axios.isAxiosError(error)) {
                console.error('Response status:', error.response?.status);
                console.error('Response headers:', error.response?.headers);
                console.error('Response data (first 500 chars):',
                    typeof error.response?.data === 'string'
                        ? error.response.data.substring(0, 500)
                        : error.response?.data
                );
            }
            throw error;
        }
    }


    /**
     * Get the current token
     */
    getToken(): string {
        return this.token;
    }
}

export class SlackApiFactory {

    private cookiesLoader: CookiesLoader;
    private workspaceUrl: string;
    private browser: ChromiumBrowser;

    constructor(cookiesLoader: CookiesLoader, workspaceUrl: string, browser: ChromiumBrowser) {
        this.cookiesLoader = cookiesLoader;
        this.workspaceUrl = workspaceUrl;
        this.browser = browser;
    }

    public async createSlackApi(): Promise<SlackApi> {
        const context = await this.browser.newContext();
        const page = await context.newPage();
        const authResult = await interceptSlackAuthWithCookies(
            page,
            this.cookiesLoader,
            this.workspaceUrl
        );
        console.log('✅ Captured token:', authResult.token);
        console.log('✅ Captured cookies:', authResult.cookies.length);

        // Clean up the browser context
        await context.close();

        return new SlackApi(authResult.token, authResult.cookies);
    }

}