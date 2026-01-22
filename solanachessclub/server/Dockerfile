FROM node:18-slim

WORKDIR /app

# Install required packages for Cloud SQL Proxy connectivity
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build the application
RUN pnpm build

# The port that your application listens to
EXPOSE 8080

# Set NODE_ENV
ENV NODE_ENV=production

# Runtime command
CMD ["node", "dist/index.js"] 