import { z } from 'zod';
import { StringId, Timestamp, BooleanFlag } from '../base.js';

// Topic and Purpose schemas (common pattern in channels)
export const TopicSchema = z.object({
    value: z.string(),
    creator: StringId,
    last_set: Timestamp,
});

export const PurposeSchema = z.object({
    value: z.string(),
    creator: StringId,
    last_set: Timestamp,
});

// Canvas schema
export const CanvasSchema = z.object({
    file_id: StringId,
    is_empty: BooleanFlag.optional(),
    quip_thread_id: StringId.optional(),
    is_migrated: BooleanFlag.optional(),
});

// Meeting Notes schema
export const MeetingNotesSchema = z.object({
    file_id: StringId,
});

// Tab data schemas
export const TabDataSchema = z.object({
    file_id: StringId.optional(),
    shared_ts: z.string().optional(),
    folder_bookmark_id: StringId.optional(),
});

// Tab schema
export const TabSchema = z.object({
    id: StringId.optional(),
    label: z.string().optional(),
    type: z.string(),
    data: TabDataSchema.optional(),
    is_disabled: BooleanFlag.optional(),
});

// Channel workflow schema
export const ChannelWorkflowSchema = z.object({
    workflow_trigger_id: StringId,
    title: z.string(),
});

// Posting restriction schema
export const PostingRestrictedToSchema = z.object({
    type: z.array(z.string()),
    user: z.array(StringId),
});

// Threads restriction schema  
export const ThreadsRestrictedToSchema = z.object({
    type: z.array(z.string()),
});

// Channel properties schema
export const ChannelPropertiesSchema = z.object({
    posting_restricted_to: PostingRestrictedToSchema.optional(),
    threads_restricted_to: ThreadsRestrictedToSchema.optional(),
    canvas: CanvasSchema.optional(),
    meeting_notes: MeetingNotesSchema.optional(),
    tabs: z.array(TabSchema).optional(),
    tabz: z.array(TabSchema).optional(),
    channel_workflows: z.array(ChannelWorkflowSchema).optional(),
});

// Main Channel schema
export const ChannelSchema = z.object({
    id: StringId,
    name: z.string(),
    is_channel: BooleanFlag,
    is_group: BooleanFlag,
    is_im: BooleanFlag,
    is_mpim: BooleanFlag,
    is_private: BooleanFlag,
    created: Timestamp,
    is_archived: BooleanFlag,
    is_general: BooleanFlag,
    unlinked: z.number(),
    name_normalized: z.string(),
    is_shared: BooleanFlag,
    is_frozen: BooleanFlag,
    is_org_shared: BooleanFlag,
    is_pending_ext_shared: BooleanFlag,
    pending_shared: z.array(z.unknown()),
    context_team_id: StringId,
    updated: Timestamp,
    parent_conversation: StringId.nullable(),
    creator: StringId,
    is_ext_shared: BooleanFlag,
    shared_team_ids: z.array(StringId),
    pending_connected_team_ids: z.array(StringId),
    topic: TopicSchema,
    purpose: PurposeSchema,
    properties: ChannelPropertiesSchema.optional(),
    previous_names: z.array(z.string()).optional(),
});

export type Topic = z.infer<typeof TopicSchema>;
export type Purpose = z.infer<typeof PurposeSchema>;
export type Canvas = z.infer<typeof CanvasSchema>;
export type MeetingNotes = z.infer<typeof MeetingNotesSchema>;
export type TabData = z.infer<typeof TabDataSchema>;
export type Tab = z.infer<typeof TabSchema>;
export type ChannelWorkflow = z.infer<typeof ChannelWorkflowSchema>;
export type PostingRestrictedTo = z.infer<typeof PostingRestrictedToSchema>;
export type ThreadsRestrictedTo = z.infer<typeof ThreadsRestrictedToSchema>;
export type ChannelProperties = z.infer<typeof ChannelPropertiesSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
