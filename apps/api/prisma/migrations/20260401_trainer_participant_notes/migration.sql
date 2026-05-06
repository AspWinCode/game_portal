CREATE TABLE "trainer_participant_notes" (
  "id" TEXT NOT NULL,
  "participant_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "trainer_participant_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trainer_participant_notes_participant_id_created_at_idx" ON "trainer_participant_notes"("participant_id", "created_at");
CREATE INDEX "trainer_participant_notes_session_id_created_at_idx" ON "trainer_participant_notes"("session_id", "created_at");

ALTER TABLE "trainer_participant_notes"
  ADD CONSTRAINT "trainer_participant_notes_participant_id_fkey"
  FOREIGN KEY ("participant_id") REFERENCES "participants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trainer_participant_notes"
  ADD CONSTRAINT "trainer_participant_notes_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trainer_participant_notes"
  ADD CONSTRAINT "trainer_participant_notes_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
