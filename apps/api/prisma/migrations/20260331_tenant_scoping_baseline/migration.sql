INSERT INTO "organizations" ("id", "name", "slug", "is_active", "created_at", "updated_at")
SELECT
  'default_school_org',
  'Default School',
  'default-school',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "organizations" WHERE "slug" = 'default-school'
);

ALTER TABLE "jams" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "sessions" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "media_assets" ADD COLUMN "organization_id" TEXT;

UPDATE "jams"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'default-school' LIMIT 1)
WHERE "organization_id" IS NULL;

UPDATE "sessions"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'default-school' LIMIT 1)
WHERE "organization_id" IS NULL;

UPDATE "media_assets"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'default-school' LIMIT 1)
WHERE "organization_id" IS NULL;

ALTER TABLE "jams" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "media_assets" ALTER COLUMN "organization_id" SET NOT NULL;

CREATE INDEX "jams_organization_id_updated_at_idx" ON "jams"("organization_id", "updated_at");
CREATE INDEX "sessions_organization_id_created_at_idx" ON "sessions"("organization_id", "created_at");
CREATE INDEX "media_assets_organization_id_created_at_idx" ON "media_assets"("organization_id", "created_at");

ALTER TABLE "jams"
  ADD CONSTRAINT "jams_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
