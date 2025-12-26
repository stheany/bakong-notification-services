-- Add translation columns to category_type table
ALTER TABLE public.category_type ADD COLUMN IF NOT EXISTS namejp varchar(255);
ALTER TABLE public.category_type ADD COLUMN IF NOT EXISTS namekh varchar(255);

-- Update translations for existing categories
UPDATE public.category_type
SET
  namekh = CASE name
    WHEN 'Product & Feature' THEN 'ផលិតផល និងលក្ខណៈពិសេស'
    WHEN 'Event'             THEN 'ព្រឹត្តិការណ៍'
    WHEN 'News'              THEN 'ព័ត៌មាន'
    WHEN 'Other'             THEN 'ផ្សេងៗ'
    ELSE namekh
  END,
  namejp = CASE name
    WHEN 'Product & Feature' THEN '製品・機能'
    WHEN 'Event'             THEN 'イベント'
    WHEN 'News'              THEN 'ニュース'
    WHEN 'Other'             THEN 'その他'
    ELSE namejp
  END
WHERE name IN ('Product & Feature', 'Event', 'News', 'Other');

