#!/usr/bin/env bash
# Arranca la plataforma: API (apps/api, puerto 3000) y web (apps/web, puerto 3001).
#
#   ./run.sh           modo desarrollo, recarga al guardar cambios
#   ./run.sh prod      compila y arranca como en producción
#   ./run.sh api       solo la API en desarrollo
#   ./run.sh web       solo la web en desarrollo
#
# Ctrl+C detiene todo lo que se haya arrancado.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API="$RAIZ/apps/api"
WEB="$RAIZ/apps/web"
MODO="${1:-dev}"

AZUL=$'\033[34m'; VERDE=$'\033[32m'; AMARILLO=$'\033[33m'; ROJO=$'\033[31m'; NEGRITA=$'\033[1m'; FIN=$'\033[0m'

info()  { echo "${NEGRITA}›${FIN} $*"; }
aviso() { echo "${AMARILLO}!${FIN} $*"; }
error() { echo "${ROJO}✗${FIN} $*" >&2; exit 1; }

case "$MODO" in
  dev|prod|api|web) ;;
  -h|--help|ayuda) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) error "Modo desconocido: $MODO. Usá dev, prod, api o web (./run.sh --help)." ;;
esac

command -v node >/dev/null || error "No encuentro Node.js. Instalalo desde https://nodejs.org (versión 20 o superior)."
command -v npm  >/dev/null || error "No encuentro npm."

# --- Configuración -----------------------------------------------------------

[[ -f "$API/.env" ]] || error "Falta apps/api/.env. Copiá apps/api/.env.example a apps/api/.env y completá DATABASE_URL y JWT_SECRET."

if [[ ! -f "$WEB/.env.local" && ! -f "$WEB/.env" ]]; then
  cp "$WEB/.env.example" "$WEB/.env.local"
  aviso "Creé apps/web/.env.local a partir de .env.example."
fi

# --- Dependencias ------------------------------------------------------------

# Workspaces: un solo node_modules en la raíz para la API, la web, la base y los contratos.
if [[ ! -d "$RAIZ/node_modules" ]]; then
  info "Instalando dependencias…"
  (cd "$RAIZ" && npm install --no-audit --no-fund)
fi
if [[ "$MODO" != "web" && ! -d "$RAIZ/node_modules/.prisma/client" ]]; then
  info "Generando el cliente de Prisma…"
  (cd "$RAIZ" && npm run db:generate -w api)
fi

# --- Puertos -----------------------------------------------------------------

puerto_ocupado() {
  node -e "require('net').createServer().once('error',()=>process.exit(0)).once('listening',function(){this.close();process.exit(1)}).listen($1)"
}

if [[ "$MODO" != "web" ]] && puerto_ocupado 3000; then
  error "El puerto 3000 ya está en uso. ¿La API ya está corriendo en otra terminal?"
fi
if [[ "$MODO" != "api" ]] && puerto_ocupado 3001; then
  error "El puerto 3001 ya está en uso. ¿La web ya está corriendo en otra terminal?"
fi

# --- Compilación -------------------------------------------------------------

# Los contratos se compilan una vez acá; las apps arrancan con --ignore-scripts para que
# su predev no los compile otra vez en paralelo (en Windows chocan al escribir dist/).
info "Compilando los contratos…"
(cd "$RAIZ" && npm run contratos --silent)

if [[ "$MODO" == "prod" ]]; then
  info "Compilando la API…"
  (cd "$API" && npm run build)
  info "Compilando la web…"
  (cd "$WEB" && npm run build)
fi

# --- Arranque ----------------------------------------------------------------

PIDS=()

arrancar() {
  local carpeta="$1" etiqueta="$2" script="$3"
  (cd "$carpeta" && exec npm run "$script" --ignore-scripts) > >(sed -u "s/^/${etiqueta} /") 2>&1 &
  PIDS+=("$!")
}

detener() {
  trap - INT TERM EXIT
  echo
  info "Deteniendo…"
  for pid in "${PIDS[@]}"; do
    if [[ -r "/proc/$pid/winpid" ]]; then
      taskkill //PID "$(cat "/proc/$pid/winpid")" //T //F >/dev/null 2>&1 || true
    else
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  exit 0
}
trap detener INT TERM EXIT

SCRIPT="dev"
[[ "$MODO" == "prod" ]] && SCRIPT="start"

[[ "$MODO" != "web" ]] && arrancar "$API" "${AZUL}[api]${FIN}" "$SCRIPT"
[[ "$MODO" != "api" ]] && arrancar "$WEB" "${VERDE}[web]${FIN}" "$SCRIPT"

echo
[[ "$MODO" != "web" ]] && info "API: ${AZUL}http://localhost:3000${FIN}"
[[ "$MODO" != "api" ]] && info "Web: ${VERDE}http://localhost:3001${FIN}"
info "Ctrl+C para detener."
echo

# Si uno de los procesos se cae, se detiene el resto.
wait -n "${PIDS[@]}" || true
aviso "Un proceso terminó; detengo el resto."
detener
