# Dialer Worker Lambda Dockerfile
# Build stage
FROM public.ecr.aws/lambda/nodejs:20 AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install all dependencies for build
RUN npm ci

# Copy source and config
COPY src/lambda/dialer-worker/index.ts ./src/lambda/dialer-worker/
COPY tsconfig.json ./
COPY tsconfig.build.json ./

# Build
RUN npx tsc -p tsconfig.build.json

# Production stage
FROM public.ecr.aws/lambda/nodejs:20

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy compiled code
COPY --from=builder /build/dist/lambda/dialer-worker/index.js ./

# Set the CMD to your handler
CMD [ "index.handler" ]
