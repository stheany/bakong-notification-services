-- ============================================
-- Migration Script: Fix NULL fileId values
-- ============================================
-- This script populates NULL fileId values in the image table with UUIDs
-- Run this BEFORE TypeORM synchronize to prevent migration errors
--
-- Usage:
--   psql -U <username> -d <database> -f scripts/fix-null-fileid.sql
--   or in Docker:
--   docker exec -i <container> psql -U <username> -d <database> < scripts/fix-null-fileid.sql
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Check and report NULL fileId count
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM image WHERE "fileId" IS NULL;
    
    IF null_count = 0 THEN
        RAISE NOTICE 'No rows with NULL fileId found. Migration not needed.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found % row(s) with NULL fileId. Starting migration...', null_count;
END $$;

-- Update all NULL fileId values with UUIDs
-- Using gen_random_uuid() from pgcrypto extension (faster than uuid-ossp)
UPDATE image
SET "fileId" = gen_random_uuid()::text
WHERE "fileId" IS NULL;

-- Verify all NULL values are fixed
DO $$
DECLARE
    remaining_nulls INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_nulls FROM image WHERE "fileId" IS NULL;
    
    IF remaining_nulls = 0 THEN
        RAISE NOTICE '✅ All NULL fileId values have been fixed!';
        RAISE NOTICE '✅ Database is ready for TypeORM synchronize';
    ELSE
        RAISE WARNING '❌ Warning: % row(s) still have NULL fileId', remaining_nulls;
    END IF;
END $$;

-- Show summary
SELECT 
    COUNT(*) as total_rows,
    COUNT(CASE WHEN "fileId" IS NULL THEN 1 END) as null_fileid_count,
    COUNT(CASE WHEN "fileId" IS NOT NULL THEN 1 END) as valid_fileid_count
FROM image;

