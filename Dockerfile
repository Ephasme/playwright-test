# Multi-stage Dockerfile for TypeScript/Node.js application with Playwright

# =============================================
# Build Stage: Install dependencies, lint, and build
# =============================================
FROM node:22-bookworm AS builder

# Set working directory
WORKDIR /app

# Enable corepack to use pnpm
RUN corepack enable

# Copy package manager files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and configuration files
COPY . .

# Run linter
RUN pnpm run lint

# Build the application
RUN pnpm run build

# =============================================
# Production Stage: Playwright-ready runtime
# =============================================
FROM mcr.microsoft.com/playwright:v1.55.0-noble AS production

# Set working directory
WORKDIR /app

# Enable corepack to use pnpm
RUN corepack enable

# Copy package.json and pnpm-lock.yaml for production dependencies
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Note: google_credentials.json is now handled via environment variables
# No need to copy the file since credentials are passed as GOOGLE_CREDENTIALS_BASE64

# Create a non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port (adjust if your app uses a different port)
EXPOSE 3000

# Health check - calls the actual /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
