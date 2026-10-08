#!/usr/bin/env bash
# Aplica assets/subathon-server.ico num .exe gerado por `bun build --compile`.
#
# Bun 1.3.14 tem --windows-icon, mas o CLI recusa o flag quando o host
# não é Windows ("Using --windows-icon is only available when compiling
# on Windows"), mesmo com --target=bun-windows-x64. O release cross-compila
# no Ubuntu, então o ícone entra depois, com rcedit.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "uso: apply-windows-icon.sh <exe> <ico>" >&2
  exit 2
fi

EXE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
ICO="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -f "$EXE" ]]; then
  echo "executável não encontrado: $EXE" >&2
  exit 1
fi
if [[ ! -f "$ICO" ]]; then
  echo "ícone não encontrado: $ICO" >&2
  exit 1
fi

RCEDIT_VERSION="2.0.0"
RCEDIT_SHA256="3e7801db1a5edbec91b49a24a094aad776cb4515488ea5a4ca2289c400eade2a"
CACHE="${TMPDIR:-/tmp}/streamdrops-rcedit-${RCEDIT_VERSION}"
mkdir -p "$CACHE"
RCEDIT="${RCEDIT:-$CACHE/rcedit-x64.exe}"

if [[ ! -f "$RCEDIT" ]] || ! echo "${RCEDIT_SHA256}  ${RCEDIT}" | sha256sum -c - >/dev/null 2>&1; then
  curl -fsSL -o "$RCEDIT" \
    "https://github.com/electron/rcedit/releases/download/v${RCEDIT_VERSION}/rcedit-x64.exe"
  echo "${RCEDIT_SHA256}  ${RCEDIT}" | sha256sum -c -
fi

case "$(uname -s)" in
  Linux)
    if ! command -v wine >/dev/null 2>&1; then
      echo "wine é necessário para rodar rcedit no Linux" >&2
      exit 1
    fi
    export WINEDEBUG="${WINEDEBUG:--all}"
    export WINEARCH="${WINEARCH:-win64}"
    export WINEPREFIX="${WINEPREFIX:-$CACHE/wineprefix}"
    wine "$RCEDIT" "$EXE" --set-icon "$ICO"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    "$RCEDIT" "$EXE" --set-icon "$ICO"
    ;;
  *)
    echo "rcedit precisa de Linux com wine ou de Windows" >&2
    exit 1
    ;;
esac

python3 "$SCRIPT_DIR/fix-windows-icon-resources.py" "$EXE" "$ICO"
