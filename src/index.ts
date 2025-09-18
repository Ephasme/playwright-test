// Fastify API Server for Slack Private API
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { slackApiPlugin, routesPlugin } from './plugins/index.js';
import { config } from './config/index.js';

// Create Fastify server instance with logging enabled
const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
});

// Register CORS plugin to allow cross-origin requests
await fastify.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true
});

// Register Slack API plugin (provides slackApi, browser, workspaceUrl decorators)
await fastify.register(slackApiPlugin);

// Register routes plugin (uses the Slack API decorators)
await fastify.register(routesPlugin);

// Server startup function
async function start() {
  try {
    // Start the server - Slack API initialization is handled by the plugin during registration
    const { host, port } = config.server;
    const address = await fastify.listen({ port, host });

    fastify.log.info(`🚀 Server listening at ${address}`);
    fastify.log.info('📱 Available API endpoints:');
    fastify.log.info('  - GET /health - Health check');
    fastify.log.info('  - GET /api/status - API status with all endpoints');
    fastify.log.info('  - GET /api/slack/user-boot - User boot data');
    fastify.log.info('  - GET /api/slack/recent-messages - Recent messages');
    fastify.log.info('  - GET /api/slack/channels - List accessible channels');
    fastify.log.info('  - GET /api/slack/conversations - List conversations');
    fastify.log.info('  - GET /api/slack/conversations/:channelId/history - Channel history');
    fastify.log.info('  - GET /api/slack/conversations/:channelId/replies/:timestamp - Thread replies');
    fastify.log.info('  - POST /api/slack/messages - Send message');
    fastify.log.info('  - DELETE /api/slack/messages - Delete message');

  } catch (error) {
    fastify.log.error('Failed to start server: ' + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGTERM', () => {
  fastify.log.info('🛑 SIGTERM received, shutting down gracefully');
  void fastify.close();
});

process.on('SIGINT', () => {
  fastify.log.info('🛑 SIGINT received, shutting down gracefully');
  void fastify.close();
});

// Start the server
void start();