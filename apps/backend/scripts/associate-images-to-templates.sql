-- ============================================
-- Script: Associate Images to Template Translations
-- ============================================
-- This script helps you manually associate images to template translations
-- It shows available images and templates, then provides UPDATE statements
--
-- Usage:
--   docker exec -i bakong-notification-services-db-sit psql -U bkns_sit -d bakong_notification_services_sit < apps/backend/scripts/associate-images-to-templates.sql
-- ============================================

-- Step 1: Show all available images
SELECT 
    'AVAILABLE_IMAGES' as section,
    i."fileId",
    i."originalFileName",
    i."mimeType",
    TO_CHAR(i."createdAt", 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM image i
ORDER BY i."createdAt" DESC;

-- Step 2: Show all template translations WITHOUT images
SELECT 
    'TEMPLATES_NEEDING_IMAGES' as section,
    tt.id as translation_id,
    tt."templateId",
    t."notificationType",
    tt.language,
    LEFT(tt.title, 60) as title_preview,
    CASE 
        WHEN tt."imageId" IS NULL OR tt."imageId" = '' THEN 'NO_IMAGE'
        ELSE 'HAS_IMAGE'
    END as image_status
FROM template_translation tt
LEFT JOIN template t ON t.id = tt."templateId"
WHERE tt."imageId" IS NULL OR tt."imageId" = ''
ORDER BY tt."templateId", tt.language;

-- Step 3: Generate UPDATE statements template
-- Copy and modify these statements to associate images to templates
-- Format: UPDATE template_translation SET "imageId" = 'fileId-here' WHERE id = translation_id;

DO $$
DECLARE
    rec RECORD;
    update_sql TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'GENERATED UPDATE STATEMENTS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Copy and modify these statements to associate images:';
    RAISE NOTICE '';
    
    FOR rec IN 
        SELECT 
            tt.id as translation_id,
            tt."templateId",
            tt.language,
            LEFT(tt.title, 40) as title
        FROM template_translation tt
        WHERE tt."imageId" IS NULL OR tt."imageId" = ''
        ORDER BY tt."templateId", tt.language
        LIMIT 20
    LOOP
        RAISE NOTICE '-- Template ID: %, Language: %, Title: %', 
            rec."templateId", rec.language, rec.title;
        RAISE NOTICE 'UPDATE template_translation SET "imageId" = ''REPLACE_WITH_FILEID'', "updatedAt" = NOW() WHERE id = %;', 
            rec.translation_id;
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'To use: Replace REPLACE_WITH_FILEID with actual fileId from image table';
    RAISE NOTICE '========================================';
END $$;

-- Step 4: Example - Associate first available image to first template without image
-- UNCOMMENT AND MODIFY THIS SECTION TO ACTUALLY RUN THE UPDATES
/*
-- Example: Associate an image to a specific template translation
-- Replace the values below with actual IDs

-- Get a fileId from image table
DO $$
DECLARE
    sample_fileId TEXT;
    sample_translation_id INTEGER;
BEGIN
    -- Get first available image
    SELECT "fileId" INTO sample_fileId 
    FROM image 
    ORDER BY "createdAt" DESC 
    LIMIT 1;
    
    -- Get first template translation without image
    SELECT id INTO sample_translation_id
    FROM template_translation
    WHERE ("imageId" IS NULL OR "imageId" = '')
    ORDER BY "templateId", language
    LIMIT 1;
    
    IF sample_fileId IS NOT NULL AND sample_translation_id IS NOT NULL THEN
        UPDATE template_translation
        SET "imageId" = sample_fileId,
            "updatedAt" = NOW()
        WHERE id = sample_translation_id;
        
        RAISE NOTICE '✅ Associated image % to translation %', sample_fileId, sample_translation_id;
    ELSE
        RAISE NOTICE '⚠️ No images or translations available for association';
    END IF;
END $$;
*/

-- Step 5: Show current associations after potential updates
SELECT 
    'CURRENT_ASSOCIATIONS' as section,
    COUNT(*) as total_with_images,
    COUNT(DISTINCT tt."templateId") as templates_with_images
FROM template_translation tt
WHERE tt."imageId" IS NOT NULL AND tt."imageId" != '';

