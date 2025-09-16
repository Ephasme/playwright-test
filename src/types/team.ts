import { z } from 'zod';
import { StringId, Timestamp, BooleanFlag } from './base.js';

// Permission schemas
export const PermissionTypeSchema = z.object({
    type: z.array(z.string()),
    user: z.array(StringId).optional(),
    subteam: z.array(StringId).optional(),
});

// Identity links preferences
export const IdentityLinksPrefsSchema = z.object({
    is_enabled: BooleanFlag,
    teams_domains_ts: Timestamp,
});

// Custom status presets
export const CustomStatusPresetSchema = z.tuple([
    z.string(), // emoji
    z.string(), // text in French
    z.string(), // text in English
    z.string(), // duration
]);

// AI Apps schemas
export const AiAppsSchema = z.object({
    is_enabled: BooleanFlag,
    allowed_apps: z.array(z.unknown()),
});

export const AiAppsSettingsSchema = z.object({
    apps: z.array(z.unknown()),
});

// Team icon schema
export const TeamIconSchema = z.object({
    image_34: z.string().optional(),
    image_44: z.string().optional(),
    image_68: z.string().optional(),
    image_88: z.string().optional(),
    image_102: z.string().optional(),
    image_132: z.string().optional(),
    image_230: z.string().optional(),
    image_default: BooleanFlag.optional(),
});

// Enterprise grid info
export const EnterpriseGridSchema = z.object({
    enterprise_id: StringId,
    enterprise_name: z.string(),
    enterprise_domain: z.string(),
    is_enterprise_grid_workspace: BooleanFlag,
});

// External org migrations
export const ExternalOrgMigrationsSchema = z.object({
    current: z.array(z.unknown()),
    date_updated: Timestamp,
});

// Team prefs schema (contains many configuration options)
export const TeamPrefsSchema = z.object({
    default_channels: z.array(StringId).optional(),
    allow_message_deletion: BooleanFlag.optional(),
    who_can_at_everyone: z.string().optional(),
    who_can_at_channel: z.string().optional(),
    who_can_create_channels: PermissionTypeSchema.optional(),
    who_can_archive_channels: PermissionTypeSchema.optional(),
    who_can_create_groups: PermissionTypeSchema.optional(),
    who_can_kick_channels: PermissionTypeSchema.optional(),
    who_can_manage_members: PermissionTypeSchema.optional(),
    who_can_change_team_profile: z.union([PermissionTypeSchema, z.string()]).optional(),
    who_can_manage_ext_shared_channels: PermissionTypeSchema.optional(),
    app_whitelist_enabled: BooleanFlag.optional(),
    magic_unfurls_enabled: BooleanFlag.optional(),
    who_can_manage_integrations: PermissionTypeSchema.optional(),
    sign_in_with_slack_disabled: BooleanFlag.optional(),
    identity_links_prefs: IdentityLinksPrefsSchema.optional(),
    app_whitelist_requests_require_comment_enabled: BooleanFlag.optional(),
    billing_wdf_customer_id: z.string().optional(),
    file_retention_duration: z.number().optional(),
    file_retention_type: z.number().optional(),
    custom_status_presets: z.array(CustomStatusPresetSchema).optional(),
    uses_customized_custom_status_presets: BooleanFlag.optional(),
    sso_sync_with_provider: BooleanFlag.optional(),
    sso_change_email: BooleanFlag.optional(),
    sso_choose_username: BooleanFlag.optional(),
    sso_auth_restrictions: z.number().optional(),
    google_sso_enable: BooleanFlag.optional(),
    google_sso_domain: z.string().optional(),
    was_treatment_for_boost_bus_plus_awareness_and_upgrades: BooleanFlag.optional(),
    app_whitelist_requests_enabled: BooleanFlag.optional(),
    admin_customized_quick_reactions: z.array(z.string()).optional(),
    ai_apps: AiAppsSchema.optional(),
    ai_apps_settings: AiAppsSettingsSchema.optional(),
    allow_admin_retention_override: z.number().optional(),
    allow_audio_clip_sharing_slack_connect: BooleanFlag.optional(),
    allow_audio_clips: BooleanFlag.optional(),
    allow_automatic_media_transcriptions: BooleanFlag.optional(),
    allow_box_cfs: BooleanFlag.optional(),
    allow_calls: BooleanFlag.optional(),
    allow_calls_interactive_screen_sharing: BooleanFlag.optional(),
    allow_clip_downloads: z.string().optional(),
    allow_content_review: BooleanFlag.optional(),
    allow_custom_solution_templates: BooleanFlag.optional(),
    allow_developer_sandboxes: z.string().optional(),
    allow_feature_request: BooleanFlag.optional(),
    allow_free_automated_trials: BooleanFlag.optional(),
    allow_huddles: BooleanFlag.optional(),
    allow_huddles_transcriptions: BooleanFlag.optional(),
    who_can_manage_public_channels: PermissionTypeSchema.optional(),
    who_can_manage_shared_channels: PermissionTypeSchema.optional(),
    who_can_post_general: z.string().optional(),
    who_can_review_flagged_content: PermissionTypeSchema.optional(),
    who_can_use_hermes: PermissionTypeSchema.optional(),
    who_has_team_visibility: z.string().optional(),
    work_object_unfurl_visibility: z.number().optional(),
    workflow_builder_enabled: BooleanFlag.optional(),
    workflow_extension_steps_beta_opt_in: BooleanFlag.optional(),
    workflow_extension_steps_enabled: BooleanFlag.optional(),
    workflows_export_csv_enabled: BooleanFlag.optional(),
    workflows_webhook_trigger_enabled: BooleanFlag.optional(),
    auth_mode: z.string().optional(),
});

// Simple Team schema (for the main team object)
export const SimpleTeamSchema = z.object({
    id: StringId,
    name: z.string(),
    url: z.string().optional(),
    domain: z.string(),
    email_domain: z.string().optional(),
    icon: TeamIconSchema.optional(),
});

// Workspace schema (similar to team but for workspaces array)
export const WorkspaceSchema = z.object({
    id: StringId,
    name: z.string(),
    url: z.string().optional(),
    domain: z.string(),
    email_domain: z.string().optional(),
    icon: TeamIconSchema.optional(),
    prefs: TeamPrefsSchema.optional(),
    over_storage_limit: BooleanFlag.optional(),
    plan: z.string().optional(),
    avatar_base_url: z.string().optional(),
    over_integrations_limit: BooleanFlag.optional(),
    enterprise_grid: EnterpriseGridSchema.optional(),
    external_org_migrations: ExternalOrgMigrationsSchema.optional(),
    msg_edit_window_mins: z.number().optional(),
});

// Keep the original complex team schema for backwards compatibility
export const TeamSchema = WorkspaceSchema;

export type PermissionType = z.infer<typeof PermissionTypeSchema>;
export type IdentityLinksPrefs = z.infer<typeof IdentityLinksPrefsSchema>;
export type CustomStatusPreset = z.infer<typeof CustomStatusPresetSchema>;
export type AiApps = z.infer<typeof AiAppsSchema>;
export type AiAppsSettings = z.infer<typeof AiAppsSettingsSchema>;
export type TeamIcon = z.infer<typeof TeamIconSchema>;
export type EnterpriseGrid = z.infer<typeof EnterpriseGridSchema>;
export type ExternalOrgMigrations = z.infer<typeof ExternalOrgMigrationsSchema>;
export type TeamPrefs = z.infer<typeof TeamPrefsSchema>;
export type SimpleTeam = z.infer<typeof SimpleTeamSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Team = z.infer<typeof TeamSchema>;
