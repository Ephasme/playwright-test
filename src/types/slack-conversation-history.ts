import { z } from 'zod';
import { SlackApiResponseSchema, SlackResponseMetadataSchema } from './slack-api/index.js';

export const ChatMessageSchema = z.object({
    text: z.string(),
})

export const ConversationHistoryResponseSchema = SlackApiResponseSchema.extend({
    messages: z.array(z.record(z.string(), z.unknown())), // Flexible message objects from Slack API
    has_more: z.boolean().optional(),
    pin_count: z.number().optional(),
    channel_actions_ts: z.string().nullable().optional(),
    channel_actions_count: z.number().optional(),
    response_metadata: SlackResponseMetadataSchema.optional(), // Only present when pagination is needed
});

export type ConversationHistoryResponse = z.infer<typeof ConversationHistoryResponseSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

