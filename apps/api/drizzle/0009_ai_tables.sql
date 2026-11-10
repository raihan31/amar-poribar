CREATE TABLE IF NOT EXISTS "ai"."ai_summaries" (
	"family_id" uuid NOT NULL,
	"month" text NOT NULL,
	"locale" text NOT NULL,
	"facts_hash" text NOT NULL,
	"text" text NOT NULL,
	"speech_text" text NOT NULL,
	"used_ai" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_summaries_family_id_month_locale_facts_hash_pk" PRIMARY KEY("family_id","month","locale","facts_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai"."ai_usage" (
	"family_id" uuid NOT NULL,
	"month" text NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_family_id_month_pk" PRIMARY KEY("family_id","month")
);
