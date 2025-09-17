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
    messages: any[]; // Using any[] for now as per previous simplification
}

export interface RecentMessagesResponse {
    total_channels_sampled: number;
    sample_channels: ChannelWithMessages[];
    all_channels: any[]; // Using any[] for now
}

export interface ConversationRepliesOptions {
    ts: string;                                    // Timestamp of the parent message to get replies for
    channel: string;                               // Channel ID
    inclusive?: boolean;                           // Include the parent message in results
    limit?: number;                                // Maximum number of replies to return
    oldest?: string;                               // Oldest message timestamp to include
    latest?: string;                               // Latest message timestamp to include
    cached_latest_updates?: Record<string, string>; // Cache optimization data
}

export interface ConversationRepliesResponse {
    ok: boolean;
    messages: any[]; // Using any[] to match existing pattern
    has_more?: boolean;
    response_metadata?: SlackResponseMetadata;
    error?: string;
}

export interface SlackBlock {
    type: string;
    elements?: any[];
    text?: {
        type: string;
        text: string;
    };
}

export interface PostMessageOptions {
    channel: string;                               // Channel ID to post to
    text?: string;                                 // Plain text message (alternative to blocks)
    blocks?: SlackBlock[];                         // Rich text blocks for formatted messages
    ts?: string;                                   // Message timestamp (for editing existing messages)
    thread_ts?: string;                            // Parent message timestamp (for threading)
    type?: string;                                 // Message type, defaults to "message"
    xArgs?: Record<string, any>;                   // Additional arguments (like draft_id)
    unfurl?: any[];                                // Unfurl configuration for links
    client_context_team_id?: string;               // Team ID for context
    draft_id?: string;                             // Draft ID for message drafts
    include_channel_perm_error?: boolean;          // Include permission errors in response
    client_msg_id?: string;                        // Client-side message ID for tracking
}

export interface PostMessageResponse {
    ok: boolean;
    channel?: string;
    ts?: string;                                   // Timestamp of the posted message
    message?: any;                                 // The posted message object
    error?: string;
    warning?: string;
}

export interface DeleteMessageOptions {
    channel: string;                               // Channel ID where the message is located
    ts: string;                                    // Timestamp of the message to delete
}

export interface DeleteMessageResponse {
    ok: boolean;
    channel?: string;
    ts?: string;                                   // Timestamp of the deleted message
    error?: string;
    warning?: string;
}
