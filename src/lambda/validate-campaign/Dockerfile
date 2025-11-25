FROM public.ecr.aws/lambda/nodejs:18

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/lambda/validate-campaign/ ./src/lambda/validate-campaign/
COPY src/models/ ./src/models/

# Set the CMD to your handler
CMD [ "src/lambda/validate-campaign/index.handler" ]
