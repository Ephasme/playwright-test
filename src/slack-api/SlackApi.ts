import type { Cookie } from "playwright";
import axios from "axios";
import { randomUUID } from "crypto";
import { z } from "zod";
import { type ClientUserBootResponse, type ConversationHistoryResponse, ConversationHistoryResponseSchema } from "../types/index.js";
import { type SlackConversationsListResponse, type ChannelWithMessages, type RecentMessagesResponse, type ConversationRepliesResponse, type PostMessageOptions, type PostMessageResponse, type DeleteMessageOptions, type DeleteMessageResponse, SlackApiResponseSchema, SlackConversationsListResponseSchema, ClientUserBootResponseSchema, ConversationRepliesResponseSchema, PostMessageResponseSchema, DeleteMessageResponseSchema } from "../types/index.js";

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
     * Makes a generic Slack API request with schema validation
     */
    private async makeSlackApiRequest<T extends z.ZodType>(
        endpoint: string,
        schema: T,
        params: Record<string, string> = {},
        referer?: string
    ): Promise<z.infer<T>> {
        const formData = this.createBaseFormData(params);
        const headers = this.createBaseHeaders(referer);

        const response = await axios.post(endpoint, formData, {
            headers,
            timeout: 30000,
            responseType: 'json',
            validateStatus: (status) => status < 400
        });

        // Check if we got HTML (login page) instead of JSON
        if (typeof response.data === 'string' && response.data.includes('<html>')) {
            throw new Error('Received HTML response (likely login page) - authentication failed. Check your token and cookie.');
        }

        console.log('response.data', JSON.stringify(response.data, null, 2));

        // First validate the basic Slack API response structure
        const baseResponse = SlackApiResponseSchema.parse(response.data);

        if (!baseResponse.ok) {
            // Much more detailed error information
            const errorDetails = {
                ok: baseResponse.ok,
                error: baseResponse.error,
                warning: baseResponse.warning,
                needed: baseResponse.needed,
                provided: baseResponse.provided,
                endpoint: endpoint,
                formData: formData.toString()
            };

            console.error('❌ Detailed Slack API error:', JSON.stringify(errorDetails, null, 2));

            throw new Error(`Slack API error: ${baseResponse.error ||
                baseResponse.warning ||
                `API returned ok:false without error message. Endpoint: ${endpoint}`
                }`);
        }

        // Now validate and return with the specific schema
        return schema.parse(response.data) as z.infer<T>;
    }

    /**
     * Calls Slack's REAL client.userBoot API - the main bootstrap endpoint
     * Based on reverse engineering from HAR file analysis and slackdump implementation
     * Returns complete workspace data: channels, user info, settings, etc.
     * Now validates the response using Zod schemas for type safety.
     */
    async clientUserBoot(workspaceUrl: string): Promise<ClientUserBootResponse> {
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


        const validatedData = await this.makeSlackApiRequest(endpoint, ClientUserBootResponseSchema, params, workspaceUrl);

        return validatedData;
    }

    /**
     * Gets all conversations (channels, DMs, groups) the user is part of
     * This is equivalent to slackdump's conversations.list endpoint
     */
    async getConversationsList(types: string = 'public_channel,private_channel,mpim,im'): Promise<SlackConversationsListResponse> {
        const endpoint = 'https://app.slack.com/api/conversations.list';

        const params = {
            'types': types,
            'exclude_archived': 'false',
            'limit': '1000'  // Get as many as possible in one call
        };

        return await this.makeSlackApiRequest(endpoint, SlackConversationsListResponseSchema, params);
    }

    /**
     * Gets message history from a specific conversation/channel
     * This is equivalent to slackdump's conversations.history endpoint
     * Can be used to get recent messages or filter for unread content
     * Now supports all real Slack API parameters as captured from browser FormData
     */
    async getConversationHistory(
        channelId: string,
        options: {
            oldest?: string,                           // Timestamp - get messages after this
            latest?: string,                           // Timestamp - get messages before this  
            limit?: number,                            // Number of messages to return
            inclusive?: boolean,                       // Include messages with latest and oldest timestamps
            ignore_replies?: boolean,                  // Ignore threaded replies
            include_pin_count?: boolean,               // Include pin count information
            no_user_profile?: boolean,                 // Don't include user profile information
            include_stories?: boolean,                 // Include stories in response
            include_free_team_extra_messages?: boolean, // Include extra messages for free teams
            include_date_joined?: boolean,             // Include date joined information
            cached_latest_updates?: Record<string, string> // Cache info for latest updates
        } = {}
    ): Promise<ConversationHistoryResponse> {
        const endpoint = 'https://app.slack.com/api/conversations.history';

        const params: Record<string, string> = {
            'channel': channelId,
            'limit': (options.limit || 28).toString() // Default to 28 like the real client
        };

        // Basic timestamp parameters
        if (options.oldest) params.oldest = options.oldest;
        if (options.latest) params.latest = options.latest;
        if (options.inclusive !== undefined) params.inclusive = options.inclusive.toString();

        // Boolean flags - convert to string
        if (options.ignore_replies !== undefined) params.ignore_replies = options.ignore_replies.toString();
        if (options.include_pin_count !== undefined) params.include_pin_count = options.include_pin_count.toString();
        if (options.no_user_profile !== undefined) params.no_user_profile = options.no_user_profile.toString();
        if (options.include_stories !== undefined) params.include_stories = options.include_stories.toString();
        if (options.include_free_team_extra_messages !== undefined) params.include_free_team_extra_messages = options.include_free_team_extra_messages.toString();
        if (options.include_date_joined !== undefined) params.include_date_joined = options.include_date_joined.toString();

        // Cached updates - JSON stringify the object
        if (options.cached_latest_updates) params.cached_latest_updates = JSON.stringify(options.cached_latest_updates);

        // Internal Slack tracking parameters - hardcoded to mimic real client behavior
        params._x_reason = 'message-pane/requestHistory';
        params._x_mode = 'online';
        params._x_sonic = 'true';
        params._x_app_name = 'client';

        const validatedData = await this.makeSlackApiRequest(endpoint, ConversationHistoryResponseSchema, params);

        return validatedData;
    }

    /**
     * Gets replies to a specific message in a conversation/channel thread
     * This is equivalent to the Slack web client's conversations.replies endpoint
     * Used to fetch threaded replies to a parent message
     */
    async getConversationReplies(
        channelId: string,
        messageTimestamp: string,
        options: {
            inclusive?: boolean;                           // Include the parent message in results
            limit?: number;                                // Number of replies to return
            oldest?: string;                               // Oldest message timestamp to include
            latest?: string;                               // Latest message timestamp to include
            cached_latest_updates?: Record<string, string> // Cache info for latest updates
        } = {}
    ): Promise<ConversationRepliesResponse> {
        const endpoint = 'https://app.slack.com/api/conversations.replies';

        const params: Record<string, string> = {
            'channel': channelId,
            'ts': messageTimestamp,
            'limit': (options.limit || 28).toString() // Default to 28 like the real client
        };

        // Basic parameters
        if (options.inclusive !== undefined) params.inclusive = options.inclusive.toString();
        if (options.oldest) params.oldest = options.oldest;
        if (options.latest) params.latest = options.latest;

        // Cached updates - JSON stringify the object
        if (options.cached_latest_updates) params.cached_latest_updates = JSON.stringify(options.cached_latest_updates);

        // Internal Slack tracking parameters - hardcoded to mimic real client behavior
        params._x_reason = 'history-api/fetchReplies';
        params._x_mode = 'online';
        params._x_sonic = 'true';
        params._x_app_name = 'client';

        const validatedData = await this.makeSlackApiRequest(endpoint, ConversationRepliesResponseSchema, params);

        return validatedData;
    }

    /**
     * Posts a message to a Slack channel
     * This is equivalent to the Slack web client's chat.postMessage endpoint
     * Supports both plain text and rich text blocks (Block Kit format)
     */
    async postMessage(options: PostMessageOptions): Promise<PostMessageResponse> {
        const endpoint = 'https://app.slack.com/api/chat.postMessage';

        const params: Record<string, string> = {
            'channel': options.channel,
            'type': options.type || 'message'
        };

        // Message content - prefer blocks over text for rich formatting
        if (options.blocks) {
            params.blocks = JSON.stringify(options.blocks);
        } else if (options.text) {
            params.text = options.text;
        }

        // Optional parameters
        if (options.ts) params.ts = options.ts;
        if (options.thread_ts) params.thread_ts = options.thread_ts;
        if (options.xArgs) params.xArgs = JSON.stringify(options.xArgs);
        if (options.unfurl) params.unfurl = JSON.stringify(options.unfurl);
        if (options.client_context_team_id) params.client_context_team_id = options.client_context_team_id;
        if (options.draft_id) params.draft_id = options.draft_id;
        if (options.include_channel_perm_error !== undefined) params.include_channel_perm_error = options.include_channel_perm_error.toString();

        // Generate client_msg_id if not provided (for message tracking)
        params.client_msg_id = options.client_msg_id || randomUUID();

        // Internal Slack tracking parameters - hardcoded to mimic real client behavior
        params._x_reason = 'webapp_message_send';
        params._x_mode = 'online';
        params._x_sonic = 'true';
        params._x_app_name = 'client';

        const validatedData = await this.makeSlackApiRequest(endpoint, PostMessageResponseSchema, params);

        return validatedData;
    }

    /**
     * Deletes a message from a Slack channel
     * This is equivalent to the Slack web client's chat.delete endpoint
     * Requires the channel ID and message timestamp to identify the message to delete
     */
    async deleteMessage(options: DeleteMessageOptions): Promise<DeleteMessageResponse> {
        const endpoint = 'https://app.slack.com/api/chat.delete';

        const params: Record<string, string> = {
            'channel': options.channel,
            'ts': options.ts
        };

        // Internal Slack tracking parameters - hardcoded to mimic real client behavior
        params._x_reason = 'animateAndDeleteMessageApi';
        params._x_mode = 'online';
        params._x_sonic = 'true';
        params._x_app_name = 'client';

        const validatedData = await this.makeSlackApiRequest(endpoint, DeleteMessageResponseSchema, params);

        return validatedData;
    }

    /**
     * Helper method to create a simple text message using Block Kit format
     * This is useful when you want to send formatted text messages
     */
    createTextBlocks(text: string): Record<string, unknown>[] {
        return [
            {
                type: "rich_text",
                elements: [
                    {
                        type: "rich_text_section",
                        elements: [
                            {
                                type: "text",
                                text: text
                            }
                        ]
                    }
                ]
            }
        ];
    }

    /**
     * Helper method to get recent messages from sample channels
     * This analyzes the clientUserBoot response and fetches recent messages from a few channels
     * Note: Unread information is not available in the channel objects from clientUserBoot
     * Now returns properly typed response with full type safety.
     */
    async getRecentMessages(workspaceUrl: string): Promise<RecentMessagesResponse> {

        // First get the bootstrap data with channel information
        const clientUserBootData = await this.clientUserBoot(workspaceUrl);

        if (!clientUserBootData.channels) {
            throw new Error('No channels found in clientUserBoot response');
        }

        // Note: Since unread_count_display is not part of the actual channel structure,
        // we'll get recent messages from all channels instead

        const unreadResults: ChannelWithMessages[] = [];
        const sampleChannels = clientUserBootData.channels.slice(0, 5); // Just sample first 5 channels

        for (const channel of sampleChannels) {
            try {

                // Get recent message history with realistic Slack client parameters
                const history = await this.getConversationHistory(channel.id, {
                    limit: 28,                               // Default from real client
                    ignore_replies: true,                    // Ignore threaded replies like real client
                    include_pin_count: true,                 // Include pin count info
                    inclusive: true,                         // Include boundary messages
                    no_user_profile: true,                   // Don't fetch user profiles for performance
                    include_stories: true,                   // Include stories
                    include_free_team_extra_messages: true,  // Include extra messages
                    include_date_joined: false               // Don't include join dates
                });

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
            all_channels: clientUserBootData.channels  // Include full channel data for reference
        };
    }

    /**
     * Get the current token
     */
    getToken(): string {
        return this.token;
    }
}
