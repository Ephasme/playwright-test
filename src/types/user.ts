import { z } from 'zod';
import { StringId, Timestamp, BooleanFlag } from './base.js';

// User profile schema
export const UserProfileSchema = z.object({
    title: z.string().optional(),
    phone: z.string().optional(),
    skype: z.string().optional(),
    real_name: z.string().optional(),
    real_name_normalized: z.string().optional(),
    display_name: z.string().optional(),
    display_name_normalized: z.string().optional(),
    fields: z.record(z.string(), z.any()).optional(),
    status_text: z.string().optional(),
    status_emoji: z.string().optional(),
    status_emoji_display_info: z.array(z.unknown()).optional(),
    status_expiration: Timestamp.optional(),
    avatar_hash: z.string().optional(),
    email: z.string().optional(),
    huddle_state: z.string().optional(),
    huddle_state_expiration_ts: Timestamp.optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    image_24: z.string().optional(),
    image_32: z.string().optional(),
    image_48: z.string().optional(),
    image_72: z.string().optional(),
    image_192: z.string().optional(),
    image_512: z.string().optional(),
    image_1024: z.string().optional(),
    image_original: z.string().optional(),
    status_text_canonical: z.string().optional(),
    team: StringId.optional(),
});

// Self user schema (current user)
export const SelfUserSchema = z.object({
    id: StringId,
    name: z.string(),
    is_bot: BooleanFlag,
    updated: Timestamp,
    is_app_user: BooleanFlag,
    team_id: StringId,
    deleted: BooleanFlag,
    color: z.string(),
    is_email_confirmed: BooleanFlag,
    real_name: z.string(),
    tz: z.string(),
    tz_label: z.string(),
    tz_offset: z.number(),
    profile: UserProfileSchema,
    is_admin: BooleanFlag,
    is_owner: BooleanFlag,
    is_primary_owner: BooleanFlag,
    is_restricted: BooleanFlag,
    is_ultra_restricted: BooleanFlag,
    has_2fa: BooleanFlag.optional(),
    locale: z.string().optional(),
    prefs: z.record(z.string(), z.any()).optional(),
    two_factor_type: z.string().optional(),
    enterprise_user: z.object({
        id: StringId,
        enterprise_id: StringId,
        enterprise_name: z.string(),
        is_admin: BooleanFlag,
        is_owner: BooleanFlag,
        teams: z.array(StringId),
    }).optional(),
});

// IM (Direct Message) schema
export const ImSchema = z.object({
    id: StringId,
    created: Timestamp,
    is_archived: BooleanFlag,
    is_org_shared: BooleanFlag,
    context_team_id: StringId,
    updated: Timestamp,
    user: StringId,
    is_user_deleted: BooleanFlag.optional(),
    priority: z.number().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type SelfUser = z.infer<typeof SelfUserSchema>;
export type Im = z.infer<typeof ImSchema>;
