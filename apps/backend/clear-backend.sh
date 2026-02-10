#!/bin/bash

# Target NestJS backend src folder
TARGET_DIR="src"

echo "🧹 Cleaning NestJS backend src folder..."

# Create backups folder
mkdir -p backups/backend

# Process ALL .ts files (NestJS uses TypeScript)
find "$TARGET_DIR" -name "*.ts" | while read -r file; do
  
  [[ ! -f "$file" ]] && continue
  
  echo "🔄 $(basename "$file")"
  
  # Backup
  cp "$file" "backups/backend/$(basename "$file").bak"
  
  # Remove console statements (NestJS common patterns)
  sed -i 's/console\.[a-z]*([^;]*);//g' "$file"
  sed -i 's/console\.[a-z]*([^;]*\),//g' "$file"
  
  # Remove // comments (TypeScript)
  sed -i '/^[ \t]*\/\/.*$/d' "$file"
  
  # Clean empty lines
  sed -i '/^$/d' "$file"
  
  echo "✅ $(basename "$file") cleaned"
done

echo "🎉 NestJS backend src CLEANED!"
echo "📁 Backups: backups/backend/"
