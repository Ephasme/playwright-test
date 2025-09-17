import type { FastifyPluginOptions, FastifyInstance } from 'fastify';
import type { Browser } from 'playwright';
import type { SlackApi } from '../../slack-api/index.js';

// Fastify module declaration for plugin decorators
declare module 'fastify' {
    interface FastifyInstance {
        slackApi: SlackApi;
        browser: Browser;
        workspaceUrl: string;
    }
}

// Plugin options interfaces
export interface SlackApiPluginOptions extends FastifyPluginOptions {
    // Add any plugin-specific options here if needed
}

export interface RoutesPluginOptions extends FastifyPluginOptions {
    // Add any plugin-specific options here if needed
}
