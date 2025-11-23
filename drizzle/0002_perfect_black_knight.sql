CREATE TABLE "tavily_api_key" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "tavily_api_key_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "tavily_api_key" ADD CONSTRAINT "tavily_api_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;