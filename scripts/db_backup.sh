#!/usr/bin/env bash
# =============================================================================
# FaceAttend — PostgreSQL Database Backup Script
# =============================================================================
# Usage (standalone):
#   POSTGRES_USER=faceattend_user \
#   POSTGRES_PASSWORD=secret \
#   POSTGRES_DB=faceattend \
#   POSTGRES_HOST=db \
#   bash scripts/db_backup.sh
#
# Usage (Docker — run from inside db container):
#   docker exec -e PGPASSWORD=... faceattend_db_prod \
#     pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backup.sql.gz
#
# Cron (daily at 2am):
#   0 2 * * * /path/to/scripts/db_backup.sh >> /var/log/faceattend_backup.log 2>&1
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/tmp/faceattend_backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/faceattend_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

echo "[$(date -Iseconds)] Starting FaceAttend database backup..."
mkdir -p "$BACKUP_DIR"

# Create compressed backup
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST:-db}" \
  -U "${POSTGRES_USER:-faceattend_user}" \
  -d "${POSTGRES_DB:-faceattend}" \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] ✓ Backup created: $BACKUP_FILE ($SIZE)"

# Remove backups older than RETENTION_DAYS
DELETED=$(find "$BACKUP_DIR" -name "faceattend_*.sql.gz" \
  -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)
echo "[$(date -Iseconds)] ✓ Removed $DELETED old backup(s) (>${RETENTION_DAYS}d)"
echo "[$(date -Iseconds)] Done."
