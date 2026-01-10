cat > apps/backend/verify-all.sql <<'EOF'
\echo '🔍 Running Comprehensive Database Verification (V1 + V2)'
\echo ''

-- Check that required tables exist
SELECT
  to_regclass('public.template') AS v1_template,
  to_regclass('public.notification') AS v1_notification,
  to_regclass('public.template_translation') AS v1_template_translation,
  to_regclass('public.template_v2') AS v2_template,
  to_regclass('public.template_translation_v2') AS v2_template_translation;

\echo ''
\echo '🔍 category_type translation columns check'
SELECT
  COUNT(*) AS total_rows,
  COUNT(namekh) AS namekh_filled,
  COUNT(namejp) AS namejp_filled
FROM public.category_type;

\echo ''
\echo '✅ Verification finished'
EOF
