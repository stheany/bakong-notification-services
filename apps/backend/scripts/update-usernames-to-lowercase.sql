-- ============================================================================
-- Migration Script: Update Usernames to Lowercase and Remove Spaces
-- ============================================================================
-- This script updates all usernames in the "user" table to:
--   1. Convert to lowercase
--   2. Remove all spaces
-- 
-- Example: "So Theany" -> "sotheany"
-- 
-- It's safe to run multiple times (idempotent)
-- 
-- Usage:
--   psql -U <username> -d <database> -f apps/backend/scripts/update-usernames-to-lowercase.sql
-- 
-- Or via Docker:
--   docker exec -i <container-name> psql -U <username> -d <database> < apps/backend/scripts/update-usernames-to-lowercase.sql
-- ============================================================================

\echo '🔄 Starting username update migration...'
\echo ''

-- ============================================================================
-- Step 1: Show current usernames (for reference)
-- ============================================================================
\echo '📋 Current usernames:'
SELECT id, username, LOWER(REPLACE(username, ' ', '')) as new_username
FROM "user"
WHERE username != LOWER(REPLACE(username, ' ', ''))
ORDER BY id;

\echo ''
\echo '📊 Total usernames that will be updated:'
SELECT COUNT(*) as count_to_update
FROM "user"
WHERE username != LOWER(REPLACE(username, ' ', ''));

\echo ''
\echo '⚠️  About to update usernames. Press Ctrl+C to cancel, or wait 3 seconds...'
\echo ''

-- Wait a moment (optional - comment out if your psql doesn't support it)
-- SELECT pg_sleep(3);

-- ============================================================================
-- Step 2: Update usernames to lowercase and remove spaces
-- ============================================================================
\echo '🔄 Updating usernames...'

DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE "user"
    SET username = LOWER(REPLACE(username, ' ', ''))
    WHERE username != LOWER(REPLACE(username, ' ', ''));
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE '✅ Updated % username(s)', updated_count;
END$$;

\echo ''

-- ============================================================================
-- Step 3: Verify the update
-- ============================================================================
\echo '📊 Verification: Remaining usernames with uppercase or spaces:'
SELECT COUNT(*) as remaining_issues
FROM "user"
WHERE username != LOWER(REPLACE(username, ' ', ''));

\echo ''
\echo '📋 Updated usernames:'
SELECT id, username
FROM "user"
ORDER BY id;

\echo ''
\echo '✅ Username update migration completed!'
\echo ''
\echo '💡 Note: If you have any foreign key constraints or references to usernames,'
\echo '   you may need to update those as well.'
\echo ''

