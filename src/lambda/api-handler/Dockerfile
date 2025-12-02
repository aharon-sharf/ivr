# Dockerfile for API Handler Lambda
FROM public.ecr.aws/lambda/nodejs:18

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files from repository root
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code from repository root
COPY src/ ./src/
COPY tsconfig.json ./

# Install TypeScript and build
RUN npm install -g typescript
RUN tsc

# Set the CMD to your handler
CMD [ "dist/lambda/api-handler/index.handler" ]
