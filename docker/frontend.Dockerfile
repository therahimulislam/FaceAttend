# =============================================================================
# FaceAttend — Frontend Dockerfile (Development)
# =============================================================================
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (layer cache optimization)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source (in dev, this is overridden by volume mount)
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server (bound to 0.0.0.0 for Docker access)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
