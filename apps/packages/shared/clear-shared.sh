#!/bin/bash

# Target ONLY src folder (you're already in packages/shared)
TARGET_DIR="src"

echo "🧹 Cleaning packages/shared/src (enums, types, utils)..."

# Create backups folder
mkdir -p backups/src

# Process ALL .ts files (your screenshot shows only .ts files)
find "$TARGET_DIR" -name "*.ts" | while read -r file; do
  
  [[ ! -f "$file" ]] && continue
  
  echo "🔄 $(basename "$file")"
  
  # Backup
  cp "$file" "backups/src/$(basename "$file").bak"
  
  # Remove console statements
  sed -i 's/console\.[a-z]*([^;]*);//g' "$file"
  sed -i 's/console\.[a-z]*([^;]*\),//g' "$file"
  
  # Remove // comments
  sed -i '/^[ \t]*\/\/.*$/d' "$file"
  
  # Clean empty lines
  sed -i '/^$/d' "$file"
  
  echo "✅ $(basename "$file") cleaned"
done

echo "🎉 packages/shared/src CLEANED!"
echo "📁 Backups: backups/src/"
