#!/bin/sh
# Restore the database from a dump made by the backup service. Run on the host, in the project folder:
#   ./scripts/restore.sh backups/thelot-2026-01-01-0300.dump
# This REPLACES the current data. Try it on a scratch copy of the project first.
set -e
[ -n "$1" ] && [ -f "$1" ] || { echo "Usage: $0 path/to/dump"; exit 1; }
set -a; . ./.env; set +a
printf 'This replaces ALL data in the database with %s. Type yes to continue: ' "$1"; read -r ok
[ "$ok" = "yes" ] || { echo "Cancelled."; exit 1; }
docker compose stop game
docker compose exec -T db pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$1"
docker compose start game
echo "Restored. Check https://$DOMAIN/healthz"
