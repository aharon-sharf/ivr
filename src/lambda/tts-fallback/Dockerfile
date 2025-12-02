# TTS Fallback Lambda Dockerfile
# Build stage
FROM public.ecr.aws/lambda/nodejs:18 AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install all dependencies for build
RUN npm ci

# Copy source and config
COPY src/lambda/tts-fallback/index.ts ./src/lambda/tts-fallback/
COPY src/types/ ./src/types/
COPY src/models/ ./src/models/
COPY tsconfig.json ./
COPY tsconfig.build.json ./

# Build
RUN npx tsc -p tsconfig.build.json

# Production stage
FROM public.ecr.aws/lambda/nodejs:18

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy compiled code
COPY --from=builder /build/dist/lambda/tts-fallback/index.js ./

# Set the CMD to your handler
CMD [ "index.handler" ]
