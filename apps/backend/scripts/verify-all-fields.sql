-- ============================================================================
-- Verification Script: Check All Template Table Fields
-- ============================================================================
-- This script verifies that all required fields exist in the template table
-- Compares database schema with entity definition
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🔍 Verifying template table fields...';
    RAISE NOTICE '';
END$$;

-- List all columns in template table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name IN ('id', 'platforms', 'sendType', 'notificationType', 'categoryType', 
                             'priority', 'sendInterval', 'isSent', 'sendSchedule', 
                             'createdBy', 'updatedBy', 'publishedBy', 'bakongPlatform',
                             'showPerDay', 'maxDayShowing', 'createdAt', 'updatedAt', 'deletedAt') 
        THEN '✅ Required'
        ELSE '⚠️  Extra'
    END as status
FROM information_schema.columns 
WHERE table_name = 'template' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check each required field
DO $$
DECLARE
    missing_fields TEXT[] := ARRAY[]::TEXT[];
    field TEXT;
    required_fields TEXT[] := ARRAY[
        'id', 'platforms', 'sendType', 'notificationType', 'categoryTypeid',
        'priority', 'sendInterval', 'isSent', 'sendSchedule',
        'createdBy', 'updatedBy', 'publishedBy', 'bakongPlatform',
        'showPerDay', 'maxDayShowing', 'createdAt', 'updatedAt', 'deletedAt'
    ];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 Required Fields Checklist:';
    RAISE NOTICE '';
    
    FOREACH field IN ARRAY required_fields
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'template' 
            AND column_name = field
        ) THEN
            missing_fields := array_append(missing_fields, field);
        END IF;
    END LOOP;
    
    IF array_length(missing_fields, 1) IS NULL THEN
        RAISE NOTICE '✅ All required fields are present';
    ELSE
        RAISE NOTICE '❌ Missing fields: %', array_to_string(missing_fields, ', ');
    END IF;
END$$;

-- Field Type Verification
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 Field Type Verification:';
    RAISE NOTICE '';
END$$;

-- Check specific field types
SELECT 
    'sendInterval' as field_name,
    CASE 
        WHEN data_type = 'json' THEN '✅ Correct (JSON)'
        WHEN data_type = 'integer' THEN '⚠️  Wrong type (INTEGER, should be JSON)'
        ELSE '❌ Unknown type: ' || data_type
    END as status
FROM information_schema.columns 
WHERE table_name = 'template' AND column_name = 'sendInterval'

UNION ALL

SELECT 
    'showPerDay' as field_name,
    CASE 
        WHEN data_type = 'integer' THEN '✅ Correct (INTEGER)'
        ELSE '❌ Wrong type: ' || data_type
    END as status
FROM information_schema.columns 
WHERE table_name = 'template' AND column_name = 'showPerDay'

UNION ALL

SELECT 
    'maxDayShowing' as field_name,
    CASE 
        WHEN data_type = 'integer' THEN '✅ Correct (INTEGER)'
        ELSE '❌ Wrong type: ' || data_type
    END as status
FROM information_schema.columns 
WHERE table_name = 'template' AND column_name = 'maxDayShowing';

-- Summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Verification complete!';
    RAISE NOTICE '';
END$$;