FROM public.ecr.aws/lambda/nodejs:20

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/lambda/optout-handler/ ./
COPY src/models/ ./models/

# Set the handler
CMD [ "index.handler" ]
