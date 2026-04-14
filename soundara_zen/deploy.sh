#!/usr/bin/env bash
# Soundara Zen deploy script
# Installs deps, builds frontend, registers systemd services, and (optionally)
# configures nginx + Let's Encrypt HTTPS.
#
# Usage:
#   sudo bash deploy.sh
#   sudo bash deploy.sh --with-nginx --domain soundara.co --email you@example.com
#
# Flags:
#   --with-nginx            Configure nginx as reverse proxy + static host
#   --with-https            Obtain Let's Encrypt cert via certbot (implies --with-nginx)
#   --domain <name>         Primary domain (www.<domain> is added automatically)
#   --email <address>       Email for Let's Encrypt registration

set -euo pipefail

# ---- Config ----
APP_USER="${APP_USER:-$(logname 2>/dev/null || echo ${SUDO_USER:-root})}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BACKEND_DIR="${BACKEND_DIR:-$APP_DIR/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_DIR/frontend}"
VENV_DIR="${VENV_DIR:-$APP_DIR/.venv}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
NODE_MAJOR="${NODE_MAJOR:-20}"

BACKEND_SERVICE="soundara-backend"
FRONTEND_SERVICE="soundara-frontend"

WITH_NGINX=0
WITH_HTTPS=0
DOMAIN=""
EMAIL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-nginx) WITH_NGINX=1; shift ;;
    --with-https) WITH_HTTPS=1; WITH_NGINX=1; shift ;;
    --domain)     DOMAIN="$2"; shift 2 ;;
    --email)      EMAIL="$2"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

log() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root: sudo bash deploy.sh" >&2
  exit 1
fi

if [[ $WITH_NGINX -eq 1 && -z "$DOMAIN" ]]; then
  echo "--with-nginx requires --domain <name>" >&2
  exit 1
fi

log "Installing system packages"
apt-get update -y
apt-get install -y python3 python3-venv python3-pip curl ca-certificates gnupg build-essential libmagic1

if ! command -v node >/dev/null 2>&1; then
  log "Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

log "Creating Python virtualenv at $VENV_DIR"
[[ -d "$VENV_DIR" ]] || python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip wheel

log "Installing Python requirements"
"$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt"

log "Installing frontend dependencies and building"
cd "$FRONTEND_DIR"
if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
npm run build

log "Fixing ownership to $APP_USER"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# Bind backend to localhost if nginx will front it, else bind publicly.
if [[ $WITH_NGINX -eq 1 ]]; then
  BACKEND_BIND="127.0.0.1"
else
  BACKEND_BIND="0.0.0.0"
fi

log "Writing systemd unit for backend ($BACKEND_SERVICE)"
cat >/etc/systemd/system/${BACKEND_SERVICE}.service <<EOF
[Unit]
Description=Soundara backend (FastAPI/uvicorn)
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=-$APP_DIR/.env
ExecStart=$VENV_DIR/bin/uvicorn main:app --host $BACKEND_BIND --port $BACKEND_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

if [[ $WITH_NGINX -eq 0 ]]; then
  log "Writing systemd unit for frontend ($FRONTEND_SERVICE) [vite preview]"
  cat >/etc/systemd/system/${FRONTEND_SERVICE}.service <<EOF
[Unit]
Description=Soundara frontend (Vite preview server)
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$FRONTEND_DIR
ExecStart=/usr/bin/npm run preview -- --host 0.0.0.0 --port $FRONTEND_PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
else
  # nginx will serve the static build; disable the vite preview service if it exists
  if systemctl list-unit-files | grep -q "^${FRONTEND_SERVICE}.service"; then
    log "Disabling $FRONTEND_SERVICE (nginx will serve frontend/dist)"
    systemctl disable --now ${FRONTEND_SERVICE}.service || true
    rm -f /etc/systemd/system/${FRONTEND_SERVICE}.service
  fi
fi

log "Enabling and starting backend"
systemctl daemon-reload
systemctl enable --now ${BACKEND_SERVICE}.service
[[ $WITH_NGINX -eq 0 ]] && systemctl enable --now ${FRONTEND_SERVICE}.service || true

if [[ $WITH_NGINX -eq 1 ]]; then
  log "Installing nginx"
  apt-get install -y nginx
  [[ $WITH_HTTPS -eq 1 ]] && apt-get install -y certbot python3-certbot-nginx

  NGINX_SITE="/etc/nginx/sites-available/soundara"
  log "Writing nginx site -> $NGINX_SITE"
  cat >"$NGINX_SITE" <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $FRONTEND_DIR/dist;
    index index.html;
    client_max_body_size 50M;

    # SPA: serve the static build, fall back to index.html for client routes
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend routes proxied to uvicorn on 127.0.0.1:$BACKEND_PORT
    location ~ ^/(health|library|user_library|user_playlists|user_subscriptions|process|process_audio|track_event|create_checkout_session|create_subscription_session|submit_survey|play|webhook|admin) {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
EOF

  ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/soundara
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx

  if [[ $WITH_HTTPS -eq 1 ]]; then
    log "Obtaining Let's Encrypt cert for $DOMAIN, www.$DOMAIN"
    CERTBOT_ARGS=(--nginx --non-interactive --agree-tos --redirect -d "$DOMAIN" -d "www.$DOMAIN")
    if [[ -n "$EMAIL" ]]; then
      CERTBOT_ARGS+=(--email "$EMAIL")
    else
      CERTBOT_ARGS+=(--register-unsafely-without-email)
    fi
    certbot "${CERTBOT_ARGS[@]}"
    systemctl reload nginx
    log "HTTPS live at https://$DOMAIN"
  fi
fi

log "Status"
systemctl --no-pager status ${BACKEND_SERVICE}.service || true
[[ $WITH_NGINX -eq 0 ]] && systemctl --no-pager status ${FRONTEND_SERVICE}.service || true
[[ $WITH_NGINX -eq 1 ]] && systemctl --no-pager status nginx || true

cat <<EOF

Done.
EOF
if [[ $WITH_NGINX -eq 1 ]]; then
  SCHEME=$([[ $WITH_HTTPS -eq 1 ]] && echo https || echo http)
  echo "  Site: $SCHEME://$DOMAIN"
else
  echo "  Backend:  http://<server-ip>:$BACKEND_PORT"
  echo "  Frontend: http://<server-ip>:$FRONTEND_PORT"
fi
cat <<EOF

Useful commands:
  sudo systemctl restart $BACKEND_SERVICE
  sudo journalctl -u $BACKEND_SERVICE -f
  sudo nginx -t && sudo systemctl reload nginx
EOF
