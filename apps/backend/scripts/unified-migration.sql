-- =========================================
-- PATCH: Missing columns required by app
-- =========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='template' AND column_name='categoryTypeId'
  ) THEN
    ALTER TABLE public.template ADD COLUMN "categoryTypeId" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='template' AND column_name='showPerDay'
  ) THEN
    ALTER TABLE public.template ADD COLUMN "showPerDay" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='template' AND column_name='maxDayShowing'
  ) THEN
    ALTER TABLE public.template ADD COLUMN "maxDayShowing" INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='template' AND column_name='accountId'
  ) THEN
    ALTER TABLE public.template ADD COLUMN "accountId" VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='bakong_user' AND column_name='syncStatus'
  ) THEN
    ALTER TABLE public.bakong_user ADD COLUMN "syncStatus" VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='image' AND column_name='fileHash'
  ) THEN
    ALTER TABLE public.image ADD COLUMN "fileHash" VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user' AND column_name='imageId'
  ) THEN
    ALTER TABLE public."user" ADD COLUMN "imageId" INTEGER;
  END IF;
END $$;
