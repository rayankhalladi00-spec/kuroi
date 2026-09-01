#!/usr/bin/env bash
# Installation complète de Kuroi sur un VPS Ubuntu 24.04 vierge.
# À lancer en root :
#   bash install.sh https://github.com/rayankhalladi00-spec/kuroi.git
set -euo pipefail

REPO_URL="${1:-https://github.com/rayankhalladi00-spec/kuroi.git}"
APP_DIR=/opt/kuroi
APP_USER=kuroi

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

echo "==> Récupération du code dans $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> Installation des dépendances"
cd "$APP_DIR"
npm ci --omit=dev

echo "==> Configuration (.env)"
if [ ! -f "$APP_DIR/.env" ]; then
  SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
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

sleep 2
echo
echo "======================================================"
echo " Installation terminée."
echo " Site : http://$(curl -fsS --max-time 5 ifconfig.me || echo '<IP-du-VPS>')"
echo
echo " Identifiants administrateur :"
cat "$APP_DIR/data/ADMIN_CREDENTIALS.txt" 2>/dev/null || journalctl -u kuroi -n 30 --no-pager | grep -A4 'ADMINISTRATEUR' || true
echo
echo " Quand le domaine pointera vers ce serveur, activer le HTTPS :"
echo "   certbot --nginx -d exemple.com -d www.exemple.com"
echo "======================================================"
