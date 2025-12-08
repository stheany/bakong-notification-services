-- ============================================================================
-- COMPLETE DATABASE SETUP SCRIPT
-- Bakong Notification Services - Full Database Structure
-- ============================================================================
-- This script creates the complete database structure from scratch.
-- It includes all tables, enums, foreign keys, and constraints.
--
-- ⚠️ IMPORTANT: This script will DROP existing tables if they exist.
-- Use this for fresh database setup or development environments.
-- For production, use migration scripts instead.
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP EXISTING TABLES (if any) - CASCADE to handle dependencies
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '🗑️  Step 1: Dropping existing tables (if any)...';
END$$;

DROP TABLE IF EXISTS "verification_token" CASCADE;
DROP TABLE IF EXISTS "notification" CASCADE;
DROP TABLE IF EXISTS "template_translation" CASCADE;
DROP TABLE IF EXISTS "template" CASCADE;
DROP TABLE IF EXISTS "category_type" CASCADE;
DROP TABLE IF EXISTS "image" CASCADE;
DROP TABLE IF EXISTS "bakong_user" CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- ============================================================================
-- STEP 2: DROP EXISTING ENUMS (if any)
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '🗑️  Step 2: Dropping existing enums (if any)...';
END$$;

DROP TYPE IF EXISTS "user_role_enum" CASCADE;
DROP TYPE IF EXISTS "bakong_user_bakongplatform_enum" CASCADE;
DROP TYPE IF EXISTS "template_translation_language_enum" CASCADE;
DROP TYPE IF EXISTS "template_bakongplatform_enum" CASCADE;
DROP TYPE IF EXISTS "template_sendtype_enum" CASCADE;
DROP TYPE IF EXISTS "template_notificationtype_enum" CASCADE;

-- ============================================================================
-- STEP 3: CREATE ENUMS
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '📋 Step 3: Creating enums...';
END$$;

-- User Role Enum
CREATE TYPE "user_role_enum" AS ENUM (
    'ADMIN_USER',
    'NORMAL_USER',
    'API_USER'
);

-- Bakong App Enum (for bakong_user table)
CREATE TYPE "bakong_user_bakongplatform_enum" AS ENUM (
    'BAKONG',
    'BAKONG_TOURIST',
    'BAKONG_JUNIOR'
);

-- Language Enum (for template_translation table)
CREATE TYPE "template_translation_language_enum" AS ENUM (
    'EN',
    'KM',
    'JP'
);

-- Bakong Platform Enum (for template table)
CREATE TYPE "template_bakongplatform_enum" AS ENUM (
    'BAKONG',
    'BAKONG_TOURIST',
    'BAKONG_JUNIOR'
);

-- Send Type Enum (for template table)
CREATE TYPE "template_sendtype_enum" AS ENUM (
    'SEND_NOW',
    'SEND_SCHEDULE',
    'SEND_INTERVAL'
);

-- Notification Type Enum (for template table)
CREATE TYPE "template_notificationtype_enum" AS ENUM (
    'FLASH_NOTIFICATION',
    'ANNOUNCEMENT',
    'NOTIFICATION'
);

DO $$
BEGIN
    RAISE NOTICE '✅ All enums created successfully';
END$$;

-- ============================================================================
-- STEP 4: CREATE TABLES
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '📊 Step 4: Creating tables...';
END$$;

-- ----------------------------------------------------------------------------
-- Table: user
-- ----------------------------------------------------------------------------
CREATE TABLE "user" (
    "id" SERIAL PRIMARY KEY,
    "username" VARCHAR(255) NOT NULL UNIQUE,
    "password" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "failLoginAttempt" INTEGER NOT NULL DEFAULT 0,
    "role" "user_role_enum" NOT NULL DEFAULT 'NORMAL_USER',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "deletedAt" TIMESTAMP NULL
);

-- ----------------------------------------------------------------------------
-- Table: bakong_user
-- ----------------------------------------------------------------------------
CREATE TABLE "bakong_user" (
    "id" BIGSERIAL PRIMARY KEY,
    "accountId" VARCHAR(32) NOT NULL UNIQUE,
    "fcmToken" VARCHAR(255) NOT NULL,
    "bakongPlatform" "bakong_user_bakongplatform_enum" NULL,
    "platform" VARCHAR(32) NULL,
    "participantCode" VARCHAR(32) NULL,
    "language" VARCHAR(2) NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Table: image
-- ----------------------------------------------------------------------------
CREATE TABLE "image" (
    "id" BIGSERIAL PRIMARY KEY,
    "fileId" VARCHAR(255) NOT NULL UNIQUE,
    "file" BYTEA NOT NULL,
    "originalFileName" VARCHAR(255) NULL,
    "mimeType" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Table: category_type
-- ----------------------------------------------------------------------------
CREATE TABLE "category_type" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL UNIQUE,
    "icon" BYTEA NOT NULL,
    "mimeType" VARCHAR(255) NULL,
    "originalFileName" VARCHAR(255) NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NULL,
    "deletedAt" TIMESTAMP NULL
);

-- ----------------------------------------------------------------------------
-- Table: template
-- ----------------------------------------------------------------------------
CREATE TABLE "template" (
    "id" SERIAL PRIMARY KEY,
    "bakongPlatform" "template_bakongplatform_enum" NULL,
    "sendType" "template_sendtype_enum" NOT NULL DEFAULT 'SEND_SCHEDULE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isSent" BOOLEAN NOT NULL DEFAULT FALSE,
    "sendSchedule" TIMESTAMPTZ NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "deletedAt" TIMESTAMPTZ NULL,
    "platforms" TEXT[] NULL,
    "notificationType" "template_notificationtype_enum" NOT NULL DEFAULT 'FLASH_NOTIFICATION',
    "sendInterval" JSON NULL,
    "createdBy" VARCHAR(255) NULL,
    "updatedBy" VARCHAR(255) NULL,
    "publishedBy" VARCHAR(255) NULL,
    "categoryTypeId" INTEGER NULL,
    "showPerDay" INTEGER NOT NULL DEFAULT 1,
    "maxDayShowing" INTEGER NOT NULL DEFAULT 1
);

-- ----------------------------------------------------------------------------
-- Table: template_translation
-- ----------------------------------------------------------------------------
CREATE TABLE "template_translation" (
    "id" SERIAL PRIMARY KEY,
    "templateId" INTEGER NOT NULL,
    "language" "template_translation_language_enum" NOT NULL,
    "title" VARCHAR(1024) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "imageId" VARCHAR(255) NULL,
    "linkPreview" TEXT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Table: notification
-- ----------------------------------------------------------------------------
CREATE TABLE "notification" (
    "id" BIGSERIAL PRIMARY KEY,
    "accountId" VARCHAR(32) NOT NULL,
    "fcmToken" VARCHAR(255) NOT NULL,
    "templateId" INTEGER NOT NULL,
    "firebaseMessageId" BIGINT NULL,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Table: verification_token
-- ----------------------------------------------------------------------------
CREATE TABLE "verification_token" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "token" VARCHAR(255) NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    RAISE NOTICE '✅ All tables created successfully';
END$$;

-- ============================================================================
-- STEP 5: CREATE FOREIGN KEYS
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '🔗 Step 5: Creating foreign keys...';
END$$;

-- template.categoryTypeId → category_type.id
ALTER TABLE "template"
ADD CONSTRAINT "fk_template_category_type"
FOREIGN KEY ("categoryTypeId")
REFERENCES "category_type"("id")
ON DELETE SET NULL;

-- template_translation.templateId → template.id
ALTER TABLE "template_translation"
ADD CONSTRAINT "fk_translation_template"
FOREIGN KEY ("templateId")
REFERENCES "template"("id")
ON DELETE CASCADE;

-- template_translation.imageId → image.fileId
ALTER TABLE "template_translation"
ADD CONSTRAINT "fk_translation_image"
FOREIGN KEY ("imageId")
REFERENCES "image"("fileId")
ON DELETE SET NULL;

-- notification.templateId → template.id
ALTER TABLE "notification"
ADD CONSTRAINT "fk_notification_template"
FOREIGN KEY ("templateId")
REFERENCES "template"("id")
ON DELETE CASCADE;

-- notification.accountId → bakong_user.accountId
ALTER TABLE "notification"
ADD CONSTRAINT "fk_notification_bakong"
FOREIGN KEY ("accountId")
REFERENCES "bakong_user"("accountId")
ON DELETE CASCADE;

-- verification_token.userId → user.id
ALTER TABLE "verification_token"
ADD CONSTRAINT "fk_verification_token_user"
FOREIGN KEY ("userId")
REFERENCES "user"("id")
ON DELETE CASCADE;

DO $$
BEGIN
    RAISE NOTICE '✅ All foreign keys created successfully';
END$$;

-- ============================================================================
-- STEP 6: CREATE INDEXES (for performance)
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '📇 Step 6: Creating indexes...';
END$$;

-- Indexes for foreign keys
CREATE INDEX IF NOT EXISTS "idx_template_category_type_id" ON "template"("categoryTypeId");
CREATE INDEX IF NOT EXISTS "idx_template_translation_template_id" ON "template_translation"("templateId");
CREATE INDEX IF NOT EXISTS "idx_template_translation_image_id" ON "template_translation"("imageId");
CREATE INDEX IF NOT EXISTS "idx_notification_template_id" ON "notification"("templateId");
CREATE INDEX IF NOT EXISTS "idx_notification_account_id" ON "notification"("accountId");
CREATE INDEX IF NOT EXISTS "idx_verification_token_user_id" ON "verification_token"("userId");

-- Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS "idx_template_send_schedule" ON "template"("sendSchedule") WHERE "sendSchedule" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_template_is_sent" ON "template"("isSent");
CREATE INDEX IF NOT EXISTS "idx_template_deleted_at" ON "template"("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_user_deleted_at" ON "user"("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_category_type_deleted_at" ON "category_type"("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_verification_token_expires_at" ON "verification_token"("expiresAt");
CREATE INDEX IF NOT EXISTS "idx_verification_token_used" ON "verification_token"("used");

DO $$
BEGIN
    RAISE NOTICE '✅ All indexes created successfully';
END$$;

-- ============================================================================
-- STEP 7: VERIFICATION
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Database setup completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Verification Summary:';
    RAISE NOTICE '   - All enums created';
    RAISE NOTICE '   - All tables created';
    RAISE NOTICE '   - All foreign keys created';
    RAISE NOTICE '   - All indexes created';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Database is ready to use!';
    RAISE NOTICE '';
END$$;

-- Display table count
SELECT 
    COUNT(*) as total_tables,
    'Tables created' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- Display enum count
SELECT 
    COUNT(*) as total_enums,
    'Enums created' as status
FROM pg_type 
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND typtype = 'e';

