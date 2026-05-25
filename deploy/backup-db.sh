#!/bin/bash
# Daglig mysqldump av ravema_lis-DB i Docker-container.
# Körs av ravema-lis-backup.timer (systemd) varje natt 03:15.
#
# Rotation: behåller 30 dagar lokalt på VPS.
# För offsite-backup (S3/Backblaze) — sätt upp i Sprint 2.

set -euo pipefail

BACKUP_DIR="$HOME/backups/ravema-lis-mysql"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

TS=$(date +%Y-%m-%d_%H%M%S)
FILE="$BACKUP_DIR/ravema-lis-$TS.sql.gz"

# Läs lösenord från .env — använd grep+cut för att slippa source
# (bcrypt-hashar i .env innehåller $ som bash skulle expandera vid source)
PROJECT_DIR="$HOME/projects/ravema-lis"
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "ERROR: $PROJECT_DIR/.env saknas" >&2
    exit 1
fi

MYSQL_ROOT_PASSWORD=$(grep '^MYSQL_ROOT_PASSWORD=' "$PROJECT_DIR/.env" | cut -d= -f2-)
if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    echo "ERROR: MYSQL_ROOT_PASSWORD saknas i .env" >&2
    exit 1
fi

# Verifiera att container körs
if ! docker ps --format '{{.Names}}' | grep -q '^ravema-lis-mysql$'; then
    echo "ERROR: ravema-lis-mysql-container körs inte" >&2
    exit 1
fi

# Dumpa (mysqldump i container, gzip på host)
docker exec ravema-lis-mysql mysqldump \
    -u root -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction --quick --no-tablespaces \
    ravema_lis 2>/dev/null \
  | gzip > "$FILE"

chmod 600 "$FILE"
echo "[$(date -Iseconds)] Backup: $FILE ($(du -h "$FILE" | cut -f1))"

# Rotera: behåll senaste 30 dagar
DELETED=$(find "$BACKUP_DIR" -name "ravema-lis-*.sql.gz" -mtime +30 -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "  rotated: removed $DELETED file(s) older than 30 days"
fi

# Health-stamp så vi kan upptäcka stallade backups
date -Iseconds > "$BACKUP_DIR/.last-success"
