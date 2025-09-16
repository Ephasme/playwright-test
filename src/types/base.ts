import { z } from 'zod';

// Common base types used throughout the schema
export const StringId = z.string();
export const Timestamp = z.number();
export const TimestampString = z.string();
export const BooleanFlag = z.boolean();

// DND (Do Not Disturb) Schema
export const DndSchema = z.object({
    dnd_enabled: BooleanFlag,
    next_dnd_start_ts: Timestamp,
    next_dnd_end_ts: Timestamp,
    snooze_enabled: BooleanFlag,
});

// Account Types Schema
export const AccountTypesSchema = z.object({
    is_admin: z.array(StringId),
    is_owner: z.array(StringId),
    is_primary_owner: z.array(StringId),
});

// Channels Priority Schema (mapping of channel IDs to priority values)
export const ChannelsPrioritySchema = z.record(StringId, z.number());

// Links Schema
export const LinksSchema = z.object({
    domains_ts: Timestamp,
});

// Subteams Schema
export const SubteamsSchema = z.object({
    self: z.array(StringId),
});

export type Dnd = z.infer<typeof DndSchema>;
export type AccountTypes = z.infer<typeof AccountTypesSchema>;
export type ChannelsPriority = z.infer<typeof ChannelsPrioritySchema>;
export type Links = z.infer<typeof LinksSchema>;
export type Subteams = z.infer<typeof SubteamsSchema>;
