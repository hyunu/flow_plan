#!/usr/bin/env bash
# macOS 설치본: Flow Plan.app + DMG
# 사용: ./build.sh            # 빌드만
#       ./build.sh --install  # /Applications 에 넣고 실행
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
PY="${PY:-$REPO/backend/.venv/bin/python}"
INSTALL=0
SKIP_FE=0
for a in "$@"; do
  case "$a" in
    --install) INSTALL=1 ;;
    --skip-frontend) SKIP_FE=1 ;;
  esac
done

if [[ ! -x "$PY" ]]; then
  echo "Python이 없습니다. PY=python3 $0 또는 backend/.venv 를 만드세요." >&2
  exit 1
fi

if [[ "$SKIP_FE" -eq 0 ]]; then
  echo "== 프론트 빌드 =="
  (cd "$REPO/frontend" && npm run build)
fi

echo "== 데스크톱 패키지 =="
"$PY" -m pip install -q -r "$ROOT/requirements.txt"

if [[ ! -f "$ROOT/assets/icon.icns" ]]; then
  echo "== 아이콘(icns) =="
  TMP="$(mktemp -d)"
  "$PY" - <<PY
from pathlib import Path
from PIL import Image
src = Path("$ROOT/assets/icon.ico")
img = Image.open(src).convert("RGBA")
out = Path("$TMP/icon.png")
img.resize((1024, 1024)).save(out)
print(out)
PY
  ICONSET="$TMP/FlowPlan.iconset"
  mkdir -p "$ICONSET"
  PNG="$TMP/icon.png"
  for s in 16 32 64 128 256 512; do
    sips -z "$s" "$s" "$PNG" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
    d=$((s * 2))
    sips -z "$d" "$d" "$PNG" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$ROOT/assets/icon.icns"
  rm -rf "$TMP"
fi

echo "== PyInstaller (.app) =="
cd "$ROOT"
"$PY" -m PyInstaller --noconfirm flowplan.spec
APP="$ROOT/dist/Flow Plan.app"
if [[ ! -d "$APP" ]]; then
  echo "앱 번들이 없습니다: $APP" >&2
  exit 1
fi

echo "== DMG =="
STAGE="$ROOT/dist/dmg"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
DMG="$ROOT/dist/FlowPlan.dmg"
rm -f "$DMG"
hdiutil create -volname "Flow Plan" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"
echo "설치 이미지: $DMG"

if [[ "$INSTALL" -eq 1 ]]; then
  echo "== /Applications 에 설치 =="
  DEST="/Applications/Flow Plan.app"
  killall FlowPlan 2>/dev/null || true
  sleep 0.4
  rm -rf "$DEST"
  cp -R "$APP" "$DEST"
  echo "설치됨: $DEST"
  open "$DEST"
fi

echo "완료. DMG를 열어 Applications로 끌어다 넣거나, ./build.sh --install 을 쓰세요."
