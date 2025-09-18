import fp from 'fastify-plugin';
import { chromium } from 'playwright';
import { Storage } from '@google-cloud/storage';
import { makeCookiesLoader } from '../cookie-management/index.js';
import { config } from '../config/index.js';
import { SlackApiFactory } from '../slack-api/index.js';
import type { FastifyInstance } from 'fastify';

async function slackApiPlugin(fastify: FastifyInstance) {
    fastify.log.info('🔄 Initializing Slack API plugin...');

    try {
        // Create Google Cloud Storage instance with either file-based or env var credentials
        const storageOptions: {
            projectId: string;
            keyFilename?: string;
            credentials?: object;
        } = {
            projectId: config.gcp.projectId,
        };

        // Use base64-encoded credentials from environment variable
        const decodedCredentials = Buffer.from(config.gcp.credentialsBase64, 'base64').toString('utf-8');
        storageOptions.credentials = JSON.parse(decodedCredentials) as object;
        fastify.log.info('🔐 Using base64-encoded credentials from environment variable');

        const storage = new Storage(storageOptions);

        // Load and transform cookies from GCP
        const loadCookies = makeCookiesLoader(storage, {
            bucketName: config.gcs.bucketName,
            fileName: config.gcs.cookiesFileName,
        });

        // Launch browser
        const browser = await chromium.launch();

        // Get workspace URL from config
        const workspaceUrl = `${config.slack.baseUrl}/${config.slack.teamId}`;

        // Create Slack API instance
        const slackApiFactory = new SlackApiFactory(loadCookies, workspaceUrl, browser);
        const slackApi = await slackApiFactory.createSlackApi();

        // Decorate Fastify instance with our dependencies
        fastify.decorate('slackApi', slackApi);
        fastify.decorate('browser', browser);
        fastify.decorate('workspaceUrl', workspaceUrl);

        // Register shutdown hook to clean up browser
        fastify.addHook('onClose', async () => {
            if (browser) {
                await browser.close();
                fastify.log.info('🔌 Browser closed');
            }
        });

        fastify.log.info('✅ Slack API plugin initialized successfully');
    } catch (error) {
        fastify.log.error('❌ Failed to initialize Slack API plugin: ' + (error instanceof Error ? error.message : String(error)));
        throw error;
    }
}

export default fp(slackApiPlugin, {
    name: 'slack-api',
    fastify: '5.x'
});
