CREATE TABLE IF NOT EXISTS "budgeting"."budget_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"budget_key" text NOT NULL,
	"month" text NOT NULL,
	"threshold" smallint NOT NULL,
	"spent_paisa" bigint NOT NULL,
	"limit_paisa" bigint NOT NULL,
	"fired_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "budget_alerts_threshold_chk" CHECK ("threshold" in (80, 100))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budget_alerts_uidx" ON "budgeting"."budget_alerts" USING btree ("family_id","budget_key","month","threshold");
