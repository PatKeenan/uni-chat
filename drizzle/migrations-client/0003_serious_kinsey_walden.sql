DROP TABLE "message_part" CASCADE;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "parts" jsonb DEFAULT '[]'::jsonb;