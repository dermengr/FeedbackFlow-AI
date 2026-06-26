-- CreateTable
CREATE TABLE "feedback_votes" (
    "id" TEXT NOT NULL,
    "feedback_item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_links" (
    "id" TEXT NOT NULL,
    "from_item_id" TEXT NOT NULL,
    "to_item_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL DEFAULT 'related',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_prefs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "slack_enabled" BOOLEAN NOT NULL DEFAULT false,
    "min_severity" INTEGER NOT NULL DEFAULT 3,
    "digest_frequency" TEXT NOT NULL DEFAULT 'daily',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "assignee_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashed_key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "position_x" INTEGER NOT NULL DEFAULT 0,
    "position_y" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 1,
    "height" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'csv',
    "filter_query" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "results_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "time_range" TEXT NOT NULL DEFAULT '7d',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reply_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reply_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_steps" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "completed_steps" JSONB NOT NULL DEFAULT '[]',
    "current_step" TEXT NOT NULL DEFAULT 'welcome',
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "assigned_count" INTEGER NOT NULL DEFAULT 0,
    "actioned_count" INTEGER NOT NULL DEFAULT 0,
    "avg_response_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_archives" (
    "id" TEXT NOT NULL,
    "feedback_item_id" TEXT NOT NULL,
    "archived_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_votes_feedback_item_id_idx" ON "feedback_votes"("feedback_item_id");

-- CreateIndex
CREATE INDEX "feedback_votes_user_id_idx" ON "feedback_votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_votes_feedback_item_id_user_id_type_key" ON "feedback_votes"("feedback_item_id", "user_id", "type");

-- CreateIndex
CREATE INDEX "feedback_links_from_item_id_idx" ON "feedback_links"("from_item_id");

-- CreateIndex
CREATE INDEX "feedback_links_to_item_id_idx" ON "feedback_links"("to_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_links_from_item_id_to_item_id_relation_type_key" ON "feedback_links"("from_item_id", "to_item_id", "relation_type");

-- CreateIndex
CREATE UNIQUE INDEX "notification_prefs_user_id_key" ON "notification_prefs"("user_id");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_idx" ON "notification_logs"("user_id");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- CreateIndex
CREATE INDEX "routing_rules_assignee_id_idx" ON "routing_rules"("assignee_id");

-- CreateIndex
CREATE INDEX "routing_rules_enabled_idx" ON "routing_rules"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hashed_key_key" ON "api_keys"("hashed_key");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "dashboard_widgets_user_id_idx" ON "dashboard_widgets"("user_id");

-- CreateIndex
CREATE INDEX "export_templates_user_id_idx" ON "export_templates"("user_id");

-- CreateIndex
CREATE INDEX "search_history_user_id_idx" ON "search_history"("user_id");

-- CreateIndex
CREATE INDEX "search_history_query_idx" ON "search_history"("query");

-- CreateIndex
CREATE INDEX "ai_insights_type_idx" ON "ai_insights"("type");

-- CreateIndex
CREATE INDEX "ai_insights_time_range_idx" ON "ai_insights"("time_range");

-- CreateIndex
CREATE INDEX "reply_templates_user_id_idx" ON "reply_templates"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_steps_user_id_key" ON "onboarding_steps"("user_id");

-- CreateIndex
CREATE INDEX "team_metrics_user_id_idx" ON "team_metrics"("user_id");

-- CreateIndex
CREATE INDEX "team_metrics_period_idx" ON "team_metrics"("period");

-- CreateIndex
CREATE UNIQUE INDEX "team_metrics_user_id_period_period_start_key" ON "team_metrics"("user_id", "period", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_archives_feedback_item_id_key" ON "feedback_archives"("feedback_item_id");

-- CreateIndex
CREATE INDEX "feedback_archives_archived_by_id_idx" ON "feedback_archives"("archived_by_id");

-- AddForeignKey
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_feedback_item_id_fkey" FOREIGN KEY ("feedback_item_id") REFERENCES "feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_links" ADD CONSTRAINT "feedback_links_from_item_id_fkey" FOREIGN KEY ("from_item_id") REFERENCES "feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_links" ADD CONSTRAINT "feedback_links_to_item_id_fkey" FOREIGN KEY ("to_item_id") REFERENCES "feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_links" ADD CONSTRAINT "feedback_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_templates" ADD CONSTRAINT "export_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_templates" ADD CONSTRAINT "reply_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_steps" ADD CONSTRAINT "onboarding_steps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_metrics" ADD CONSTRAINT "team_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_archives" ADD CONSTRAINT "feedback_archives_feedback_item_id_fkey" FOREIGN KEY ("feedback_item_id") REFERENCES "feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_archives" ADD CONSTRAINT "feedback_archives_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

