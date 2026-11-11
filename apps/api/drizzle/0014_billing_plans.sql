CREATE TABLE IF NOT EXISTS "billing"."plan_limits" (
	"plan_id" text NOT NULL,
	"key" text NOT NULL,
	"int_value" integer,
	"bool_value" boolean,
	CONSTRAINT "plan_limits_plan_id_key_pk" PRIMARY KEY("plan_id","key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing"."plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"price_month_paisa" bigint NOT NULL,
	"price_year_paisa" bigint,
	"currency" text DEFAULT 'BDT' NOT NULL,
	"sort" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO "billing"."plans" ("id", "name_bn", "name_en", "price_month_paisa", "price_year_paisa", "sort") VALUES
	('free', 'ফ্রি', 'Free', 0, NULL, 1),
	('plus', 'পরিবার প্লাস', 'Poribar Plus', 9900, 99900, 2),
	('probashi', 'প্রবাসী', 'Probashi', 14900, NULL, 3)
	ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "billing"."plan_limits" ("plan_id", "key", "int_value", "bool_value") VALUES
	('free', 'members_max', 3, NULL),
	('free', 'ai_entries_month', 100, NULL),
	('free', 'history_months', 6, NULL),
	('free', 'receipt_vision', NULL, false),
	('free', 'ask', NULL, false),
	('free', 'export_beyond_csv', NULL, false),
	('free', 'multi_currency', NULL, false),
	('free', 'remittance_planner', NULL, false),
	('plus', 'members_max', 8, NULL),
	('plus', 'ai_entries_month', 1000, NULL),
	('plus', 'history_months', NULL, NULL),
	('plus', 'receipt_vision', NULL, true),
	('plus', 'ask', NULL, true),
	('plus', 'export_beyond_csv', NULL, true),
	('plus', 'multi_currency', NULL, false),
	('plus', 'remittance_planner', NULL, false),
	('probashi', 'members_max', 8, NULL),
	('probashi', 'ai_entries_month', 1000, NULL),
	('probashi', 'history_months', NULL, NULL),
	('probashi', 'receipt_vision', NULL, true),
	('probashi', 'ask', NULL, true),
	('probashi', 'export_beyond_csv', NULL, true),
	('probashi', 'multi_currency', NULL, true),
	('probashi', 'remittance_planner', NULL, true)
	ON CONFLICT DO NOTHING;
