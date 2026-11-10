CREATE TABLE "recurring"."recurring_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'expense' NOT NULL,
	"amount_paisa" bigint NOT NULL,
	"category_id" uuid,
	"account_id" uuid,
	"day_of_month" integer NOT NULL,
	"starts_on" text NOT NULL,
	"ends_on" text,
	"remind_days_before" integer DEFAULT 2 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_confirmed_month" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
