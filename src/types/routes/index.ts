import { z } from 'zod';

// Zod schemas for request validation
export const ConversationTypesSchema = z.string().optional().default('public_channel,private_channel,mpim,im');

export const ConversationHistoryQuerySchema = z.object({
    oldest: z.string().optional(),
    latest: z.string().optional(),
    limit: z.coerce.number().int().positive().max(1000).optional(),
    inclusive: z.coerce.boolean().optional(),
    ignore_replies: z.coerce.boolean().optional(),
    include_pin_count: z.coerce.boolean().optional(),
    no_user_profile: z.coerce.boolean().optional(),
    include_stories: z.coerce.boolean().optional(),
    include_free_team_extra_messages: z.coerce.boolean().optional(),
    include_date_joined: z.coerce.boolean().optional(),
});

export const ConversationRepliesQuerySchema = z.object({
    inclusive: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(1000).optional(),
    oldest: z.string().optional(),
    latest: z.string().optional(),
});

export const ChannelParamsSchema = z.object({
    channelId: z.string().min(1).describe('The Slack channel ID'),
});

export const ConversationRepliesParamsSchema = z.object({
    channelId: z.string().min(1).describe('The Slack channel ID'),
    timestamp: z.string().min(1).describe('The message timestamp'),
});

export const ConversationsQuerySchema = z.object({
    types: ConversationTypesSchema,
});

export const PostMessageBodySchema = z.object({
    channel: z.string().min(1).describe('The channel ID to post the message to'),
    text: z.string().optional().describe('The message text'),
    blocks: z.array(z.any()).optional().describe('Slack block kit blocks'),
    ts: z.string().optional(),
    thread_ts: z.string().optional().describe('Thread timestamp for replies'),
    type: z.string().optional(),
    xArgs: z.record(z.string(), z.any()).optional(),
    unfurl: z.array(z.any()).optional(),
    client_context_team_id: z.string().optional(),
    draft_id: z.string().optional(),
    include_channel_perm_error: z.boolean().optional(),
    client_msg_id: z.string().optional(),
}).refine((data) => data.text || data.blocks, {
    message: 'Either text or blocks is required',
});

export const DeleteMessageBodySchema = z.object({
    channel: z.string().min(1).describe('The channel ID containing the message'),
    ts: z.string().min(1).describe('The message timestamp to delete'),
});

// Standard response schemas
export const HealthResponseSchema = z.object({
    status: z.literal('healthy'),
    timestamp: z.string(),
    slackApiReady: z.boolean(),
});

export const ApiStatusResponseSchema = z.object({
    status: z.literal('ready'),
    timestamp: z.string(),
    endpoints: z.record(z.string(), z.string()),
});

export const ErrorResponseSchema = z.object({
    error: z.string(),
});

// Type exports for better TypeScript integration
export type ConversationHistoryQuery = z.infer<typeof ConversationHistoryQuerySchema>;
export type ConversationRepliesQuery = z.infer<typeof ConversationRepliesQuerySchema>;
export type ChannelParams = z.infer<typeof ChannelParamsSchema>;
export type ConversationRepliesParams = z.infer<typeof ConversationRepliesParamsSchema>;
export type ConversationsQuery = z.infer<typeof ConversationsQuerySchema>;
export type PostMessageBody = z.infer<typeof PostMessageBodySchema>;
export type DeleteMessageBody = z.infer<typeof DeleteMessageBodySchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ApiStatusResponse = z.infer<typeof ApiStatusResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
