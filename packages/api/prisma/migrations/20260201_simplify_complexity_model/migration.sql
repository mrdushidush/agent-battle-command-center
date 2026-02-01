-- Migration: Simplify Task Complexity Model
-- Consolidates 5 complexity fields into 3 for cleaner architecture
--
-- Before: routerComplexity, haikuComplexity, haikuReasoning, finalComplexity, actualComplexity
-- After:  complexity, complexitySource, complexityReasoning
--
-- Run this migration with:
--   docker exec -i abcc-postgres psql -U postgres -d abcc < migration.sql

BEGIN;

-- Step 1: Add new columns (if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'complexity') THEN
        ALTER TABLE tasks ADD COLUMN complexity FLOAT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'complexity_source') THEN
        ALTER TABLE tasks ADD COLUMN complexity_source VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'complexity_reasoning') THEN
        ALTER TABLE tasks ADD COLUMN complexity_reasoning TEXT;
    END IF;
END $$;

-- Step 2: Migrate data from old columns to new columns
-- Priority: final_complexity > actual_complexity > haiku_complexity > router_complexity
UPDATE tasks SET
    complexity = COALESCE(final_complexity, actual_complexity, haiku_complexity, router_complexity),
    complexity_source = CASE
        WHEN final_complexity IS NOT NULL AND haiku_complexity IS NOT NULL THEN 'dual'
        WHEN actual_complexity IS NOT NULL THEN 'actual'
        WHEN haiku_complexity IS NOT NULL THEN 'haiku'
        WHEN router_complexity IS NOT NULL THEN 'router'
        ELSE NULL
    END,
    complexity_reasoning = haiku_reasoning
WHERE complexity IS NULL AND (
    final_complexity IS NOT NULL OR
    actual_complexity IS NOT NULL OR
    haiku_complexity IS NOT NULL OR
    router_complexity IS NOT NULL
);

-- Step 3: Verify migration (check counts before dropping)
DO $$
DECLARE
    old_count INTEGER;
    new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO old_count FROM tasks
    WHERE router_complexity IS NOT NULL
       OR haiku_complexity IS NOT NULL
       OR final_complexity IS NOT NULL
       OR actual_complexity IS NOT NULL;

    SELECT COUNT(*) INTO new_count FROM tasks WHERE complexity IS NOT NULL;

    RAISE NOTICE 'Migration check: % tasks had old complexity data, % now have new complexity', old_count, new_count;

    IF old_count > 0 AND new_count < old_count THEN
        RAISE EXCEPTION 'Data loss detected! Old: %, New: %. Aborting migration.', old_count, new_count;
    END IF;
END $$;

-- Step 4: Drop old columns (uncomment after verifying migration)
-- IMPORTANT: Only run this after confirming the migration worked correctly
--
-- ALTER TABLE tasks DROP COLUMN IF EXISTS router_complexity;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS haiku_complexity;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS haiku_reasoning;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS final_complexity;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS actual_complexity;

COMMIT;

-- Step 5: Print summary
SELECT
    COUNT(*) as total_tasks,
    COUNT(complexity) as tasks_with_complexity,
    COUNT(complexity_source) as tasks_with_source,
    AVG(complexity) as avg_complexity
FROM tasks;
