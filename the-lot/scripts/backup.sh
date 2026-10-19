#!/bin/sh
# Runs inside the "backup" service: dump now, then every 24 hours. Keeps BACKUP_KEEP_DAYS days.
mkdir -p /backups
until pg_isready -q; do echo "waiting for the database..."; sleep 3; done
while true; do
  f="/backups/thelot-$(date +%Y-%m-%d-%H%M).dump"
  if pg_dump -Fc -f "$f.tmp"; then
    mv "$f.tmp" "$f"; echo "backup ok: $f"; wait_s=86400
  else
    rm -f "$f.tmp"; echo "backup FAILED, retrying in 5 minutes"; wait_s=300
  fi
  find /backups -name 'thelot-*.dump' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
  sleep "$wait_s"
done
