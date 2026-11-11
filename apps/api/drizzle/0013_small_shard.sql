CREATE TABLE IF NOT EXISTS "identity"."consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"locale" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consents_kind_check" CHECK ("identity"."consents"."kind" in ('privacy_policy','voice_notes'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consents_user_kind_version_uq" ON "identity"."consents" USING btree ("user_id","kind","version");