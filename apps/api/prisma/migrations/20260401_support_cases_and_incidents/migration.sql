CREATE TYPE "SupportCaseStatus" AS ENUM ('open', 'investigating', 'resolved');
CREATE TYPE "ServiceIncidentStatus" AS ENUM ('healthy', 'degraded', 'outage', 'resolved');

CREATE TABLE "support_cases" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" "SupportCaseStatus" NOT NULL DEFAULT 'open',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "incident_statuses" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "ServiceIncidentStatus" NOT NULL DEFAULT 'healthy',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "created_by" TEXT NOT NULL,
  CONSTRAINT "incident_statuses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_cases_organization_id_status_created_at_idx" ON "support_cases"("organization_id", "status", "created_at");
CREATE INDEX "incident_statuses_organization_id_status_started_at_idx" ON "incident_statuses"("organization_id", "status", "started_at");

ALTER TABLE "support_cases"
ADD CONSTRAINT "support_cases_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "incident_statuses"
ADD CONSTRAINT "incident_statuses_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
