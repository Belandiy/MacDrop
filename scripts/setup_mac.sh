#!/bin/bash
# ==============================================================================
# MacDrop - macOS Setup Assistant
# ==============================================================================

set -e

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║            MacDrop for macOS Setup            ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""

# 1. Choose folder for files
DEFAULT_FOLDER="$HOME/Desktop/MacDrop"
echo "📂 Куда сохранять файлы на вашем Mac?"
read -p "   Папка [$DEFAULT_FOLDER]: " USER_FOLDER
TARGET_FOLDER="${USER_FOLDER:-$DEFAULT_FOLDER}"

mkdir -p "$TARGET_FOLDER"
echo "   ✅ Папка готова: $TARGET_FOLDER"
echo ""

# 2. Check architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    echo "⚡ Обнаружен Mac на Apple Silicon (M1/M2/M3/M4)"
else
    echo "⚡ Обнаружен Mac на Intel (x86_64)"
fi
echo ""

# 3. Pair device code
echo "🔗 Введите код сопряжения с экрана ПК (например: PC-4921):"
read -p "   Код ПК: " PEER_CODE

if [ -n "$PEER_CODE" ]; then
    echo "   ✅ Устройство $PEER_CODE привязано!"
fi

# 4. Create config
CONFIG_DIR="$HOME/Library/Application Support/MacDrop"
mkdir -p "$CONFIG_DIR"

cat <<EOF > "$CONFIG_DIR/settings.json"
{
  "targetFolder": "$TARGET_FOLDER",
  "autoStart": true,
  "notifications": true,
  "deviceId": "MAC-$(jot -r 1 1000 9999 2>/dev/null || od -An -N2 -i /dev/urandom | awk '{print ($1 % 9000) + 1000}')",
  "deviceName": "$(scutil --get ComputerName 2>/dev/null || hostname)",
  "pairedDevice": {
    "id": "$PEER_CODE",
    "name": "Windows ПК",
    "pairedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  },
  "apiPort": 8384
}
EOF

echo ""
echo "🎉 Настройка MacDrop завершена!"
echo "   Все файлы из $TARGET_FOLDER теперь автоматически синхронизируются с ПК."
echo "   Запустите MacDrop.app для отображения иконки в Menu Bar."
echo ""
