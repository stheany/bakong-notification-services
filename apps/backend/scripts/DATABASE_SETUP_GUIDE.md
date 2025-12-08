# Database Setup Guide for Azure Data Studio

This guide will help you set up the complete database structure for Bakong Notification Services using Azure Data Studio.

## 📋 Prerequisites

1. **Azure Data Studio** installed on your machine
   - Download from: https://aka.ms/azuredatastudio
   - Version 1.40+ recommended

2. **PostgreSQL Database Access**
   - Database server connection details (host, port, database name)
   - Valid credentials (username and password)
   - Required permissions: CREATE, DROP, ALTER, INDEX

3. **Connection Information**
   - Host: Your PostgreSQL server address
   - Port: Usually `5432` (or as configured)
   - Database: Target database name
   - Username: Your PostgreSQL username
   - Password: Your PostgreSQL password

## 🚀 Step-by-Step Instructions

### Step 1: Connect to Database in Azure Data Studio

1. **Open Azure Data Studio**

2. **Create a New Connection:**
   - Click the **"New Connection"** button (plug icon) in the left sidebar
   - Or press `Ctrl+Shift+C` (Windows/Linux) or `Cmd+Shift+C` (Mac)

3. **Enter Connection Details:**
<<<<<<< HEAD
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
   ```
   Connection Type: PostgreSQL
   Server: <your-server-address>
   Database: <your-database-name>
   Authentication Type: Password
   Username: <your-username>
   Password: <your-password>
   ```

4. **Click "Connect"**

5. **Verify Connection:**
   - You should see your database in the left sidebar under "Servers"
   - Expand the database to see existing tables (if any)

### Step 2: Open the Setup Script

1. **Navigate to the Script:**
   - Open the file: `apps/backend/scripts/COMPLETE_DATABASE_SETUP.sql`
   - You can open it in Azure Data Studio or any text editor

2. **Open in Azure Data Studio:**
   - Right-click on the database in the sidebar
   - Select **"New Query"**
   - Copy and paste the entire contents of `COMPLETE_DATABASE_SETUP.sql` into the query editor

### Step 3: Review the Script

**⚠️ IMPORTANT:** Before running, understand what the script does:

- **Drops existing tables** (if any) - This will delete all data!
- **Drops existing enums** (if any)
- **Creates all enums** (UserRole, BakongApp, Language, etc.)
- **Creates all tables** (user, bakong_user, template, etc.)
- **Creates foreign keys** (relationships between tables)
- **Creates indexes** (for performance)

**This script is designed for:**
<<<<<<< HEAD
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
- ✅ Fresh database setup
- ✅ Development environments
- ✅ Testing environments

**DO NOT use this script on production** without backing up data first!

### Step 4: Execute the Script

1. **Select the Database:**
   - In the query editor, make sure the correct database is selected in the dropdown at the top
   - The dropdown shows: `Server > Database`

2. **Run the Script:**
   - **Option A: Run Entire Script**
     - Press `F5` or click the **"Run"** button (▶️)
     - This executes the entire script at once
<<<<<<< HEAD
   
=======
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
   - **Option B: Run Selected Text**
     - Select a portion of the script
     - Press `F5` or click **"Run"**
     - Useful for running sections step-by-step

3. **Monitor Execution:**
   - Watch the **"Messages"** tab at the bottom for progress
   - You should see `RAISE NOTICE` messages showing each step
   - Look for `✅` success indicators

### Step 5: Verify the Setup

1. **Check Tables:**
<<<<<<< HEAD
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_type = 'BASE TABLE'
   ORDER BY table_name;
   ```
   
=======

   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_type = 'BASE TABLE'
   ORDER BY table_name;
   ```

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
   **Expected Tables:**
   - bakong_user
   - category_type
   - image
   - notification
   - template
   - template_translation
   - user
   - verification_token

2. **Check Enums:**
<<<<<<< HEAD
   ```sql
   SELECT typname as enum_name
   FROM pg_type 
=======

   ```sql
   SELECT typname as enum_name
   FROM pg_type
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
   WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
   AND typtype = 'e'
   ORDER BY typname;
   ```
<<<<<<< HEAD
   
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
   **Expected Enums:**
   - bakong_user_bakongplatform_enum
   - template_bakongplatform_enum
   - template_notificationtype_enum
   - template_sendtype_enum
   - template_translation_language_enum
   - user_role_enum

3. **Check Foreign Keys:**
<<<<<<< HEAD
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
   ```sql
   SELECT
       tc.table_name,
       tc.constraint_name,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
   AND tc.table_schema = 'public'
   ORDER BY tc.table_name, tc.constraint_name;
   ```

4. **Check Indexes:**
   ```sql
   SELECT
       tablename,
       indexname
   FROM pg_indexes
   WHERE schemaname = 'public'
   ORDER BY tablename, indexname;
   ```

## 🎯 Quick Verification Query

Run this single query to get a summary:

```sql
-- Quick verification summary
<<<<<<< HEAD
SELECT 
    'Tables' as type,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
=======
SELECT
    'Tables' as type,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
AND table_type = 'BASE TABLE'

UNION ALL

<<<<<<< HEAD
SELECT 
    'Enums' as type,
    COUNT(*) as count
FROM pg_type 
=======
SELECT
    'Enums' as type,
    COUNT(*) as count
FROM pg_type
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND typtype = 'e'

UNION ALL

<<<<<<< HEAD
SELECT 
=======
SELECT
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
    'Foreign Keys' as type,
    COUNT(*) as count
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
AND table_schema = 'public';
```

**Expected Results:**
<<<<<<< HEAD
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
- Tables: 8
- Enums: 6
- Foreign Keys: 6

## 🔧 Troubleshooting

### Error: "permission denied"

**Problem:** Your user doesn't have permission to create/drop tables.

**Solution:**
<<<<<<< HEAD
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
- Contact your database administrator
- Or run as a superuser (not recommended for production)

### Error: "relation already exists"

**Problem:** Tables or enums already exist.

**Solution:**
<<<<<<< HEAD
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
- The script should handle this with `DROP IF EXISTS`
- If you still get errors, manually drop conflicting objects first
- Or use a fresh database

### Error: "syntax error at or near..."

**Problem:** SQL syntax issue or PostgreSQL version incompatibility.

**Solution:**
<<<<<<< HEAD
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
- Ensure you're using PostgreSQL 12+ (recommended: 14+)
- Check that you copied the entire script correctly
- Verify no special characters were corrupted

### Error: "connection timeout"

**Problem:** Cannot connect to database server.

**Solution:**
<<<<<<< HEAD
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
- Verify server address and port
- Check network connectivity
- Ensure database server is running
- Verify firewall rules allow your connection

### Script Runs But No Tables Created

**Problem:** Script executed but tables are missing.

**Solution:**
<<<<<<< HEAD
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
- Check if you're connected to the correct database
- Look for error messages in the "Messages" tab
- Verify the script completed without errors
- Check if tables were created in a different schema

## 📝 Additional Notes

### For Production Environments

**⚠️ DO NOT run this script directly on production!**

Instead:
<<<<<<< HEAD
1. **Backup your database first:**
=======

1. **Backup your database first:**

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
   ```bash
   pg_dump -h <host> -U <user> -d <database> > backup.sql
   ```

2. **Use migration scripts** for incremental changes
3. **Test on staging** environment first
4. **Review changes** with your team before applying

### For Development

- Safe to run multiple times (idempotent with DROP IF EXISTS)
- Can be used to reset database to clean state
- Useful for testing and development

### Schema Changes

If you need to modify the schema after initial setup:
<<<<<<< HEAD
=======

>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
- Use migration scripts (see `apps/backend/scripts/` directory)
- Don't modify this setup script directly
- Create new migration scripts for changes

## 📚 Related Files

- `COMPLETE_DATABASE_SETUP.sql` - This setup script
- `add-flash-notification-limits.sql` - Migration for flash notification limits
- `Full_Setup_Database_Structure.sql` - Alternative migration script
- `README.md` - Database scripts documentation

## ✅ Success Checklist

After running the script, verify:

- [ ] All 8 tables exist
- [ ] All 6 enums exist
- [ ] All 6 foreign keys are created
- [ ] Indexes are created
- [ ] No error messages in output
- [ ] Can query tables successfully

## 🆘 Need Help?

If you encounter issues:

1. Check the **Messages** tab for detailed error information
2. Review the **Troubleshooting** section above
3. Verify your PostgreSQL version: `SELECT version();`
4. Check connection and permissions
5. Contact your team lead or database administrator

---

**Last Updated:** 2025-01-XX  
**Script Version:** 1.0  
**Compatible with:** PostgreSQL 12+, Azure Data Studio 1.40+
<<<<<<< HEAD

=======
>>>>>>> 19b672971341da41a8cf014849e5ecd0e00438f3
