-- Add missing columns to template table
-- Run this script to fix the schema mismatch

ALTER TABLE template 
ADD COLUMN IF NOT EXISTS "createdBy" VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS "updatedBy" VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS "publishedBy" VARCHAR(255) NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'template' 
AND column_name IN ('createdBy', 'updatedBy', 'publishedBy');

