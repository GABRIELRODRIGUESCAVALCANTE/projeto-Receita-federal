#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICES_DIR="$ROOT_DIR/services"
mkdir -p "$SERVICES_DIR"

REPOS=(
  "calculadora-rtc-regime-regular|https://github.com/ReceitaFederal/calculadora-rtc-regime-regular.git"
  "calculadora-rtc-simples-nacional|https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional.git"
  "calculadora-rtc-gerador-danfse|https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse.git"
)

for entry in "${REPOS[@]}"; do
  name="${entry%%|*}"
  url="${entry##*|}"
  target="$SERVICES_DIR/$name"
  if [ -d "$target/.git" ]; then
    echo "[ok] $name já clonado em $target"
  else
    echo "[clone] Clonando $name..."
    git clone "$url" "$target"
  fi
done

echo "Todos os repositórios oficiais estão prontos em $SERVICES_DIR"

