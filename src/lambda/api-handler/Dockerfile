# Dockerfile for API Handler Lambda
# Build stage
FROM public.ecr.aws/lambda/nodejs:18 AS builder

# Set working directory
WORKDIR /build

# Copy package files from repository root
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code from repository root
COPY src/ ./src/
COPY tsconfig.json ./
COPY tsconfig.lambda.json ./

# Build TypeScript
RUN npx tsc -p tsconfig.lambda.json

# Production stage
FROM public.ecr.aws/lambda/nodejs:18

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built code from builder stage
COPY --from=builder /build/dist ./dist

# Set the CMD to your handler
CMD [ "dist/lambda/api-handler/index.handler" ]
