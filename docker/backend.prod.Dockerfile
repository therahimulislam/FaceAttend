# =============================================================================
# FaceAttend — Backend Production Dockerfile (Multi-stage)
# =============================================================================
# Stage 1: Builder — installs all Python dependencies
# Stage 2: Runtime — lean image, non-root user, no build tools
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Builder
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS builder

WORKDIR /build

# System build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install production Python dependencies into a prefix
COPY requirements/ /build/requirements/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install \
        -r /build/requirements/production.txt

# ---------------------------------------------------------------------------
# Stage 2: Runtime
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

WORKDIR /app

# Runtime system deps only (libpq for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Create non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Copy source code
COPY --chown=appuser:appgroup . .

# Create media/static/logs directories with correct ownership
RUN mkdir -p /app/static /app/media /app/logs && \
    chown -R appuser:appgroup /app/static /app/media /app/logs

# Switch to non-root user
USER appuser

# Collect static files
RUN python manage.py collectstatic --noinput --settings=config.settings.production || true

EXPOSE 8000

# Default production start command (Render overrides $PORT via environment)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
