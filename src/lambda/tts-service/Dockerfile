FROM public.ecr.aws/lambda/nodejs:18

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy Lambda function code
COPY src/lambda/tts-service/index.ts ./
COPY src/types ./types/
COPY src/models ./models/

# Set the CMD to your handler
CMD [ "index.handler" ]
