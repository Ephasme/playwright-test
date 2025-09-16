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
