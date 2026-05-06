ALTER TABLE "user_sessions"
ADD COLUMN "impersonated_by_id" TEXT;

CREATE INDEX "user_sessions_impersonated_by_id_idx" ON "user_sessions"("impersonated_by_id");

ALTER TABLE "user_sessions"
ADD CONSTRAINT "user_sessions_impersonated_by_id_fkey"
FOREIGN KEY ("impersonated_by_id") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
