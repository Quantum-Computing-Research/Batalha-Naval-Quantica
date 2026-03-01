#!/usr/bin/env bash
set -euo pipefail

BUCKET="quantum-battleship-prod-cache"
PREFIX="cache"              # sem barra no final
MOUNT_DIR="../../infra/bucket/quantum-battleship-artifacts"

# macOS: s3fs via Homebrew
command -v s3fs >/dev/null || { echo "s3fs não encontrado. Instale: brew install s3fs"; exit 1; }

mkdir -p "$MOUNT_DIR"

# evita erro se já estiver montado
if mount | grep -q "on ${MOUNT_DIR} "; then
  echo "[ok] já está montado em ${MOUNT_DIR}"
  exit 0
fi

# monta
s3fs "${BUCKET}:${PREFIX}" "$MOUNT_DIR" \
  -o use_path_request_style \
  -o allow_other \
  -o umask=0022 \
  -o url=https://s3.amazonaws.com

echo "[ok] mount: s3://${BUCKET}/${PREFIX} -> ${MOUNT_DIR}"