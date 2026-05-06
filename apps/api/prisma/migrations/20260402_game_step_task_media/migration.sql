ALTER TABLE "jam_steps"
ADD COLUMN IF NOT EXISTS "task_image_url" TEXT,
ADD COLUMN IF NOT EXISTS "task_video_url" TEXT;
