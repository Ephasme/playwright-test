import type { FastifyPluginOptions } from 'fastify';
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
export type SlackApiPluginOptions = FastifyPluginOptions;

export type RoutesPluginOptions = FastifyPluginOptions;
