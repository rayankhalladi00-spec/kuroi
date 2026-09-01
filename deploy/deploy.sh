#!/usr/bin/env bash
# Met à jour le site avec la dernière version du dépôt GitHub.
#   ssh root@IP 'bash /opt/kuroi/deploy/deploy.sh'
set -euo pipefail

APP_DIR=/opt/kuroi
APP_USER=kuroi

cd "$APP_DIR"
echo "==> Récupération des modifications"
git fetch --quiet origin
git reset --hard --quiet origin/main

echo "==> Dépendances"
npm ci --omit=dev

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Redémarrage"
systemctl restart kuroi
sleep 2

if systemctl is-active --quiet kuroi; then
  echo "==> Site à jour et en ligne."
else
  echo "==> ÉCHEC : le service ne démarre pas."
  journalctl -u kuroi -n 40 --no-pager
  exit 1
fi
