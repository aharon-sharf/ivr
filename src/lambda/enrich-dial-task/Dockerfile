# Enrich Dial Task Lambda Dockerfile
FROM public.ecr.aws/lambda/nodejs:20

# Copy function code
COPY index.ts ${LAMBDA_TASK_ROOT}/
COPY package*.json ${LAMBDA_TASK_ROOT}/

# Install dependencies
WORKDIR ${LAMBDA_TASK_ROOT}
RUN npm ci --only=production

# Set the CMD to your handler
CMD [ "index.handler" ]
