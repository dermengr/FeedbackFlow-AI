-- Multi-language AI translation cache on feedback analyses.
ALTER TABLE "feedback_analyses" ADD COLUMN IF NOT EXISTS "translations" JSONB DEFAULT '{}';