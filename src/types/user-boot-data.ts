import { z } from 'zod';
import {
    StringId,
    Timestamp,
    TimestampString,
    BooleanFlag,
    DndSchema,
    AccountTypesSchema,
    ChannelsPrioritySchema,
    LinksSchema,
    SubteamsSchema
} from './base.js';
import { ChannelSchema } from './channel.js';
import { SimpleTeamSchema, WorkspaceSchema } from './team.js';
import { SelfUserSchema, ImSchema } from './user.js';

// Main UserBootData schema that represents the complete JSON structure
export const UserBootDataSchema = z.object({
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

export type UserBootData = z.infer<typeof UserBootDataSchema>;
