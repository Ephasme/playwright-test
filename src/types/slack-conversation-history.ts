import { z } from 'zod';

export const ChatMessageSchema = z.object({
    text: z.string(),
})

export const ConversationHistoryResponseSchema = z.object({
    ok: z.boolean(),
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

