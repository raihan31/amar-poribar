ALTER TABLE "budgeting"."budgets" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgeting"."budgets" DROP CONSTRAINT IF EXISTS "budgets_source_chk";--> statement-breakpoint
ALTER TABLE "budgeting"."budgets" ADD CONSTRAINT "budgets_source_chk" CHECK ("budgeting"."budgets"."source" in ('manual', 'carried'));
