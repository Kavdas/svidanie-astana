#!/usr/bin/env bash
# Copies one value out of backend/.env into the clipboard without printing it.
#
# Anything a terminal prints can end up in a log, in scrollback or in a
# transcript. Paste targets — a hosting dashboard's variable form, a CI secret
# — only ever need the clipboard, so the value never has to be displayed.
#
# Usage: scripts/copy-secret.sh DATABASE_URL

set -euo pipefail

KEY="${1:?укажите имя переменной, например: scripts/copy-secret.sh DATABASE_URL}"
ENV_FILE="$(dirname "$0")/../backend/.env"

[ -f "$ENV_FILE" ] || { echo "нет файла $ENV_FILE" >&2; exit 1; }

VALUE="$(sed -n "s/^${KEY}=//p" "$ENV_FILE" | head -n1 | sed 's/^"//; s/"$//')"
[ -n "$VALUE" ] || { echo "$KEY не найден в backend/.env" >&2; exit 1; }

if command -v wl-copy >/dev/null; then
  printf '%s' "$VALUE" | wl-copy
elif command -v xclip >/dev/null; then
  printf '%s' "$VALUE" | xclip -selection clipboard
else
  echo "нет ни wl-copy, ни xclip" >&2; exit 1
fi

echo "$KEY скопирован в буфер обмена (${#VALUE} символов). Вставляйте: Ctrl+V"
