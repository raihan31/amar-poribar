CREATE TABLE "budgeting"."budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"category_id" uuid,
	"month" text NOT NULL,
	"limit_paisa" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgeting"."festival_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" text NOT NULL,
	"ends_on" text NOT NULL,
	"limit_paisa" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "budget_family_cat_month_uidx" ON "budgeting"."budgets" USING btree ("family_id","category_id","month");