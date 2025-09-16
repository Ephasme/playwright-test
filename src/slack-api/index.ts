import type { Cookie, Page } from "playwright";
import { type CookiesLoader } from "../cookies/index.js";
import { type ChromiumBrowser } from "playwright";
import axios from "axios";
import { type UserBootData, type ConversationHistoryResponse, type Channel, type ChatMessage } from "../types/index.js";
import fs from "fs";

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

export interface ChannelWithMessages {
    channel: {
        id: string;
        name: string;
        message_count: number;
    };
    messages: ChatMessage[];
}

export interface RecentMessagesResponse {
    total_channels_sampled: number;
    sample_channels: ChannelWithMessages[];
    all_channels: Channel[];
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
     * Creates base headers required for all Slack API requests
     */
    private createBaseHeaders(referer?: string): Record<string, string> {
        const cookieString = this.cookies
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');

        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Cookie': cookieString,
            'Origin': 'https://app.slack.com',
            'Pragma': 'no-cache',
            'Referer': referer || 'https://app.slack.com/',
            'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'X-Requested-With': 'XMLHttpRequest',
            'X-Slack-Version-Ts': Math.floor(Date.now() / 1000).toString()
        };
    }

    /**
     * Creates base form data with token and common parameters
     */
    private createBaseFormData(additionalParams: Record<string, string> = {}): URLSearchParams {
        const formData = new URLSearchParams();
        formData.append('token', this.token);

        // Add any additional parameters
        Object.entries(additionalParams).forEach(([key, value]) => {
            formData.append(key, value);
        });

        return formData;
    }

    /**
     * Makes a generic Slack API request
     */
    private async makeSlackApiRequest(endpoint: string, params: Record<string, string> = {}, referer?: string): Promise<any> {
        const formData = this.createBaseFormData(params);
        const headers = this.createBaseHeaders(referer);

        console.log('🔍 Making Slack API request to:', endpoint);
        console.log('🎯 Token (first 20 chars):', this.token.substring(0, 20) + '...');
        console.log('🍪 Cookie count:', this.cookies.length);
        console.log('📝 Form data being sent:', formData.toString());

        const response = await axios.post(endpoint, formData, {
            headers,
            timeout: 30000,
            responseType: 'json',
            validateStatus: (status) => status < 400
        });

        console.log('✅ API Response status:', response.status);
        console.log('📊 Response content type:', response.headers['content-type']);

        // Check if we got HTML (login page) instead of JSON
        if (typeof response.data === 'string' && response.data.includes('<html>')) {
            throw new Error('Received HTML response (likely login page) - authentication failed. Check your token and cookie.');
        }

        // Log the actual response structure for debugging
        console.log('📋 Response data keys:', Object.keys(response.data));
        console.log('📋 Response.ok value:', response.data.ok);

        if (!response.data.ok) {
            // Much more detailed error information
            const errorDetails = {
                ok: response.data.ok,
                error: response.data.error,
                warning: response.data.warning,
                needed: response.data.needed,
                provided: response.data.provided,
                endpoint: endpoint,
                formData: formData.toString()
            };

            console.error('❌ Detailed Slack API error:', JSON.stringify(errorDetails, null, 2));

            throw new Error(`Slack API error: ${response.data.error ||
                response.data.warning ||
                `API returned ok:false without error message. Endpoint: ${endpoint}`
                }`);
        }

        return response.data;
    }

    /**
     * Calls Slack's REAL client.userBoot API - the main bootstrap endpoint
     * Based on reverse engineering from HAR file analysis and slackdump implementation
     * Returns complete workspace data: channels, user info, settings, etc.
     * Now validates the response using Zod schemas for type safety.
     */
    async clientUserBoot(workspaceUrl: string): Promise<UserBootData> {
        const endpoint = 'https://app.slack.com/api/client.userBoot';

        // client.userBoot specific parameters
        const params = {
            'min_channel_updated': '0',
            'include_min_version_bump_check': '1',
            'version_ts': Math.floor(Date.now() / 1000).toString(),
            'build_version_ts': Math.floor(Date.now() / 1000).toString(),
            '_x_reason': 'initial-data',
            '_x_mode': 'online',
            '_x_sonic': 'true',
            '_x_app_name': 'client'
        };

        console.log('🌍 Workspace URL:', workspaceUrl);

        const response = await this.makeSlackApiRequest(endpoint, params, workspaceUrl);

        // Use type assertion instead of validation
        const validatedData = response as UserBootData;

        console.log('✅ UserBoot response processed successfully!');
        console.log(`📋 Found ${validatedData.channels?.length || 0} channels in userBoot response`);
        console.log(`👤 User: ${validatedData.self?.real_name || 'Unknown'}`);
        console.log(`🏢 Team: ${validatedData.team?.name || 'Unknown'}`);

        // Note: Unread message information might be stored elsewhere in the userBootData
        // The channels array doesn't contain unread_count_display in the actual structure
        if (validatedData.channels) {
            console.log(`📋 Available channels: ${validatedData.channels.slice(0, 5).map(c => c.name).join(', ')}${validatedData.channels.length > 5 ? '...' : ''}`);
        }

        return validatedData;
    }

    /**
     * Gets all conversations (channels, DMs, groups) the user is part of
     * This is equivalent to slackdump's conversations.list endpoint
     */
    async getConversationsList(types: string = 'public_channel,private_channel,mpim,im'): Promise<any> {
        const endpoint = 'https://app.slack.com/api/conversations.list';

        const params = {
            'types': types,
            'exclude_archived': 'false',
            'limit': '1000'  // Get as many as possible in one call
        };

        return await this.makeSlackApiRequest(endpoint, params);
    }

    /**
     * Gets message history from a specific conversation/channel
     * This is equivalent to slackdump's conversations.history endpoint
     * Can be used to get recent messages or filter for unread content
     * Now validates the response using Zod schemas for type safety.
     */
    async getConversationHistory(
        channelId: string,
        options: {
            oldest?: string,        // Timestamp - get messages after this
            latest?: string,        // Timestamp - get messages before this  
            limit?: number,         // Number of messages to return
            inclusive?: boolean     // Include messages with latest and oldest timestamps
        } = {}
    ): Promise<ConversationHistoryResponse> {
        const endpoint = 'https://app.slack.com/api/conversations.history';

        const params: Record<string, string> = {
            'channel': channelId,
            'limit': (options.limit || 100).toString()
        };

        if (options.oldest) params.oldest = options.oldest;
        if (options.latest) params.latest = options.latest;
        if (options.inclusive !== undefined) params.inclusive = options.inclusive.toString();

        const response = await this.makeSlackApiRequest(endpoint, params);

        // Use type assertion instead of validation
        const validatedData = response as ConversationHistoryResponse;

        console.log('✅ Conversation history response processed successfully!');
        console.log(`📨 Found ${validatedData.messages?.length || 0} messages in response`);

        return validatedData;
    }

    /**
     * Helper method to get recent messages from sample channels
     * This analyzes the userBoot response and fetches recent messages from a few channels
     * Note: Unread information is not available in the channel objects from userBoot
     * Now returns properly typed response with full type safety.
     */
    async getRecentMessages(workspaceUrl: string): Promise<RecentMessagesResponse> {
        console.log('🔍 Starting recent messages collection...');

        // First get the bootstrap data with channel information
        const userBootData = await this.clientUserBoot(workspaceUrl);

        if (!userBootData.channels) {
            throw new Error('No channels found in userBoot response');
        }

        // Note: Since unread_count_display is not part of the actual channel structure,
        // we'll get recent messages from all channels instead
        console.log(`🎯 Getting recent messages from first 5 channels as example...`);

        const unreadResults: ChannelWithMessages[] = [];
        const sampleChannels = userBootData.channels.slice(0, 5); // Just sample first 5 channels

        for (const channel of sampleChannels) {
            try {
                console.log(`📨 Getting recent messages from ${channel.name}...`);

                // Get recent message history (limit to 20 messages per channel)
                const history = await this.getConversationHistory(channel.id, {
                    limit: 20
                });

                fs.writeFileSync(`${channel.name}.json`, JSON.stringify(history, null, 2));

                unreadResults.push({
                    channel: {
                        id: channel.id,
                        name: channel.name,
                        message_count: history.messages?.length || 0
                    },
                    messages: history.messages || []
                });

                // Be nice to Slack's API - small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                console.error(`❌ Failed to get messages from ${channel.name}:`, error);
            }
        }

        return {
            total_channels_sampled: sampleChannels.length,
            sample_channels: unreadResults,
            all_channels: userBootData.channels  // Include full channel data for reference
        };
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