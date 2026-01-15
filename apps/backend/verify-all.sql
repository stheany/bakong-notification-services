\echo '🔍 VERIFY ALL TABLES/COLUMNS'

-- 1) Table exist
SELECT
  to_regclass('public.category_type')       AS category_type,
  to_regclass('public.bakong_user')         AS bakong_user,
  to_regclass('public.image')               AS image,
  to_regclass('public.notification')        AS notification,
  to_regclass('public.template')            AS template,
  to_regclass('public.template_translation') AS template_translation,
  to_regclass('public."user"')              AS app_user;

\echo '--- Missing columns (if any) ---'

-- category_type required columns
WITH req AS (
  SELECT 'category_type'::text AS t, unnest(ARRAY[
    'id','name','namekh','namejp','icon','mimeType','originalFileName',
    'createdAt','updatedAt','deletedAt'
  ]) AS c
)
SELECT t AS table_name, c AS missing_column
FROM req
LEFT JOIN information_schema.columns col
  ON col.table_schema='public'
 AND col.table_name=req.t
 AND col.column_name=req.c
WHERE col.column_name IS NULL
ORDER BY 1,2;

-- bakong_user required columns
WITH req AS (
  SELECT 'bakong_user'::text AS t, unnest(ARRAY[
    'id','accountId','fcmToken','participantCode','platform','bakongPlatform','language',
    'createdAt','updatedAt','syncStatus'
  ]) AS c
)
SELECT t AS table_name, c AS missing_column
FROM req
LEFT JOIN information_schema.columns col
  ON col.table_schema='public'
 AND col.table_name=req.t
 AND col.column_name=req.c
WHERE col.column_name IS NULL
ORDER BY 1,2;

-- image required columns
WITH req AS (
  SELECT 'image'::text AS t, unnest(ARRAY[
    'id','fileId','file','mimeType','originalFileName','createdAt','fileHash'
  ]) AS c
)
SELECT t AS table_name, c AS missing_column
FROM req
LEFT JOIN information_schema.columns col
  ON col.table_schema='public'
 AND col.table_name=req.t
 AND col.column_name=req.c
WHERE col.column_name IS NULL
ORDER BY 1,2;

-- notification required columns
WITH req AS (
  SELECT 'notification'::text AS t, unnest(ARRAY[
    'id','accountId','fcmToken','templateId','createdAt','firebaseMessageId','sendCount'
  ]) AS c
)
SELECT t AS table_name, c AS missing_column
FROM req
LEFT JOIN information_schema.columns col
  ON col.table_schema='public'
 AND col.table_name=req.t
 AND col.column_name=req.c
WHERE col.column_name IS NULL
ORDER BY 1,2;

-- template required columns
WITH req AS (
  SELECT 'template'::text AS t, unnest(ARRAY[
    'id','platforms','bakongPlatform','sendType','notificationType','categoryType','priority',
    'sendInterval','isSent','sendSchedule','createdBy','updatedBy','publishedBy',
    'createdAt','updatedAt','deletedAt','categoryTypeId','showPerDay','maxDayShowing','accountId'
  ]) AS c
)
SELECT t AS table_name, c AS missing_column
FROM req
LEFT JOIN information_schema.columns col
  ON col.table_schema='public'
 AND col.table_name=req.t
 AND col.column_name=req.c
WHERE col.column_name IS NULL
ORDER BY 1,2;

-- template_translation required columns
WITH req AS (
  SELECT 'template_translation'::text AS t, unnest(ARRAY[
    'id','templateId','language','title','content','imageId','createdAt','updatedAt','linkPreview'
  ]) AS c
)
SELECT t AS table_name, c AS missing_column
FROM req
LEFT JOIN information_schema.columns col
  ON col.table_schema='public'
 AND col.table_name=req.t
 AND col.column_name=req.c
WHERE col.column_name IS NULL
ORDER BY 1,2;

-- user required columns
WITH req AS (
  SELECT 'user'::text AS t, unnest(ARRAY[
    'id','username','password','displayName','role','failLoginAttempt',
    'createdAt','updatedAt','deletedAt','imageId'
  ]) AS c
)
SELECT t AS table_name, c AS missing_column
FROM req
LEFT JOIN information_schema.columns col
  ON col.table_schema='public'
 AND col.table_name=req.t
 AND col.column_name=req.c
WHERE col.column_name IS NULL
ORDER BY 1,2;

\echo '--- Quick counts ---'
SELECT 'category_type' AS table, COUNT(*) FROM public.category_type
UNION ALL SELECT 'bakong_user', COUNT(*) FROM public.bakong_user
UNION ALL SELECT 'template', COUNT(*) FROM public.template
UNION ALL SELECT 'template_translation', COUNT(*) FROM public.template_translation
UNION ALL SELECT 'notification', COUNT(*) FROM public.notification;

\echo '✅ VERIFY DONE'
