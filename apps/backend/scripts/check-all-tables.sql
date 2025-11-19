-- ============================================
-- Script: Check All Database Tables
-- ============================================
-- This script checks all tables in the database:
-- - user
-- - bakong_user
-- - image
-- - template
-- - template_translation
-- - notification
--
-- Usage:
--   docker exec -i bakong-notification-services-db-sit psql -U bkns_sit -d bakong_notification_services_sit < apps/backend/scripts/check-all-tables.sql
-- ============================================

\echo ''
\echo '========================================'
\echo 'DATABASE SCHEMA CHECK - ALL TABLES'
\echo '========================================'
\echo ''

-- ============================================
-- 1. USER TABLE
-- ============================================
\echo '📋 Checking: user table'
\echo '----------------------------------------'

DO $$
DECLARE
    table_exists BOOLEAN;
    row_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT COUNT(*) INTO row_count FROM "user";
        RAISE NOTICE '✅ Table exists';
        RAISE NOTICE '   Row count: %', row_count;
    ELSE
        RAISE WARNING '❌ Table does not exist!';
    END IF;
END $$;

-- Show columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user'
ORDER BY ordinal_position;

-- Show constraints
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'user'
ORDER BY tc.constraint_type, tc.constraint_name;

\echo ''

-- ============================================
-- 2. BAKONG_USER TABLE
-- ============================================
\echo '📋 Checking: bakong_user table'
\echo '----------------------------------------'

DO $$
DECLARE
    table_exists BOOLEAN;
    row_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bakong_user'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT COUNT(*) INTO row_count FROM bakong_user;
        RAISE NOTICE '✅ Table exists';
        RAISE NOTICE '   Row count: %', row_count;
    ELSE
        RAISE WARNING '❌ Table does not exist!';
    END IF;
END $$;

-- Show columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'bakong_user'
ORDER BY ordinal_position;

-- Show indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'bakong_user'
ORDER BY indexname;

\echo ''

-- ============================================
-- 3. IMAGE TABLE
-- ============================================
\echo '📋 Checking: image table'
\echo '----------------------------------------'

DO $$
DECLARE
    table_exists BOOLEAN;
    row_count INTEGER;
    null_fileids INTEGER;
    fileid_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'image'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT COUNT(*) INTO row_count FROM image;
        SELECT COUNT(*) INTO null_fileids FROM image WHERE "fileId" IS NULL;
        SELECT data_type INTO fileid_type
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'image' 
          AND column_name = 'fileId';
        
        RAISE NOTICE '✅ Table exists';
        RAISE NOTICE '   Row count: %', row_count;
        RAISE NOTICE '   fileId type: %', COALESCE(fileid_type, 'NOT FOUND');
        RAISE NOTICE '   NULL fileIds: %', null_fileids;
        
        IF null_fileids = 0 AND fileid_type = 'character varying' THEN
            RAISE NOTICE '   ✅ Schema is correct!';
        ELSIF null_fileids > 0 THEN
            RAISE WARNING '   ⚠️ Found % NULL fileId values!', null_fileids;
        ELSIF fileid_type != 'character varying' THEN
            RAISE WARNING '   ⚠️ fileId type is % (expected VARCHAR)', fileid_type;
        END IF;
    ELSE
        RAISE WARNING '❌ Table does not exist!';
    END IF;
END $$;

-- Show columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'image'
ORDER BY ordinal_position;

-- Show constraints
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'image'
ORDER BY tc.constraint_type, tc.constraint_name;

\echo ''

-- ============================================
-- 4. TEMPLATE TABLE
-- ============================================
\echo '📋 Checking: template table'
\echo '----------------------------------------'

DO $$
DECLARE
    table_exists BOOLEAN;
    row_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'template'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT COUNT(*) INTO row_count FROM template;
        RAISE NOTICE '✅ Table exists';
        RAISE NOTICE '   Row count: %', row_count;
    ELSE
        RAISE WARNING '❌ Table does not exist!';
    END IF;
END $$;

-- Show columns
SELECT 
    column_name,
    data_type,
    udt_name,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'template'
ORDER BY ordinal_position;

-- Show constraints
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'template'
ORDER BY tc.constraint_type, tc.constraint_name;

\echo ''

-- ============================================
-- 5. TEMPLATE_TRANSLATION TABLE
-- ============================================
\echo '📋 Checking: template_translation table'
\echo '----------------------------------------'

DO $$
DECLARE
    table_exists BOOLEAN;
    row_count INTEGER;
    translations_with_images INTEGER;
    translations_without_images INTEGER;
    imageid_type TEXT;
    orphaned_refs INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'template_translation'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT COUNT(*) INTO row_count FROM template_translation;
        SELECT COUNT(*) INTO translations_with_images 
        FROM template_translation 
        WHERE "imageId" IS NOT NULL AND "imageId" != '';
        SELECT COUNT(*) INTO translations_without_images 
        FROM template_translation 
        WHERE "imageId" IS NULL OR "imageId" = '';
        SELECT data_type INTO imageid_type
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'template_translation' 
          AND column_name = 'imageId';
        SELECT COUNT(*) INTO orphaned_refs
        FROM template_translation tt
        WHERE tt."imageId" IS NOT NULL 
          AND tt."imageId" != ''
          AND NOT EXISTS (
              SELECT 1 FROM image i WHERE i."fileId" = tt."imageId"
          );
        
        RAISE NOTICE '✅ Table exists';
        RAISE NOTICE '   Row count: %', row_count;
        RAISE NOTICE '   imageId type: %', COALESCE(imageid_type, 'NOT FOUND');
        RAISE NOTICE '   Translations with images: %', translations_with_images;
        RAISE NOTICE '   Translations without images: %', translations_without_images;
        RAISE NOTICE '   Orphaned image references: %', orphaned_refs;
        
        IF imageid_type = 'character varying' THEN
            RAISE NOTICE '   ✅ imageId type is correct (VARCHAR)';
        ELSE
            RAISE WARNING '   ⚠️ imageId type is % (expected VARCHAR)', imageid_type;
        END IF;
        
        IF orphaned_refs > 0 THEN
            RAISE WARNING '   ⚠️ Found % orphaned image references!', orphaned_refs;
        END IF;
    ELSE
        RAISE WARNING '❌ Table does not exist!';
    END IF;
END $$;

-- Show columns
SELECT 
    column_name,
    data_type,
    udt_name,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'template_translation'
ORDER BY ordinal_position;

-- Show foreign keys
SELECT 
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
  AND tc.table_name = 'template_translation'
ORDER BY tc.constraint_name;

\echo ''

-- ============================================
-- 6. NOTIFICATION TABLE
-- ============================================
\echo '📋 Checking: notification table'
\echo '----------------------------------------'

DO $$
DECLARE
    table_exists BOOLEAN;
    row_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notification'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT COUNT(*) INTO row_count FROM notification;
        RAISE NOTICE '✅ Table exists';
        RAISE NOTICE '   Row count: %', row_count;
    ELSE
        RAISE WARNING '❌ Table does not exist!';
    END IF;
END $$;

-- Show columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'notification'
ORDER BY ordinal_position;

-- Show indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'notification'
ORDER BY indexname;

\echo ''

-- ============================================
-- SUMMARY
-- ============================================
\echo '========================================'
\echo 'SUMMARY'
\echo '========================================'

SELECT 
    'user' as table_name,
    COUNT(*) as row_count,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'user') as column_count
FROM "user"
UNION ALL
SELECT 
    'bakong_user',
    COUNT(*),
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'bakong_user')
FROM bakong_user
UNION ALL
SELECT 
    'image',
    COUNT(*),
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'image')
FROM image
UNION ALL
SELECT 
    'template',
    COUNT(*),
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'template')
FROM template
UNION ALL
SELECT 
    'template_translation',
    COUNT(*),
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'template_translation')
FROM template_translation
UNION ALL
SELECT 
    'notification',
    COUNT(*),
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'notification')
FROM notification
ORDER BY table_name;

\echo ''
\echo '========================================'
\echo 'CHECK COMPLETE'
\echo '========================================'
\echo ''

