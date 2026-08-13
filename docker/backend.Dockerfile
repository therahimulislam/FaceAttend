# =============================================================================
# FaceAttend — Backend Dockerfile (Development)
# =============================================================================
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libffi-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements/ /tmp/requirements/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /tmp/requirements/development.txt

# Copy source (in dev, this is overridden by volume mount)
COPY . .

# Expose port
EXPOSE 8000

# Default command (overridden in docker-compose)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
