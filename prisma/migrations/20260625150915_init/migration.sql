-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "IngestRunStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILURE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_items" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT,
    "rawContent" TEXT NOT NULL,
    "authorLogin" TEXT,
    "url" TEXT,
    "original_timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_analyses" (
    "id" TEXT NOT NULL,
    "feedback_item_id" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "topics" JSONB NOT NULL,
    "severity_score" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingest_logs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "IngestRunStatus" NOT NULL,
    "items_fetched" INTEGER NOT NULL DEFAULT 0,
    "items_new" INTEGER NOT NULL DEFAULT 0,
    "items_skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingest_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_items_externalId_key" ON "feedback_items"("externalId");

-- CreateIndex
CREATE INDEX "feedback_items_source_idx" ON "feedback_items"("source");

-- CreateIndex
CREATE INDEX "feedback_items_original_timestamp_idx" ON "feedback_items"("original_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_analyses_feedback_item_id_key" ON "feedback_analyses"("feedback_item_id");

-- CreateIndex
CREATE INDEX "feedback_analyses_sentiment_idx" ON "feedback_analyses"("sentiment");

-- CreateIndex
CREATE INDEX "feedback_analyses_severity_score_idx" ON "feedback_analyses"("severity_score");

-- CreateIndex
CREATE INDEX "feedback_analyses_status_idx" ON "feedback_analyses"("status");

-- CreateIndex
CREATE INDEX "ingest_logs_source_idx" ON "ingest_logs"("source");

-- CreateIndex
CREATE INDEX "ingest_logs_created_at_idx" ON "ingest_logs"("created_at");

-- AddForeignKey
ALTER TABLE "feedback_analyses" ADD CONSTRAINT "feedback_analyses_feedback_item_id_fkey" FOREIGN KEY ("feedback_item_id") REFERENCES "feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
