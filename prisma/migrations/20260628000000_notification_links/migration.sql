-- Add optional link and feedback item reference to notification logs.
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "feedback_item_id" TEXT;
ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "link" TEXT;
