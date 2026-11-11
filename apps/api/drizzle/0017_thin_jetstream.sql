DROP INDEX "budgeting"."budget_family_cat_month_uidx";--> statement-breakpoint
DELETE FROM "budgeting"."budgets" a USING "budgeting"."budgets" b WHERE a."category_id" IS NULL AND b."category_id" IS NULL AND a."family_id" = b."family_id" AND a."month" = b."month" AND a.ctid < b.ctid;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_family_cat_month_uidx" ON "budgeting"."budgets" USING btree ("family_id",coalesce("category_id", '00000000-0000-0000-0000-000000000000'::uuid),"month");
