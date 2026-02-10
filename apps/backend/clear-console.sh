#!/bin/bash
# MINGW64 Windows Git Bash - USE FORWARD SLASHES /

echo "🎯 Current dir: $(pwd)"
echo "📁 Use FORWARD SLASH / (not \\ backslash!)"

echo "🎯 Choose:"
echo "1) SINGLE FILE  → src/modules/notification/notification.service.ts"
echo "2) BACKEND FOLDER → src/"
echo "3) FULL PROJECT"
read -p "Choice: " choice

mkdir -p console-backups

case $choice in
  1)
    echo "📝 EXAMPLES (copy-paste):"
    echo "src/modules/notification/notification.service.ts"
    echo "src/modules/template/template.service.ts"
    read -p "File path: " file
    
    if [[ ! -f "$file" ]]; then
      echo "❌ NOT FOUND. Try: ls -la src/modules/"
      ls -la src/modules/ || echo "Folder missing"
      exit 1
    fi
    
    echo "🔄 $file"
    cp "$file" "console-backups/$(basename "$file").bak"
    sed -i.bak "s/console\.[a-z]*([^;]*);/;/g" "$file" && rm "$file.bak"
    echo "✅ $(basename "$file")"
    ;;
    
  2)
    echo "🧹 BACKEND src/ folder"
    for file in $(find src -name "*.ts" 2>/dev/null); do
      echo "🔄 $(basename "$file")"
      cp "$file" "console-backups/$(basename "$file").bak"
      sed -i.bak "s/console\.[a-z]*([^;]*);/;/g" "$file" && rm "$file.bak"
      echo "✅ $(basename "$file")"
    done
    ;;
    
  3)
    echo "🌍 FULL PROJECT (backend+frontend)"
    find . -path "./apps/backend" -prune -o -name "*.ts" -o -name "*.vue" | while read file; do
      echo "🔄 $(basename "$file")"
      cp "$file" "console-backups/$(basename "$file").bak"
      sed -i.bak "s/console\.[a-z]*([^;]*);/;/g" "$file" && rm "$file.bak"
      echo "✅ $(basename "$file")"
    done
    ;;
esac

echo "🎉 DONE! Backups: console-backups/"
