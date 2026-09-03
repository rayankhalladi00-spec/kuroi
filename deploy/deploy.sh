#!/usr/bin/env bash
# Met à jour le site déjà installé.
#
#   bash /opt/kuroi/deploy/deploy.sh              # récupère la dernière version depuis GitHub
#   bash /opt/kuroi/deploy/deploy.sh --no-fetch   # code déjà envoyé par scp/rsync
set -euo pipefail

APP_DIR=/opt/kuroi
APP_USER=kuroi

cd "$APP_DIR"

if [ "${1:-}" != "--no-fetch" ]; then
  echo "==> Récupération des modifications"
  git fetch --quiet origin
  git reset --hard --quiet origin/main
else
  echo "==> Code déjà en place, pas de récupération"
fi

echo "==> Dépendances"
npm ci --omit=dev

echo "==> Empreinte des fichiers statiques"
node scripts/stamp-assets.js

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Redémarrage"
systemctl restart kuroi
sleep 3

if systemctl is-active --quiet kuroi; then
  echo "==> Site à jour et en ligne."
else
  echo "==> ÉCHEC : le service ne démarre pas."
  journalctl -u kuroi -n 40 --no-pager
  exit 1
fi
