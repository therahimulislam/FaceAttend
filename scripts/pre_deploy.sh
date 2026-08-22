#!/usr/bin/env bash
# =============================================================================
# FaceAttend — Pre-Deploy Safety Check
# Run this before every production deployment.
#
# Usage:
#   cd backend
#   bash ../scripts/pre_deploy.sh
#
# Checks:
#   1. Unapplied database migrations
#   2. Django system check (production)
#   3. Python import sanity (no syntax errors)
# =============================================================================
set -euo pipefail

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FaceAttend — Pre-Deploy Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SETTINGS="${DJANGO_SETTINGS_MODULE:-config.settings.production}"
export DJANGO_SETTINGS_MODULE="$SETTINGS"

# 1. Check for unapplied migrations
echo "▶ [1/3] Checking for unapplied migrations..."
if python manage.py migrate --check 2>&1; then
  echo "  ✓ All migrations applied."
else
  echo "  ✗ Unapplied migrations detected! Run: python manage.py migrate"
  exit 1
fi

echo ""

# 2. Django system check (production)
echo "▶ [2/3] Running Django system check..."
if python manage.py check --deploy 2>&1; then
  echo "  ✓ System check passed."
else
  echo "  ✗ System check failed! Fix all errors before deploying."
  exit 1
fi

echo ""

# 3. Collectstatic dry-run
echo "▶ [3/3] Verifying static files collection..."
if python manage.py collectstatic --noinput --dry-run 2>&1 | tail -1; then
  echo "  ✓ Static files OK."
else
  echo "  ✗ Static files collection failed!"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ All pre-deploy checks passed. Safe to deploy!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
