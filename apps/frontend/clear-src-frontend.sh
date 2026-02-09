#!/bin/bash

# Target folder - your components/common
TARGET_DIR="src/components/common"

echo "🧹 Cleaning $TARGET_DIR (console.log + // + HTML comments)..."

# Create backups folder
mkdir -p backups/common

# Process ALL .vue, .ts, .js files
find "$TARGET_DIR" -name "*.vue" -o -name "*.ts" -o -name "*.js" | while read -r file; do
  
  [[ ! -f "$file" ]] && continue
  
  echo "🔄 Processing: $file"
  
  # Backup
  cp "$file" "backups/common/$(basename "$file").bak"
  
  # 1. Remove console.log, console.warn, console.error
  sed -i 's/console\.[a-z]*([^;]*);//g' "$file"
  sed -i 's/console\.[a-z]*([^;]*\),//g' "$file"
  
  # 2. Remove // comment lines (JavaScript)
  sed -i '/^[ \t]*\/\/.*$/d' "$file"
  
  # 3. Remove HTML comments <!-- --> from template (Vue)
  sed -i 's/<!--[^>]*-->//g' "$file"
  
  # 4. Clean empty lines
  sed -i '/^$/d' "$file"
  
  echo "✅ Cleaned: $(basename "$file")"
done

echo "🎉 src/components/common FULLY CLEANED!"
echo "📁 Backups: backups/common/"
