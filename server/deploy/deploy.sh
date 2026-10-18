#!/bin/sh
# Deploy da API do Cupom Favorito na VPS Contabo (/opt/cupom-favorito).
#
#   sh server/deploy/deploy.sh                 # publica a pasta server/ da origin/main
#   sh server/deploy/deploy.sh origin/<branch> # publica outra referência já enviada ao GitHub
#
# Passos: segredos (gerados na VPS na 1ª vez, nunca saem dela) → backup do banco →
# código via git archive (o anterior fica em src.before-<sha>) → build e subida →
# conferência. As migrações rodam na subida da API.
#
# Rollback (na VPS):
#   cd /opt/cupom-favorito && rm -rf src && mv src.before-<sha> src
#   docker compose up -d --build --no-deps api
#   (banco: docker exec -i cupom-favorito-postgres pg_restore -U cupom -d cupom --clean
#    < backups/deploy-<sha>/database.dump)
set -eu

VPS=root@173.212.208.109
KEY="$HOME/.ssh/pedeli_vps"
APP=/opt/cupom-favorito
API_HOST=api.cupom.impulsiodigital.com
REF="${1:-origin/main}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SSH="ssh -o BatchMode=yes -i $KEY"

cd "$REPO"
git fetch -q origin
SHA="$(git rev-parse --short "$REF")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

echo "==> Publicando $SHA ($(git log -1 --format=%s "$SHA"))"

echo "==> Segredos e backup"
$SSH "$VPS" "set -e; mkdir -p $APP/backups; chmod 700 $APP $APP/backups; cd $APP
  if [ ! -f .env ]; then
    umask 077
    {
      echo API_HOST=$API_HOST
      echo POSTGRES_PASSWORD=\$(openssl rand -hex 24)
      echo JWT_SECRET=\$(openssl rand -base64 48 | tr -d '\n')
      echo SMTP_URL=
    } > .env
    echo '   .env criado com segredos novos'
  fi
  if docker ps --format '{{.Names}}' | grep -qx cupom-favorito-postgres; then
    mkdir -p backups/deploy-$SHA; chmod 700 backups/deploy-$SHA
    docker exec cupom-favorito-postgres pg_dump -U cupom -Fc cupom > backups/deploy-$SHA/database.dump
    du -h backups/deploy-$SHA/database.dump
  fi"

echo "==> Código"
git archive --format=tar.gz "$SHA:server" > "$TMP/api.tar.gz"
scp -q -o BatchMode=yes -i "$KEY" "$TMP/api.tar.gz" "$VPS:$APP/api-$SHA.tar.gz"
$SSH "$VPS" "set -e; cd $APP; rm -rf src.new; mkdir src.new
  tar xzf api-$SHA.tar.gz -C src.new && rm api-$SHA.tar.gz
  if [ -d src ]; then rm -rf src.before-$SHA; mv src src.before-$SHA; fi
  mv src.new src
  cp src/deploy/docker-compose.yml docker-compose.yml
  ls -d src.before-* 2>/dev/null | sort | head -n -3 | xargs rm -rf"

echo "==> Build e subida (alguns minutos)"
$SSH "$VPS" "set -e; cd $APP
  docker compose up -d postgres
  docker compose build api > build-$SHA.log 2>&1 || { tail -40 build-$SHA.log; exit 1; }
  docker compose up -d --no-deps api
  sleep 8; docker compose ps --format '{{.Name}} {{.Status}}'"

echo "==> Conferência"
printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "https://$API_HOST/saude")" "https://$API_HOST/saude"
$SSH "$VPS" "docker logs --since 2m cupom-favorito-api 2>&1 | grep -iE 'error|migra' | tail -5 || true"
echo "Pronto: $SHA no ar em https://$API_HOST"
