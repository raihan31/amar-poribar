CREATE TABLE IF NOT EXISTS "billing"."family_overrides" (
	"family_id" uuid PRIMARY KEY NOT NULL,
	"ai_entries_month" integer,
	"members_max" integer,
	"reason" text NOT NULL,
	"set_by" uuid NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL
);
