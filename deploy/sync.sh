#!/usr/bin/env bash
# N100 서비스 디렉터리로 소스를 동기화한다. (빌드/배포는 허브 MCP가 수행)
#
# 사용법:
#   deploy/sync.sh [host]        # 기본 host: n100-pve-dev
#
# 사전 조건: /srv/services/flow-plan 디렉터리가 허브 scaffold로 만들어져 있어야 한다.
set -euo pipefail

HOST="${1:-n100-pve-dev}"
DEST="/srv/services/flow-plan"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

rsync -rl --checksum --inplace --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude 'backend/data' \
  --exclude 'desktop/build' \
  --exclude '.DS_Store' \
  "$ROOT/" "$HOST:$DEST/app/"

echo "synced: $ROOT -> $HOST:$DEST/app"
