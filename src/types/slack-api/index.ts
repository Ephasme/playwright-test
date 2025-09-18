import { z } from 'zod';
import {
    StringId,
    TimestampString,
    BooleanFlag,
    DndSchema,
    AccountTypesSchema,
    ChannelsPrioritySchema,
    LinksSchema,
    SubteamsSchema
} from '../base.js';
import { ChannelSchema } from '../channel/index.js';
import { SimpleTeamSchema, WorkspaceSchema } from '../team/index.js';
import { SelfUserSchema, ImSchema } from '../user/index.js';

// Slack API Zod Schemas

export const SlackApiResponseSchema = z.object({
    ok: z.boolean(),
    error: z.string().optional(),
    warning: z.string().optional(),
    needed: z.string().optional(),
    provided: z.string().optional(),
});

const SlackChannelPurposeTopicSchema = z.object({
    value: z.string(),
    creator: z.string(),
    last_set: z.number(),
});

export const SlackChannelSchema = z.object({
    id: z.string(),
    name: z.string(),
    is_channel: z.boolean(),
    is_group: z.boolean().optional(),
    is_im: z.boolean().optional(),
    is_mpim: z.boolean().optional(),
    is_private: z.boolean().optional(),
    is_archived: z.boolean().optional(),
    created: z.number(),
    creator: z.string(),
    is_shared: z.boolean().optional(),
    is_org_shared: z.boolean().optional(),
    shared_team_ids: z.array(z.string()).optional(),
    purpose: SlackChannelPurposeTopicSchema.optional(),
    topic: SlackChannelPurposeTopicSchema.optional(),
    num_members: z.number().optional(),
});

export const SlackResponseMetadataSchema = z.object({
    next_cursor: z.string().optional(),
});

export const SlackConversationsListResponseSchema = SlackApiResponseSchema.extend({
    channels: z.array(SlackChannelSchema),
    response_metadata: SlackResponseMetadataSchema.optional(),
});

export const ChannelListOptionsSchema = z.object({
    cursor: z.string().optional(),
    exclude_archived: z.boolean().optional(),
    limit: z.number().optional(),
    team_id: z.string().optional(),
    types: z.string().optional(), // e.g., "public_channel,private_channel"
});

export const ChannelWithMessagesSchema = z.object({
    channel: z.object({
        id: z.string(),
        name: z.string(),
        message_count: z.number(),
    }),
    messages: z.array(z.record(z.string(), z.unknown())), // Message objects from Slack API
});

export const RecentMessagesResponseSchema = z.object({
    total_channels_sampled: z.number(),
    sample_channels: z.array(ChannelWithMessagesSchema),
    all_channels: z.array(z.record(z.string(), z.unknown())), // Channel objects from Slack API
});

export const ConversationRepliesOptionsSchema = z.object({
    ts: z.string(),                                    // Timestamp of the parent message to get replies for
    channel: z.string(),                               // Channel ID
    inclusive: z.boolean().optional(),                 // Include the parent message in results
    limit: z.number().optional(),                      // Maximum number of replies to return
    oldest: z.string().optional(),                     // Oldest message timestamp to include
    latest: z.string().optional(),                     // Latest message timestamp to include
    cached_latest_updates: z.record(z.string(), z.string()).optional(), // Cache optimization data
});

export const ConversationRepliesResponseSchema = SlackApiResponseSchema.extend({
    messages: z.array(z.record(z.string(), z.unknown())), // Reply message objects from Slack API
    has_more: z.boolean().optional(),
    response_metadata: SlackResponseMetadataSchema.optional(),
});

export const SlackBlockSchema = z.object({
    type: z.string(),
    elements: z.array(z.record(z.string(), z.unknown())).optional(),
    text: z.object({
        type: z.string(),
        text: z.string(),
    }).optional(),
});

export const PostMessageOptionsSchema = z.object({
    channel: z.string(),                               // Channel ID to post to
    text: z.string().optional(),                       // Plain text message (alternative to blocks)
    blocks: z.array(SlackBlockSchema).optional(),      // Rich text blocks for formatted messages
    ts: z.string().optional(),                         // Message timestamp (for editing existing messages)
    thread_ts: z.string().optional(),                  // Parent message timestamp (for threading)
    type: z.string().optional(),                       // Message type, defaults to "message"
    xArgs: z.record(z.string(), z.unknown()).optional(), // Additional arguments (like draft_id)
    unfurl: z.array(z.record(z.string(), z.unknown())).optional(), // Unfurl configuration for links
    client_context_team_id: z.string().optional(),     // Team ID for context
    draft_id: z.string().optional(),                   // Draft ID for message drafts
    include_channel_perm_error: z.boolean().optional(), // Include permission errors in response
    client_msg_id: z.string().optional(),              // Client-side message ID for tracking
});

export const PostMessageResponseSchema = SlackApiResponseSchema.extend({
    channel: z.string().optional(),
    ts: z.string().optional(),                         // Timestamp of the posted message
    message: z.record(z.string(), z.unknown()).optional(), // The posted message object
});

export const DeleteMessageOptionsSchema = z.object({
    channel: z.string(),                               // Channel ID where the message is located
    ts: z.string(),                                    // Timestamp of the message to delete
});

export const DeleteMessageResponseSchema = SlackApiResponseSchema.extend({
    channel: z.string().optional(),
    ts: z.string().optional(),                         // Timestamp of the deleted message
});

// Main ClientUserBootResponse schema that represents the complete JSON structure
export const ClientUserBootResponseSchema = z.object({
    // Basic flags and metadata
    ok: BooleanFlag,
    app_commands_cache_ts: TimestampString,
    cache_ts_version: z.string(),
    cache_version: z.string(),
    emoji_cache_ts: TimestampString,
    translations_cache_ts: TimestampString,
    is_content_reporting_enabled: BooleanFlag,
    is_europe: BooleanFlag,
    can_access_client_v2: BooleanFlag,
    is_slack_first_crm: BooleanFlag,
    mobile_app_requires_upgrade: BooleanFlag,
    accept_tos_url: z.unknown().nullable(),

    // Structured objects
    dnd: DndSchema,
    account_types: AccountTypesSchema,
    channels_priority: ChannelsPrioritySchema,
    links: LinksSchema,
    subteams: SubteamsSchema,

    // Main user and team data
    self: SelfUserSchema,
    team: SimpleTeamSchema,

    // Arrays
    channels: z.array(ChannelSchema),
    workspaces: z.array(WorkspaceSchema),
    ims: z.array(ImSchema),
    is_open: z.array(StringId),
    non_threadable_channels: z.array(StringId),
    read_only_channels: z.array(StringId),
    starred: z.array(StringId),
    thread_only_channels: z.array(StringId),

    // Additional properties
    default_workspace: StringId,
    has_more_mpdms: BooleanFlag,
    prefs: z.record(z.string(), z.unknown()),
    slack_route: z.string(),
});

// Exported Types from Zod Schemas
export type SlackApiResponse = z.infer<typeof SlackApiResponseSchema>;
export type SlackChannel = z.infer<typeof SlackChannelSchema>;
export type SlackResponseMetadata = z.infer<typeof SlackResponseMetadataSchema>;
export type SlackConversationsListResponse = z.infer<typeof SlackConversationsListResponseSchema>;
export type ChannelListOptions = z.infer<typeof ChannelListOptionsSchema>;
export type ChannelWithMessages = z.infer<typeof ChannelWithMessagesSchema>;
export type RecentMessagesResponse = z.infer<typeof RecentMessagesResponseSchema>;
export type ConversationRepliesOptions = z.infer<typeof ConversationRepliesOptionsSchema>;
export type ConversationRepliesResponse = z.infer<typeof ConversationRepliesResponseSchema>;
export type SlackBlock = z.infer<typeof SlackBlockSchema>;
export type PostMessageOptions = z.infer<typeof PostMessageOptionsSchema>;
export type PostMessageResponse = z.infer<typeof PostMessageResponseSchema>;
export type DeleteMessageOptions = z.infer<typeof DeleteMessageOptionsSchema>;
export type DeleteMessageResponse = z.infer<typeof DeleteMessageResponseSchema>;
export type ClientUserBootResponse = z.infer<typeof ClientUserBootResponseSchema>;
