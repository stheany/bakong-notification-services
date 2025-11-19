-- ============================================
-- Manual Image Association Script
-- ============================================
-- Use this script to manually associate a specific image to a specific template translation
--
-- Usage:
--   1. Replace TRANSLATION_ID with the actual translation ID
--   2. Replace FILE_ID with the actual fileId from image table
--   3. Run: docker exec -i bakong-notification-services-db-sit psql -U bkns_sit -d bakong_notification_services_sit < apps/backend/scripts/manual-associate-image.sql
-- ============================================

-- Example: Associate image to template translation
-- MODIFY THESE VALUES:
\set TRANSLATION_ID 33  -- Change this to your translation ID
\set FILE_ID '931fc61c-ed0b-461a-aef2-866e15f2dd61'  -- Change this to your fileId

-- Verify the image exists
DO $$
DECLARE
    image_exists BOOLEAN;
    translation_exists BOOLEAN;
    current_imageId TEXT;
BEGIN
    -- Check if image exists
    SELECT EXISTS(SELECT 1 FROM image WHERE "fileId" = :'FILE_ID') INTO image_exists;
    
    -- Check if translation exists
    SELECT EXISTS(SELECT 1 FROM template_translation WHERE id = :TRANSLATION_ID) INTO translation_exists;
    
    -- Get current imageId
    SELECT "imageId" INTO current_imageId 
    FROM template_translation 
    WHERE id = :TRANSLATION_ID;
    
    IF NOT image_exists THEN
        RAISE EXCEPTION 'Image with fileId % does not exist', :'FILE_ID';
    END IF;
    
    IF NOT translation_exists THEN
        RAISE EXCEPTION 'Translation with id % does not exist', :TRANSLATION_ID;
    END IF;
    
    -- Update the association
    UPDATE template_translation
    SET "imageId" = :'FILE_ID',
        "updatedAt" = NOW()
    WHERE id = :TRANSLATION_ID;
    
    RAISE NOTICE '✅ Successfully associated image % to translation %', :'FILE_ID', :TRANSLATION_ID;
    
    IF current_imageId IS NOT NULL THEN
        RAISE NOTICE '⚠️ Previous imageId was: %', current_imageId;
    END IF;
END $$;

-- Verify the update
SELECT 
    tt.id as translation_id,
    tt."templateId",
    tt.language,
    tt."imageId",
    i."originalFileName",
    i."mimeType",
    LEFT(tt.title, 50) as title
FROM template_translation tt
LEFT JOIN image i ON i."fileId" = tt."imageId"
WHERE tt.id = :TRANSLATION_ID;

