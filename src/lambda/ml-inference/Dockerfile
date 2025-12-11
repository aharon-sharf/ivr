# ML Inference Lambda Dockerfile
FROM public.ecr.aws/lambda/nodejs:20

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/lambda/ml-inference/ ./src/lambda/ml-inference/
COPY src/models/ ./src/models/

# Set the CMD to your handler
CMD [ "src/lambda/ml-inference/index.handler" ]
