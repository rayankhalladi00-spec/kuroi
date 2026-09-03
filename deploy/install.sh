#!/usr/bin/env bash
# Installation complète de Kuroi sur un VPS Ubuntu 24.04 vierge.
#
#   bash install.sh                         # clone depuis GitHub (défaut)
#   bash install.sh <url-du-depot>          # clone depuis un autre dépôt
#   bash install.sh --no-fetch              # utilise le code déjà présent dans /opt/kuroi
#
# Le mode --no-fetch sert quand le code a été envoyé directement par scp/rsync,
# sans passer par GitHub.
set -euo pipefail

APP_DIR=/opt/kuroi
APP_USER=kuroi
DEFAULT_REPO=https://github.com/rayankhalladi00-spec/kuroi.git

FETCH=1
REPO_URL="$DEFAULT_REPO"
if [ "${1:-}" = "--no-fetch" ]; then
  FETCH=0
elif [ -n "${1:-}" ]; then
  REPO_URL="$1"
fi

echo "==> Mise à jour du système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

echo "==> Installation de Node.js 24, Nginx, Git, UFW, Certbot"
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y -qq nodejs nginx git ufw certbot python3-certbot-nginx
node -v

echo "==> Création de l'utilisateur applicatif « $APP_USER »"
id -u "$APP_USER" &>/dev/null || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"

if [ "$FETCH" = "1" ]; then
  echo "==> Récupération du code dans $APP_DIR"
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch --quiet origin
    git -C "$APP_DIR" reset --hard --quiet origin/main
  else
    rm -rf "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
  fi
else
  echo "==> Utilisation du code déjà présent dans $APP_DIR"
  [ -f "$APP_DIR/server.js" ] || { echo "ERREUR : $APP_DIR/server.js introuvable."; exit 1; }
fi

echo "==> Installation des dépendances"
cd "$APP_DIR"
npm ci --omit=dev

echo "==> Empreinte des fichiers statiques"
node scripts/stamp-assets.js

echo "==> Configuration (.env)"
if [ ! -f "$APP_DIR/.env" ]; then
  SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
# Passer a true apres avoir installe le HTTPS (certbot).
COOKIE_SECURE=false
SESSION_SECRET=$SECRET
ADMIN_USERNAME=rayan
ADMIN_EMAIL=rayan.khalladi@icloud.com
ADMIN_PASSWORD=
EOF
  chmod 600 "$APP_DIR/.env"
  echo "    .env créé (mot de passe admin généré au premier démarrage)"
else
  echo "    .env déjà présent, conservé tel quel"
fi

mkdir -p "$APP_DIR/data"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Service systemd"
cp "$APP_DIR/deploy/kuroi.service" /etc/systemd/system/kuroi.service
systemctl daemon-reload
systemctl enable kuroi
systemctl restart kuroi

echo "==> Nginx"
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/kuroi
ln -sf /etc/nginx/sites-available/kuroi /etc/nginx/sites-enabled/kuroi
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Pare-feu"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

sleep 3
echo
echo "======================================================"
if systemctl is-active --quiet kuroi; then
  echo " Installation terminée, le site tourne."
else
  echo " ATTENTION : le service kuroi ne démarre pas."
  journalctl -u kuroi -n 30 --no-pager
fi
echo " Site : http://$(curl -fsS --max-time 5 ifconfig.me || echo '<IP-du-VPS>')"
echo
echo " Identifiants administrateur :"
cat "$APP_DIR/data/ADMIN_CREDENTIALS.txt" 2>/dev/null || echo "  (voir : journalctl -u kuroi | grep -A4 ADMINISTRATEUR)"
echo
echo " Quand le domaine pointera ici, activer le HTTPS :"
echo "   certbot --nginx -d exemple.com -d www.exemple.com"
echo "======================================================"
