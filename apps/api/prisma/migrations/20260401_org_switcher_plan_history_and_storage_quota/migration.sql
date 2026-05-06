ALTER TABLE "user_sessions"
ADD COLUMN "current_organization_id" TEXT;

CREATE INDEX "user_sessions_current_organization_id_idx"
  ON "user_sessions"("current_organization_id");

ALTER TABLE "user_sessions"
ADD CONSTRAINT "user_sessions_current_organization_id_fkey"
FOREIGN KEY ("current_organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organizations"
ADD COLUMN "max_storage_bytes" BIGINT NOT NULL DEFAULT 5368709120;

CREATE TABLE "organization_plan_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "changed_by_id" TEXT,
  "from_plan_key" TEXT,
  "to_plan_key" TEXT NOT NULL,
  "reason" TEXT,
  "snapshot_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_plan_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_plan_events_organization_id_created_at_idx"
  ON "organization_plan_events"("organization_id", "created_at");

ALTER TABLE "organization_plan_events"
ADD CONSTRAINT "organization_plan_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_plan_events"
ADD CONSTRAINT "organization_plan_events_changed_by_id_fkey"
FOREIGN KEY ("changed_by_id") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
