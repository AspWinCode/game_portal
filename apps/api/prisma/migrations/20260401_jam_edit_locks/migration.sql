CREATE TABLE "jam_edit_locks" (
  "id" TEXT NOT NULL,
  "jam_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "jam_edit_locks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jam_edit_locks_jam_id_key" ON "jam_edit_locks"("jam_id");
CREATE INDEX "jam_edit_locks_organization_id_expires_at_idx" ON "jam_edit_locks"("organization_id", "expires_at");
CREATE INDEX "jam_edit_locks_user_id_expires_at_idx" ON "jam_edit_locks"("user_id", "expires_at");

ALTER TABLE "jam_edit_locks"
  ADD CONSTRAINT "jam_edit_locks_jam_id_fkey"
  FOREIGN KEY ("jam_id") REFERENCES "jams"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "jam_edit_locks"
  ADD CONSTRAINT "jam_edit_locks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "jam_edit_locks"
  ADD CONSTRAINT "jam_edit_locks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
