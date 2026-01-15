\echo '🌱 SEED INIT DATA'

-- 1x1 transparent PNG (bytea)
-- base64: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBAp8G3KQAAAAASUVORK5CYII=
DO $$
DECLARE
  png_icon BYTEA := decode(
    '89504e470d0a1a0a0000000d49484452' ||
    '00000001000000010804000000b51c0c' ||
    '020000000b4944415478da63fcff1f00' ||
    '030301029f06dca40000000049454e44' ||
    'ae426082',
    'hex'
  );
BEGIN
  INSERT INTO public.category_type (
    id,
    name,
    namekh,
    namejp,
    icon,
    "mimeType",
    "originalFileName",
    "createdAt",
    "updatedAt",
    "deletedAt"
  )
  VALUES
    (1, 'News', 'ព័ត៌មាន', 'ニュース', png_icon, 'image/png', 'news.png', NOW(), NOW(), NULL),
    (2, 'Product & Feature', 'ផលិតផល និងមុខងារ', '製品・機能', png_icon, 'image/png', 'product_feature.png', NOW(), NOW(), NULL),
    (3, 'Other', 'ផ្សេងៗ', 'その他', png_icon, 'image/png', 'other.png', NOW(), NOW(), NULL),
    (4, 'Event', 'ជំនួយ', 'イベント', png_icon, 'image/png', 'event.png', NOW(), NOW(), NULL)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    namekh = EXCLUDED.namekh,
    namejp = EXCLUDED.namejp,
    icon = EXCLUDED.icon,
    "mimeType" = EXCLUDED."mimeType",
    "originalFileName" = EXCLUDED."originalFileName",
    "deletedAt" = NULL,
    "updatedAt" = NOW();
END $$;

\echo '✅ SEED DONE'
