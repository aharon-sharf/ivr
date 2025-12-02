# Enrich Dial Task Lambda Dockerfile
# Build stage
FROM public.ecr.aws/lambda/nodejs:20 AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install all dependencies for build
RUN npm ci

# Copy source and config
COPY src/lambda/enrich-dial-task/index.ts ./src/lambda/enrich-dial-task/
COPY src/models/ ./src/models/
COPY src/types/ ./src/types/
COPY tsconfig.lambda.json ./

# Build
RUN npx tsc -p tsconfig.lambda.json

# Production stage
FROM public.ecr.aws/lambda/nodejs:20

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy compiled code
COPY --from=builder /build/dist/lambda/enrich-dial-task/index.js ./

# Set the CMD to your handler
CMD [ "index.handler" ]
