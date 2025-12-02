CREATE TABLE "folder_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"folder_id" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"included_chats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "folder_memory_user_id_folder_id_unique" UNIQUE("user_id","folder_id")
);
--> statement-breakpoint
ALTER TABLE "folder_memory" ADD CONSTRAINT "folder_memory_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folder_memory_user_idx" ON "folder_memory" USING btree ("user_id");