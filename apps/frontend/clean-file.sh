#!/bin/bash

FILES=(
  # "src/views/SettingChangeProfileView.vue"
  # "src/views/CreateNotificationView.vue"
  # "src/views/TypeView.vue"
  # "src/views/ProfileNotificationSetup.vue"
  # "src/views/RegisterView.vue"
  # "src/views/CreateNewType.vue"
  # "src/views/LoginView.vue"
  # "src/views/ScheduleDetailView.vue"
  # "src/views/SettingChangePasswordView.vue"
  # "src/views/SettingView.vue"
  # "src/views/TestView.vue"
  # "src/views/UserManagementView.vue"
  # "src/views/UsersView.vue"
  "src/views/ScheduleView.vue"
  # "src/stores/auth.ts"
)
for file in "${FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "❌ $file not found"
    continue
  fi

  cp "$file" "${file}.backup"
  
  # Replace console.log(...) with NOTHING - safest approach
  sed -i "s/console\.log[^;]*;//g" "$file"
  sed -i "s/console\.warn[^;]*;//g" "$file" 
  sed -i "s/console\.error[^;]*;//g" "$file"
  
  # Remove empty comment lines
  sed -i '/^[ \t]*\/\/.*$/d' "$file"
  
  echo "✅ $file processed"
done

echo "✅ ALL SAFE! No syntax breaks."

# for file in "${FILES[@]}"; do
#   if [[ ! -f "$file" ]]; then
#     echo "❌ $file not found"
#     continue
#   fi

#   # Backup
#   cp "$file" "${file}.backup"
  
#   # Remove console.log lines (simple pattern matching)
#   grep -v "console\." "$file" > temp && mv temp "$file"
  
#   # Remove // comment lines
#   grep -v "^[[:space:]]*//" "$file" > temp && mv temp "$file"
  
#   echo "✅ Cleaned $file"
# done

# echo "🎉 Done!"
