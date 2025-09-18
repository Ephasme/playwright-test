import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { validatorCompiler, serializerCompiler, hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
    ConversationHistoryQuerySchema,
    ConversationRepliesQuerySchema,
    ChannelParamsSchema,
    ConversationRepliesParamsSchema,
    ConversationsQuerySchema,
    PostMessageBodySchema,
    DeleteMessageBodySchema,
    HealthResponseSchema,
    ApiStatusResponseSchema,
    ErrorResponseSchema,
    type PostMessageOptions
} from '../types/index.js';
import { ChannelSchema } from '../types/channel/index.js';

// Helper function to remove undefined values from objects while preserving type safety
function filterDefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}

function routesPlugin(fastify: FastifyInstance) {
    // Set up Zod validator and serializer compilers
    fastify.setValidatorCompiler(validatorCompiler);
    // TODO: Remove this ESLint disable when issue is fixed in fastify-type-provider-zod
    // Issue: serializerCompiler uses union type that triggers @typescript-eslint/no-unsafe-argument
    // See: https://github.com/turkerdev/fastify-type-provider-zod/issues/212
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    fastify.setSerializerCompiler(serializerCompiler);

    // Add custom error handler for Zod validation errors
    fastify.setErrorHandler((error, request, reply) => {
        if (hasZodFastifySchemaValidationErrors(error)) {
            return reply.code(400).send({
                error: 'Validation Error',
                message: "Request doesn't match the schema",
                statusCode: 400,
                details: {
                    issues: error.validation,
                    method: request.method,
                    url: request.url,
                },
            });
        }

        if (isResponseSerializationError(error)) {
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: "Response doesn't match the schema",
                statusCode: 500,
                details: {
                    issues: error.cause.issues,
                    method: request.method,
                    url: request.url,
                },
            });
        }

        // For other errors, let Fastify handle them normally
        throw error;
    });

    // Health check endpoint
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/health',
        schema: {
            response: {
                200: HealthResponseSchema,
            },
        },
        handler: () => {
            return {
                status: 'healthy' as const,
                timestamp: new Date().toISOString(),
                slackApiReady: true, // Always true since server only starts after Slack API is ready
            };
        },
    });

    // API status endpoint
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/api/status',
        schema: {
            response: {
                200: ApiStatusResponseSchema,
            },
        },
        handler: () => {
            return {
                status: 'ready' as const,
                timestamp: new Date().toISOString(),
                endpoints: {
                    health: 'GET /health',
                    userBoot: 'GET /api/slack/user-boot',
                    recentMessages: 'GET /api/slack/recent-messages',
                    channels: 'GET /api/slack/channels',
                    conversations: 'GET /api/slack/conversations',
                    conversationHistory: 'GET /api/slack/conversations/:channelId/history',
                    conversationReplies: 'GET /api/slack/conversations/:channelId/replies/:timestamp',
                    postMessage: 'POST /api/slack/messages',
                    deleteMessage: 'DELETE /api/slack/messages',
                },
            };
        },
    });

    // Slack API endpoints
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/api/slack/user-boot',
        schema: {
            response: {
                200: z.any(), // ClientUserBoot data structure is complex, using any for now
                500: ErrorResponseSchema,
            },
        },
        handler: async (_request, reply) => {
            try {
                const clientUserBootData = await fastify.slackApi.clientUserBoot(fastify.workspaceUrl);
                return clientUserBootData;
            } catch (error) {
                fastify.log.error('Error getting user boot data: ' + (error instanceof Error ? error.message : String(error)));
                reply.code(500);
                return { error: 'Failed to get user boot data' };
            }
        },
    });

    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/api/slack/recent-messages',
        schema: {
            response: {
                200: z.any(), // Recent messages structure is complex, using any for now
                500: ErrorResponseSchema,
            },
        },
        handler: async (_request, reply) => {
            try {
                const recentMessages = await fastify.slackApi.getRecentMessages(fastify.workspaceUrl);
                return recentMessages;
            } catch (error) {
                fastify.log.error('Error getting recent messages: ' + (error instanceof Error ? error.message : String(error)));
                reply.code(500);
                return { error: 'Failed to get recent messages' };
            }
        },
    });

    // Get accessible channels from user.boot data
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/api/slack/channels',
        schema: {
            response: {
                200: z.object({
                    channels: z.array(ChannelSchema),
                    count: z.number(),
                }),
                500: ErrorResponseSchema,
            },
        },
        handler: async (_request, reply) => {
            try {
                const clientUserBootData = await fastify.slackApi.clientUserBoot(fastify.workspaceUrl);
                const channels = clientUserBootData.channels || [];
                return {
                    channels,
                    count: channels.length,
                };
            } catch (error) {
                fastify.log.error('Error getting channels list: ' + (error instanceof Error ? error.message : String(error)));
                reply.code(500);
                return { error: 'Failed to get channels list' };
            }
        },
    });

    // Get conversations list
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/api/slack/conversations',
        schema: {
            querystring: ConversationsQuerySchema,
            response: {
                200: z.any(), // Conversations list structure is complex, using any for now
                500: ErrorResponseSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const { types } = request.query;
                const conversations = await fastify.slackApi.getConversationsList(types);
                return conversations;
            } catch (error) {
                fastify.log.error('Error getting conversations list: ' + (error instanceof Error ? error.message : String(error)));
                reply.code(500);
                return { error: 'Failed to get conversations list' };
            }
        },
    });

    // Get conversation history
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/api/slack/conversations/:channelId/history',
        schema: {
            params: ChannelParamsSchema,
            querystring: ConversationHistoryQuerySchema,
            response: {
                200: z.any(), // Conversation history structure is complex, using any for now
                500: ErrorResponseSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const { channelId } = request.params;
                const options = filterDefined(request.query);

                const history = await fastify.slackApi.getConversationHistory(channelId, options);
                return history;
            } catch (error) {
                fastify.log.error('Error getting conversation history: ' + (error instanceof Error ? error.message : String(error)));
                reply.code(500);
                return { error: 'Failed to get conversation history' };
            }
        },
    });

    // Get conversation replies
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'GET',
        url: '/api/slack/conversations/:channelId/replies/:timestamp',
        schema: {
            params: ConversationRepliesParamsSchema,
            querystring: ConversationRepliesQuerySchema,
            response: {
                200: z.any(), // Conversation replies structure is complex, using any for now
                500: ErrorResponseSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const { channelId, timestamp } = request.params;
                const options = filterDefined(request.query);

                const replies = await fastify.slackApi.getConversationReplies(channelId, timestamp, options);
                return replies;
            } catch (error) {
                fastify.log.error('Error getting conversation replies: ' + (error instanceof Error ? error.message : String(error)));
                reply.code(500);
                return { error: 'Failed to get conversation replies' };
            }
        },
    });

    // Post message
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'POST',
        url: '/api/slack/messages',
        schema: {
            body: PostMessageBodySchema,
            response: {
                200: z.any(), // Slack API response structure is complex, using any for now
                400: ErrorResponseSchema,
                500: ErrorResponseSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const options = filterDefined(request.body) as unknown as PostMessageOptions;
                const result = await fastify.slackApi.postMessage(options);
                return result;
            } catch (error) {
                fastify.log.error('Error posting message: ' + (error instanceof Error ? error.message : String(error)));
                reply.code(500);
                return { error: 'Failed to post message' };
            }
        },
    });

    // Delete message
    fastify.withTypeProvider<ZodTypeProvider>().route({
        method: 'DELETE',
        url: '/api/slack/messages',
        schema: {
            body: DeleteMessageBodySchema,
            response: {
                200: z.any(), // Slack API response structure is complex, using any for now
                400: ErrorResponseSchema,
                500: ErrorResponseSchema,
            },
        },
        handler: async (request, reply) => {
            try {
                const options = request.body;
                const result = await fastify.slackApi.deleteMessage(options);
                return result;
            } catch (error) {
                fastify.log.error('Error deleting message: ' + (error instanceof Error ? error.message : String(error)));
                reply.code(500);
                return { error: 'Failed to delete message' };
            }
        },
    });
}

export default fp(routesPlugin, {
    name: 'routes',
    fastify: '5.x',
    dependencies: ['slack-api'] // This plugin depends on the slack-api plugin
});
