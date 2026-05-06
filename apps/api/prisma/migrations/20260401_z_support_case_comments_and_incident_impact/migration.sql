ALTER TABLE "incident_statuses"
ADD COLUMN "impact" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "support_case_comments" (
  "id" TEXT NOT NULL,
  "support_case_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "support_case_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_case_comments_support_case_id_created_at_idx"
  ON "support_case_comments"("support_case_id", "created_at");

CREATE INDEX "support_case_comments_organization_id_created_at_idx"
  ON "support_case_comments"("organization_id", "created_at");

ALTER TABLE "support_case_comments"
ADD CONSTRAINT "support_case_comments_support_case_id_fkey"
FOREIGN KEY ("support_case_id") REFERENCES "support_cases"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_case_comments"
ADD CONSTRAINT "support_case_comments_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_case_comments"
ADD CONSTRAINT "support_case_comments_author_id_fkey"
FOREIGN KEY ("author_id") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
