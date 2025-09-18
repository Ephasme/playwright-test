import { z } from 'zod';
import { SlackApiResponseSchema } from './slack-api/index.js';

export const ChatMessageSchema = z.object({
    text: z.string(),
})

export const ConversationHistoryResponseSchema = SlackApiResponseSchema.extend({
    messages: z.array(ChatMessageSchema),
    has_more: z.boolean(),
    pin_count: z.number(),
    channel_actions_ts: z.string().nullable(),
    channel_actions_count: z.number(),
    response_metadata: z.object({
        next_cursor: z.string().nullable(),
    }),
});

export type ConversationHistoryResponse = z.infer<typeof ConversationHistoryResponseSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

