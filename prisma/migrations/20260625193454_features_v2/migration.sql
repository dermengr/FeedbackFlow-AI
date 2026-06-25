-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('STATUS_CHANGE', 'ASSIGN', 'UNASSIGN', 'COMMENT', 'LABEL_ADD', 'LABEL_REMOVE', 'SNOOZE', 'UNSNOOZE', 'BULK_UPDATE');

-- AlterTable
ALTER TABLE "feedback_analyses" ADD COLUMN     "actionItems" JSONB,
ADD COLUMN     "assigned_to_id" TEXT,
ADD COLUMN     "emotion" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "snoozed_until" TIMESTAMP(3),
ADD COLUMN     "translated_summary" TEXT;

-- AlterTable
ALTER TABLE "ingest_logs" ADD COLUMN     "source_config_id" TEXT;

-- CreateTable
CREATE TABLE "source_configs" (
    "id" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_comments" (
    "id" TEXT NOT NULL,
    "feedback_item_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'slate',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_labels" (
    "feedback_item_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_labels_pkey" PRIMARY KEY ("feedback_item_id","label_id")
);

-- CreateTable
CREATE TABLE "feedback_embeddings" (
    "feedback_item_id" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_embeddings_pkey" PRIMARY KEY ("feedback_item_id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "feedback_item_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "type" "AuditEventType" NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_configs_source_key_key" ON "source_configs"("source_key");

-- CreateIndex
CREATE INDEX "feedback_comments_feedback_item_id_idx" ON "feedback_comments"("feedback_item_id");

-- CreateIndex
CREATE INDEX "feedback_comments_author_id_idx" ON "feedback_comments"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "labels_name_key" ON "labels"("name");

-- CreateIndex
CREATE INDEX "feedback_labels_label_id_idx" ON "feedback_labels"("label_id");

-- CreateIndex
CREATE INDEX "audit_events_feedback_item_id_idx" ON "audit_events"("feedback_item_id");

-- CreateIndex
CREATE INDEX "audit_events_actor_id_idx" ON "audit_events"("actor_id");

-- CreateIndex
CREATE INDEX "audit_events_type_idx" ON "audit_events"("type");

-- CreateIndex
CREATE INDEX "saved_views_owner_id_idx" ON "saved_views"("owner_id");

-- CreateIndex
CREATE INDEX "feedback_analyses_assigned_to_id_idx" ON "feedback_analyses"("assigned_to_id");

-- CreateIndex
CREATE INDEX "feedback_analyses_snoozed_until_idx" ON "feedback_analyses"("snoozed_until");

-- CreateIndex
CREATE INDEX "feedback_analyses_emotion_idx" ON "feedback_analyses"("emotion");

-- CreateIndex
CREATE INDEX "ingest_logs_source_config_id_idx" ON "ingest_logs"("source_config_id");

-- AddForeignKey
ALTER TABLE "feedback_analyses" ADD CONSTRAINT "feedback_analyses_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_logs" ADD CONSTRAINT "ingest_logs_source_config_id_fkey" FOREIGN KEY ("source_config_id") REFERENCES "source_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_feedback_item_id_fkey" FOREIGN KEY ("feedback_item_id") REFERENCES "feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_labels" ADD CONSTRAINT "feedback_labels_feedback_item_id_fkey" FOREIGN KEY ("feedback_item_id") REFERENCES "feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_labels" ADD CONSTRAINT "feedback_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_embeddings" ADD CONSTRAINT "feedback_embeddings_feedback_item_id_fkey" FOREIGN KEY ("feedback_item_id") REFERENCES "feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_feedback_item_id_fkey" FOREIGN KEY ("feedback_item_id") REFERENCES "feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- D20: Full-text search on feedback_items (title + rawContent).
-- Expression-based GIN index over a to_tsvector. No generated column so
-- Prisma does not detect drift. Query with:
--   WHERE to_tsvector('english', coalesce("title",'') || ' ' || coalesce("rawContent",'')) @@ plainto_tsquery('english', :q)
CREATE INDEX "feedback_items_search_idx"
  ON "feedback_items"
  USING GIN (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("rawContent", '')));
