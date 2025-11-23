ALTER TABLE "message" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "message" DROP COLUMN "model_id";