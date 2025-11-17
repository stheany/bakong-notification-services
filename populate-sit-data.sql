-- SQL script to populate SIT database with data from website API response
-- This script inserts templates, template_translations, and ensures admin user exists

-- Step 1: Ensure admin user exists
INSERT INTO public."user" (username, password, "displayName", role, "failLoginAttempt", "createdAt", "updatedAt", "deletedAt") 
VALUES (
    'admin',
    '$2b$10$ko6nN/cHAelEXBGu2lt6guCQt.rP.S6LDSMPlep9yTh/doZjABtn6', -- password: admin123
    'Admin',
    'ADMIN_USER',
    0,
    NOW(),
    NOW(),
    NULL
)
ON CONFLICT (username) DO NOTHING;

-- Step 2: Delete existing template translations for these templates (to avoid duplicates)
DELETE FROM public.template_translation WHERE "templateId" IN (9, 22, 23, 24, 30, 31, 32, 33);

-- Step 2.5: Create placeholder image records (if they don't exist) - MUST BE BEFORE template_translations
-- Note: These are placeholder records without actual image data
INSERT INTO public.image ("fileId", file, "mimeType", "originalFileName", "createdAt")
VALUES 
    ('b387edad-bcc3-4d05-b486-c52a69298d2d', NULL, 'image/jpeg', 'image.jpg', NOW()),
    ('20cd4a3e-ce70-4709-a30d-ff82f5f80eb7', NULL, 'image/jpeg', 'image.jpg', NOW()),
    ('3e8c0c90-ac35-4c2f-9026-1630e598ca5d', NULL, 'image/jpeg', 'image.jpg', NOW()),
    ('1eb2250c-bdb4-46d8-a08e-37a006d5180f', NULL, 'image/jpeg', 'image.jpg', NOW()),
    ('c5dc2bf5-d6f9-4c40-bf29-a762648d606f', NULL, 'image/jpeg', 'image.jpg', NOW()),
    ('931fc61c-ed0b-461a-aef2-866e15f2dd61', NULL, 'image/jpeg', 'image.jpg', NOW())
ON CONFLICT ("fileId") DO NOTHING;

-- Step 3: Insert templates
-- Template ID 33
INSERT INTO public.template (
    id, platforms, "sendType", "notificationType", "categoryType", priority, 
    "isSent", "sendSchedule", "createdAt", "updatedAt", "deletedAt"
) VALUES (
    33,
    '["ALL"]',
    'SEND_NOW'::send_type_enum,
    'NOTIFICATION',
    'NEWS',
    1,
    true,
    NULL,
    '2025-11-17T03:18:01.986Z'::timestamptz,
    '2025-11-17T03:18:01.986Z'::timestamptz,
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    platforms = EXCLUDED.platforms,
    "sendType" = EXCLUDED."sendType",
    "notificationType" = EXCLUDED."notificationType",
    "isSent" = EXCLUDED."isSent",
    "updatedAt" = EXCLUDED."updatedAt";

-- Template ID 30
INSERT INTO public.template (
    id, platforms, "sendType", "notificationType", "categoryType", priority, 
    "isSent", "sendSchedule", "createdAt", "updatedAt", "deletedAt"
) VALUES (
    30,
    '["ALL"]',
    'SEND_SCHEDULE'::send_type_enum,
    'NOTIFICATION',
    'NEWS',
    1,
    false,
    '2025-11-13 09:30:00'::timestamptz,
    '2025-11-12T07:04:08.206Z'::timestamptz,
    '2025-11-12T07:04:08.206Z'::timestamptz,
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    platforms = EXCLUDED.platforms,
    "sendType" = EXCLUDED."sendType",
    "notificationType" = EXCLUDED."notificationType",
    "isSent" = EXCLUDED."isSent",
    "sendSchedule" = EXCLUDED."sendSchedule",
    "updatedAt" = EXCLUDED."updatedAt";

-- Template ID 23
INSERT INTO public.template (
    id, platforms, "sendType", "notificationType", "categoryType", priority, 
    "isSent", "sendSchedule", "createdAt", "updatedAt", "deletedAt"
) VALUES (
    23,
    '["ALL"]',
    'SEND_NOW'::send_type_enum,
    'NOTIFICATION',
    'NEWS',
    1,
    false,
    NULL,
    '2025-11-12T02:34:30.060Z'::timestamptz,
    '2025-11-12T02:34:30.060Z'::timestamptz,
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    platforms = EXCLUDED.platforms,
    "sendType" = EXCLUDED."sendType",
    "notificationType" = EXCLUDED."notificationType",
    "isSent" = EXCLUDED."isSent",
    "updatedAt" = EXCLUDED."updatedAt";

-- Template ID 32
INSERT INTO public.template (
    id, platforms, "sendType", "notificationType", "categoryType", priority, 
    "isSent", "sendSchedule", "createdAt", "updatedAt", "deletedAt"
) VALUES (
    32,
    '["ALL"]',
    'SEND_NOW'::send_type_enum,
    'NOTIFICATION',
    'NEWS',
    1,
    false,
    NULL,
    '2025-11-12T07:10:07.763Z'::timestamptz,
    '2025-11-12T07:10:07.763Z'::timestamptz,
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    platforms = EXCLUDED.platforms,
    "sendType" = EXCLUDED."sendType",
    "notificationType" = EXCLUDED."notificationType",
    "isSent" = EXCLUDED."isSent",
    "updatedAt" = EXCLUDED."updatedAt";

-- Template ID 31
INSERT INTO public.template (
    id, platforms, "sendType", "notificationType", "categoryType", priority, 
    "isSent", "sendSchedule", "createdAt", "updatedAt", "deletedAt"
) VALUES (
    31,
    '["ALL"]',
    'SEND_NOW'::send_type_enum,
    'ANNOUNCEMENT',
    'NEWS',
    1,
    true,
    NULL,
    '2025-11-12T07:07:25.685Z'::timestamptz,
    '2025-11-12T07:07:25.685Z'::timestamptz,
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    platforms = EXCLUDED.platforms,
    "sendType" = EXCLUDED."sendType",
    "notificationType" = EXCLUDED."notificationType",
    "isSent" = EXCLUDED."isSent",
    "updatedAt" = EXCLUDED."updatedAt";

-- Template ID 24
INSERT INTO public.template (
    id, platforms, "sendType", "notificationType", "categoryType", priority, 
    "isSent", "sendSchedule", "createdAt", "updatedAt", "deletedAt"
) VALUES (
    24,
    '["ALL"]',
    'SEND_NOW'::send_type_enum,
    'NOTIFICATION',
    'NEWS',
    1,
    true,
    NULL,
    '2025-11-12T02:37:44.595Z'::timestamptz,
    '2025-11-12T02:37:44.595Z'::timestamptz,
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    platforms = EXCLUDED.platforms,
    "sendType" = EXCLUDED."sendType",
    "notificationType" = EXCLUDED."notificationType",
    "isSent" = EXCLUDED."isSent",
    "updatedAt" = EXCLUDED."updatedAt";

-- Template ID 22
INSERT INTO public.template (
    id, platforms, "sendType", "notificationType", "categoryType", priority, 
    "isSent", "sendSchedule", "createdAt", "updatedAt", "deletedAt"
) VALUES (
    22,
    '["ALL"]',
    'SEND_SCHEDULE'::send_type_enum,
    'ANNOUNCEMENT',
    'NEWS',
    1,
    true,
    '2025-11-12 09:35:00'::timestamptz,
    '2025-11-12T02:33:57.310Z'::timestamptz,
    '2025-11-12T02:33:57.310Z'::timestamptz,
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    platforms = EXCLUDED.platforms,
    "sendType" = EXCLUDED."sendType",
    "notificationType" = EXCLUDED."notificationType",
    "isSent" = EXCLUDED."isSent",
    "sendSchedule" = EXCLUDED."sendSchedule",
    "updatedAt" = EXCLUDED."updatedAt";

-- Template ID 9
INSERT INTO public.template (
    id, platforms, "sendType", "notificationType", "categoryType", priority, 
    "isSent", "sendSchedule", "createdAt", "updatedAt", "deletedAt"
) VALUES (
    9,
    '["ALL"]',
    'SEND_NOW'::send_type_enum,
    'NOTIFICATION',
    'NEWS',
    1,
    true,
    NULL,
    '2025-11-07T08:05:42.252Z'::timestamptz,
    '2025-11-07T08:05:42.252Z'::timestamptz,
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    platforms = EXCLUDED.platforms,
    "sendType" = EXCLUDED."sendType",
    "notificationType" = EXCLUDED."notificationType",
    "isSent" = EXCLUDED."isSent",
    "updatedAt" = EXCLUDED."updatedAt";

-- Step 4: Insert template translations
-- Template 33 translation
INSERT INTO public.template_translation (
    "templateId", language, title, content, "imageId", "linkPreview", "createdAt", "updatedAt"
) VALUES (
    33,
    'KM'::language_enum,
    'tetst',
    'etst',
    NULL,
    NULL,
    '2025-11-17T03:18:01.986Z'::timestamptz,
    '2025-11-17T03:18:01.986Z'::timestamptz
)
;

-- Template 30 translation
INSERT INTO public.template_translation (
    "templateId", language, title, content, "imageId", "linkPreview", "createdAt", "updatedAt"
) VALUES (
    30,
    'KM'::language_enum,
    'លោកជំទាវបណ្ឌិត ជា សិរី ទេសាភិបាល ធនាគារជាតិនៃកម្ពុជា អញ្ជើញចូលរួមជាវាគ្មិនក្នុងកិច្ចពិភាក្សានៃកិច្ចប្រជុំកំពូលធុរកិច្ច និងវិនិយោគអាស៊ាន ឆ្នាំ២០២៥ (ABIS) ក្រោមប្រធានបទ "បង្កើនអំណាចដល់សហគ្រាសធុនមីក្រូ តូច និងមធ្យម (MSMEs) ក្នុងតំបន់អាស៊ាន ដើម្បីជំរុញការរីកចម្រើនក្នុងសេដ្ឋកិច្ចឌីជីថល"',
    'លោកជំទាវបណ្ឌិត ជា សិរី ទេសាភិបាល ធនាគារជាតិនៃកម្ពុជា អញ្ជើញចូលរួមជាវាគ្មិនក្នុងកិច្ចពិភាក្សានៃកិច្ចប្រជុំកំពូលធុរកិច្ច និងវិនិយោគអាស៊ាន ឆ្នាំ២០២៥ (ABIS) ក្រោមប្រធានបទ "បង្កើនអំណាចដល់សហគ្រាសធុនមីក្រូ តូច និងមធ្យម (MSMEs) ក្នុងតំបន់អាស៊ាន ដើម្បីជំរុញការរីកចម្រើនក្នុងសេដ្ឋកិច្ចឌីជីថល" នារសៀលថ្ងៃទី២៦ ខែតុលា ឆ្នាំ២០២៥ នៅទីក្រុងកូឡាឡាំពួ ប្រទេសម៉ាឡេស៊ី។

វេទិកានេះមានការចូលរួមពីវាគ្មិនជំនាញដែលសុទ្ធសឹងជាថ្នាក់ដឹកនាំជាន់ខ្ពស់នៃក្រុមហ៊ុនបច្ចេកវិទ្យាធំៗលំដាប់ពិភពលោក ដូចជា Google និង TikTok ជាដើម ដោយបានផ្តោតលើកិច្ចពិភាក្សាអំពីដំណោះស្រាយចំពោះឧបសគ្គរបស់ MSMEs ក្នុងសេដ្ឋកិច្ចឌីជីថល កិច្ចសហប្រតិបត្តិការតំបន់ និងតួនាទីរបស់ស្ថាប័នហិរញ្ញវត្ថុ និងបច្ចេកវិទ្យា ក្នុងការបង្កើនអំណាចដល់ MSMEs ក្នុងតំបន់អាស៊ាន ដើម្បីជំរុញការរីកចម្រើនក្នុងសេដ្ឋកិច្ចឌីជីថល។

នាឱកាសនេះ លោកជំទាវ បានមានប្រសាសន៍ពីវឌ្ឍនភាពប្រព័ន្ធបច្ចេកវិទ្យាហិរញ្ញវត្ថុកម្ពុជា ជាពិសេសដំណើររៀបចំប្រព័ន្ធទូទាត់បាគង និងបទពិសោធជោគជ័យដែលប្រតិបត្តិការប្រព័ន្ធបាគងបានជំរុញការរីកចម្រើនរបស់សហគ្រាសធុនតូចនិងមធ្យមនៅកម្ពុជា។ លោកជំទាវក៏បានសង្កត់ធ្ងន់ពីសារៈសំខាន់នៃការតភ្ជាប់ប្រព័ន្ធទូទាត់ក្នុងតំបន់ ដើម្បីឱ្យសហគ្រាសអាចធ្វើពាណិជ្ជកម្មយ៉ាងទូលំទូលាយ សំដៅកាត់បន្ថយគម្លាតឌីជីថលក្នុងតំបន់ និងលើកកម្ពស់បរិយាបន្នហិរញ្ញវត្ថុ។

គួររំលេចថា កិច្ចប្រជុំកំពូលធុរកិច្ច និងវិនិយោគអាស៊ាន គឺជាវេទិកាថ្នាក់តំបន់ប្រចាំឆ្នាំ ដែលត្រូវបានរៀបចំអមកិច្ចប្រជុំកំពូលអាស៊ាន និងកិច្ចប្រជុំពាក់ព័ន្ធ ដោយមានវត្តមានចូលរួមពីប្រធានាធិបតី នាយករដ្ឋមន្ត្រី ថ្នាក់ដឹកនាំធុរកិច្ច សហគ្រិន ដែលមកពីទូទាំងតំបន់អាស៊ាន និងប្រទេសជាដៃគូនានាជុំវិញពិភពលោក។',
    'b387edad-bcc3-4d05-b486-c52a69298d2d',
    'https://www.nbc.gov.kh/news_and_events/news_info.php?id=854',
    '2025-11-12T07:04:08.206Z'::timestamptz,
    '2025-11-12T07:04:08.206Z'::timestamptz
)
;

-- Template 23 translation
INSERT INTO public.template_translation (
    "templateId", language, title, content, "imageId", "linkPreview", "createdAt", "updatedAt"
) VALUES (
    23,
    'KM'::language_enum,
    'លោកជំទាវបណ្ឌិត ជា សិរី អភិបាលធនាគារជាតិនៃកម្ពុជា បានចូលរួមជាវាគ្មិនលើកទឹកចិត្តនៅសន្និសីទអាជីវកម្មអាស៊ានរបស់ Bloomberg លើកទី៦ ក្រោមប្រធានបទ "អតិផរណា ការងារ និងរូបិយបណ្ណ៖ ស្ថាប័នធនាគារកណ្ដាលក្នុងចំណុចផ្តោត" ថ្ងៃទី២៧ តុលា ២០២៥',
    'នៅថ្ងៃទី២៧ តុលា ឆ្នាំ២០២៥ ក្នុងទីក្រុងកូអាឡាឡាំពួរ ប្រទេសម៉ាឡេស៊ី លោកជំទាវបណ្ឌិត ជា សិរី អភិបាលធនាគារជាតិនៃកម្ពុជា បានចូលរួមជាវាគ្មិនជាក្រុមនៅសន្និសីទអាជីវកម្មអាស៊ានរបស់ Bloomberg លើកទី៦ ក្រោមប្រធានបទ "អតិផរណា ការងារ និងរូបិយបណ្ណ៖ ស្ថាប័នធនាគារកណ្ដាលក្នុងចំណុចផ្តោត"។

ក្នុងកិច្ចពិភាក្សា លោកជំទាវបានចែករំលែកទស្សនៈអំពីវិធីរក្សាថេរភាពហិរញ្ញវត្ថុ និងកិច្ចខិតខំប្រឹងប្រែងបន្តរបស់កម្ពុជា ដើម្បីថែរក្សាភាពសុចរិតរបស់ប្រព័ន្ធហិរញ្ញវត្ថុ ដែលជាកត្តាសំខាន់ក្នុងការបង្កើនទំនុកចិត្តអ្នកវិនិយោគ។ ក៏ដូចជាការរំលឹកសារៈសំខាន់នៃការកែលម្អសហប្រតិបត្តិការអន្តរជាតិ ដើម្បីដោះស្រាយបញ្ហាប្រឈមសកលកំពុងលេចឡើង ជាពិសេសហានិភ័យក្លែងបន្លំហិរញ្ញវត្ថុនៅលើបណ្តាញអ៊ីនធឺណិត។

បន្ថែមទៀត លោកជំទាវបានលើកយកជ័យលាភផលនៃការអភិវឌ្ឍគម្រោងហេដ្ឋារចនាសម្ព័ន្ធសំខាន់ៗរបស់កម្ពុជា ដែលគាំទ្របរិយាកាសវិនិយោគឲ្យកាន់តែល្អប្រសើរ ជំរុញការផ្សព្វផ្សាយនៃការបំបែកមុខទំនិញនាំចេញនិងទីផ្សារ ហើយពង្រឹងសមត្ថភាពធន់ និងសមត្ថភាពប្រកួតប្រជែងសេដ្ឋកិច្ចរបស់ប្រទេស។',
    '20cd4a3e-ce70-4709-a30d-ff82f5f80eb7',
    NULL,
    '2025-11-12T02:34:30.060Z'::timestamptz,
    '2025-11-12T02:34:30.060Z'::timestamptz
)
;

-- Template 32 translation
INSERT INTO public.template_translation (
    "templateId", language, title, content, "imageId", "linkPreview", "createdAt", "updatedAt"
) VALUES (
    32,
    'KM'::language_enum,
    'មតិសំណេះសំណាល លោកជំទាវបណ្ឌិត ជា សិរី ទេសាភិបាល ធនាគារជាតិនៃកម្ពុជា ថ្លែងក្នុងពិធីអបអរសាទរដល់សិស្សថ្នាក់ទី១២ ដែលប្រឡងជាប់ជាស្ថាពរសញ្ញាបត្រមធ្យមសិក្សាទុតិយភូមិឆ្នាំសិក្សា ២០២៤-២០២៥ នៅស្រុកសន្ទុក ខេត្តកំពង់ធំ',
    '',
    NULL,
    NULL,
    '2025-11-12T07:10:07.763Z'::timestamptz,
    '2025-11-12T07:10:07.763Z'::timestamptz
)
;

-- Template 31 translation
INSERT INTO public.template_translation (
    "templateId", language, title, content, "imageId", "linkPreview", "createdAt", "updatedAt"
) VALUES (
    31,
    'KM'::language_enum,
    'លោកជំទាវអគ្គមហាឧបាសិកាពុទ្ធសាសនូបត្ថម្ភក៍ ខៀវ ស៊ីណា និង លោកជំទាវបណ្ឌិត ជា សិរី ទេសាភិបាល ធនាគារជាតិនៃកម្ពុជា បានទទួលកាន់បិណ្ឌវេនទី១០ និងចាត់ចែងចង្ហាន់ប្រគេនព្រះសង្ឃ គង់នៅវត្តឧណ្ណាលោម រាជធានីភ្នំពេញ ១៦ កញ្ញា ២០២៥',
    'លោកជំទាវអគ្គមហាឧបាសិកាពុទ្ធសាសនូបត្ថម្ភក៍ ខៀវ ស៊ីណា និង លោកជំទាវបណ្ឌិត ជា សិរី ទេសាភិបាល ធនាគារជាតិនៃកម្ពុជា បានទទួលកាន់បិណ្ឌវេនទី១០ និងចាត់ចែងចង្ហាន់ប្រគេនព្រះសង្ឃ គង់នៅវត្តឧណ្ណាលោម រាជធានីភ្នំពេញ នៅថ្ងៃទី១៦-១៧ ខែកញ្ញា ឆ្នាំ២០២៥ ដោយមានការចូលរួមពីថ្នាក់ដឹកនាំ ក្រុមគ្រួសារ និង មន្ត្រី-បុគ្គលិក ធនាគារជាតិនៃកម្ពុជាផងដែរ។

ពិធីបុណ្យកាន់បិណ្ឌនេះ ត្រូវបានរៀបចំឡើងតាមប្រពៃណីព្រះពុទ្ធសាសនា ក្នុងគោលបំណងទំនុកបម្រុងនិងចាត់ចែងចង្ហាន់ និងបច្ច័យ៤ ប្រគេនព្រះសង្ឃគង់ចាំព្រះវស្សានិងឧទ្ទិសមហាកុសលផលបុណ្យដល់ដួងវិញ្ញាណខន្ធ ឯកឧត្តម ជា ចាន់តូ អតីតទេសាភិបាលកិត្តិយស ធនាគារជាតិនៃកម្ពុជា និងបុព្វការីជនទាំងឡាយមានមាតាបិតាជីដូនជីតា យុទ្ធជន យុទ្ធនារី ដែលបានពលីជីវិតដើម្បីជាតិមាតុភូមិនិងសាសនា ក៏ដូចជាចូលរួមចំណែករឹតចំណងសាមគ្គីភាព និងលើកតម្កើងព្រះពុទ្ធសាសនាឱ្យបានរុងរឿងអស់កាលជាអង្វែងតទៅ។
សូមអនុមោទនានូវកុសលផលបុណ្យនេះស្មើៗគ្នា។',
    '3e8c0c90-ac35-4c2f-9026-1630e598ca5d',
    'https://www.nbc.gov.kh/news_and_events/news_info.php?id=841',
    '2025-11-12T07:07:25.685Z'::timestamptz,
    '2025-11-12T07:07:25.685Z'::timestamptz
)
;

-- Template 24 translation
INSERT INTO public.template_translation (
    "templateId", language, title, content, "imageId", "linkPreview", "createdAt", "updatedAt"
) VALUES (
    24,
    'KM'::language_enum,
    'ឯកឧត្តម ហ៊ុន ម៉ានី ប្រគល់លិខិតថ្លែងអំណរគុណ ជូនលោកជំទាវបណ្ឌិត ជា សិរី ដែលបានឧបត្ថម្ភគាំទ្រពិធីពិព័រណ៍ផលិតផលខ្មែរ',
    'ឯកឧត្តម ហ៊ុន ម៉ានី ឧបនាយករដ្ឋមន្ត្រី រដ្ឋមន្ត្រីក្រសួងមុខងារសាធារណៈ និងជាប្រធានសហភាពសហព័ន្ធយុវជនកម្ពុជា (ស.ស.យ.ក.) បានប្រគល់លិខិតថ្លែងអំណរគុណ ជូន លោកជំទាវបណ្ឌិត ជា សិរី ទេសាភិបាល ធនាគារជាតិនៃកម្ពុជា ដែលបានចូលរួមឧបត្ថម្ភគាំទ្រពិធីពិព័រណ៍ផលិតផលខ្មែរ ក្រោមប្រធានបទ "ខ្មែរធ្វើបាន៖ ចូលរួម ជំរុញ និងគាំទ្រផលិតផលក្នុងស្រុក" ក្នុងឱកាសបិទពិធីពិព័រណ៍ នាថ្ងៃទី២៨ ខែកញ្ញា ឆ្នាំ២០២៥ នៅមជ្ឈមណ្ឌលសន្និបាត និងពិព័រណ៍កោះពេជ្រ។ ការចូលរួមនេះ បញ្ជាក់ពីទឹកចិត្តស្រលាញ់ និងការគាំទ្រផលិតផលខ្មែរ ក្នុងស្មារតីរួបរួមជាតិ និងជារូបសញ្ញានៃការគាំទ្រផលិតកម្មក្នុងស្រុក ដើម្បីជំរុញផលិតភាព និងកំណើនសេដ្ឋកិច្ចជាតិ។',
    '1eb2250c-bdb4-46d8-a08e-37a006d5180f',
    'https://www.nbc.gov.kh/news_and_events/news_info.php?id=845',
    '2025-11-12T02:37:44.595Z'::timestamptz,
    '2025-11-12T02:37:44.595Z'::timestamptz
)
;

-- Template 22 translation
INSERT INTO public.template_translation (
    "templateId", language, title, content, "imageId", "linkPreview", "createdAt", "updatedAt"
) VALUES (
    22,
    'KM'::language_enum,
    'លោកជំទាវបណ្ឌិត ជា សិរី ទេសាភិបាលធនាគារជាតិនៃកម្ពុជា (NBC) បានធ្វើបទបង្ហាញជាវាគ្មិនគន្លឹះ ក្នុងវេទិកាហិរញ្ញវត្ថុអាស៊ីលើកទី៥ក្រោមប្រធានបទ "Positioning for the Future" នៅថ្ងៃទី២៥ ខែកញ្ញា ឆ្នាំ២០២៥ ក្នុងទីស្នាក់ការកណ្ដាលធនាគារអភិវឌ្ឍន៍អាស៊ី (ADB) ក្នុងទីក្រុងម៉ានីល ប្រទេសហ្វីលីពីន។',
    'ក្រោមប្រធានបទរង "ការផ្សាភ្ជាប់បច្ចេកវិទ្យាហិរញ្ញវត្ថុ ទំនុកចិត្ត និងបទប្បញ្ញត្តិ" លោកជំទាវបានសង្កត់ធ្ងន់ថា បច្ចេកវិទ្យាហិរញ្ញវត្ថុមិនត្រូវវាយតម្លៃតាមនវនិយមទេ ប៉ុន្តែក្នុងតម្រូវការ—តើវាអាចបិទចន្លោះ បង្កើនទំនុកចិត្ត និងបម្រើប្រជាពលរដ្ឋតាមទីកន្លែងរបស់ពួកគេឬអត់។ លោកជំទាវបានអំពាវនាវឲ្យសហគមន៍អន្តរជាតិរចនាប្រព័ន្ធហិរញ្ញវត្ថុដែលមានប្រសិទ្ធភាព ប៉ុន្តែមានភាពរួមបញ្ចូល រហ័ស ប៉ុន្តែមានតុល្យភាព និងមានភាពធន់ ដើម្បីគាំទ្រវិបុលភាពរួម។

ក្រៅពីនេះ លោកជំទាវបានរំលេច "ក្របខណ្ឌគោលនយោបាយសេដ្ឋកិច្ច និងសង្គមឌីជីថលកម្ពុជា ២០២១–២០៣៥" ដែលដាក់ "ការរួមបញ្ចូល" ជាស្នូលនៃដំណើរផ្លាស់ប្តូរឌីជីថល មិនមែនជាលទ្ធផល ប៉ុន្តែជាគោលការណ៍រចនា។ ការរួមបញ្ចូល មិនមែនជាគោលបំណងសប្បុរសធម៌ទេ ប៉ុន្តែជាបញ្ហាជាយុទ្ធសាស្ត្រ។',
    'c5dc2bf5-d6f9-4c40-bf29-a762648d606f',
    NULL,
    '2025-11-12T02:33:57.310Z'::timestamptz,
    '2025-11-12T02:33:57.310Z'::timestamptz
)
;

-- Template 9 translation
INSERT INTO public.template_translation (
    "templateId", language, title, content, "imageId", "linkPreview", "createdAt", "updatedAt"
) VALUES (
    9,
    'KM'::language_enum,
    'H.E. Dr. Chea Serey, Governor of the National Bank of Cambodia (NBC), received a courtesy visit from Mr. Leong Wai Mun, Chief Executive Officer of Hong Leong Bank (Cambodia) Plc., and his colleagues',
    'H.E. Dr. Chea Serey, Governor of the National Bank of Cambodia (NBC), received a courtesy visit from Mr. Leong Wai Mun, Chief Executive Officer of Hong Leong Bank (Cambodia) Plc., and his colleagues on the afternoon of October 20, 2025, at the NBC''s Wat Phnom office.

During the meeting, Mr. Leong Wai Mun presented the operational progress of Hong Leong Bank (Cambodia) Plc., a subsidiary of Hong Leong Bank Berhad in Malaysia, and reaffirmed the bank''s commitment to expanding its operations to support enterprises in several potential sectors such as food processing, agriculture, and manufacturing. He also shared that several affiliated companies under Hong Leong Bank Berhad had recently visited Cambodia to explore investment opportunities in the healthcare sector and other industries, while commending the country''s positive infrastructure development—particularly the operation of the Techo International Airport.

In response, H.E. the Governor welcomed the bank''s achievements in recent years and encouraged Hong Leong Bank to further expand its operations in Cambodia. She also provided an overview of Cambodia''s current economic situation and briefed the delegation on ongoing regulatory preparations aimed at strengthening the resilience of the banking system. H.E. the Governor further encouraged active engagement and constructive feedback from the banking community to help enhance the effectiveness and comprehensiveness of policy implementation.',
    '931fc61c-ed0b-461a-aef2-866e15f2dd61',
    'https://www.nbc.gov.kh/english/news_and_events/news_info.php?id=853',
    '2025-11-07T08:05:42.252Z'::timestamptz,
    '2025-11-07T08:05:42.252Z'::timestamptz
)
;


