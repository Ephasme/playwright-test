import env from 'env-var';

/**
 * Centralized configuration for all environment variables
 * This file contains all environment variable getters to ensure
 * consistent access and validation across the application
 */
export const config = {
    // Google Cloud Platform configuration
    gcp: {
        projectId: env.get('GCP_PROJECT_ID').required().asString(),
        credentialsPath: env
            .get('GOOGLE_APPLICATION_CREDENTIALS')
            .required()
            .asString(),
    },

    // Google Cloud Storage configuration
    gcs: {
        bucketName: env.get('GCS_BUCKET_NAME').required().asString(),
        cookiesFileName: env.get('GCS_COOKIES_FILENAME').required().asString(),
    },

    // Slack configuration
    // URL structure: https://app.slack.com/client/{teamId}/{channelId}
    // - teamId: Slack workspace/team identifier (starts with 'T')
    // - channelId: Slack channel identifier (starts with 'C')
    slack: {
        baseUrl: env
            .get('SLACK_BASE_URL')
            .default('https://app.slack.com/client')
            .asString(),
        teamId: env.get('SLACK_TEAM_ID').required().asString(),
        channelId: env.get('SLACK_CHANNEL_ID').required().asString(),
    },
} as const;

/**
 * Type-safe configuration interface
 */
export type Config = typeof config;
