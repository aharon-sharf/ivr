FROM public.ecr.aws/lambda/nodejs:20

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/lambda/sms-reply-handler/ ./
COPY src/models/ ./models/
COPY src/types/ ./types/

# Set the CMD to your handler
CMD [ "index.handler" ]
