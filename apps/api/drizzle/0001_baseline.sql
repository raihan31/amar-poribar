DO $$ BEGIN
	CREATE TYPE "families"."role" AS ENUM('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "ledger"."account_type" AS ENUM('cash', 'bkash', 'nagad', 'rocket', 'upay', 'bank', 'card', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "ledger"."category_kind" AS ENUM('expense', 'income');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "ledger"."txn_source" AS ENUM('manual', 'ai_text', 'sms', 'voice', 'receipt');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "ledger"."txn_type" AS ENUM('expense', 'income', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "ledger"."txn_sync_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budgeting"."budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"category_id" uuid,
	"month" text NOT NULL,
	"limit_paisa" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budgeting"."festival_budgets" (
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
CREATE TABLE IF NOT EXISTS "families"."families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'BDT' NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"ai_quota_month" integer DEFAULT 100 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "families"."family_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"token" text NOT NULL,
	"role" "families"."role" DEFAULT 'member' NOT NULL,
	"phone" text,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "families"."family_members" (
	"family_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "families"."role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_members_family_id_user_id_pk" PRIMARY KEY("family_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"locale" text DEFAULT 'bn' NOT NULL,
	"bn_digits" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "ledger"."account_type" NOT NULL,
	"owner_user_id" uuid,
	"opening_balance_paisa" bigint DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" "ledger"."category_kind" NOT NULL,
	"name_en" text NOT NULL,
	"name_bn" text NOT NULL,
	"icon" text,
	"is_hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger"."transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"type" "ledger"."txn_type" NOT NULL,
	"amount_paisa" bigint NOT NULL,
	"fee_paisa" bigint DEFAULT 0 NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"category_id" uuid,
	"account_id" uuid,
	"paid_by_user_id" uuid,
	"note" text,
	"counterparty" text,
	"trx_id" text,
	"source" "ledger"."txn_source" DEFAULT 'manual' NOT NULL,
	"ai_confidence" real,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"hlc" text DEFAULT '' NOT NULL,
	"sync_seq" bigint DEFAULT nextval('ledger.txn_sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurring"."recurring_templates" (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."feature_flags" (
	"name" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."health_samples" (
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "health_samples_key_at_pk" PRIMARY KEY("key","at")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."health_checks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."realtime_payloads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"family_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform"."outbox_deliveries" (
	"event_id" uuid NOT NULL,
	"handler" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "outbox_deliveries_event_id_handler_pk" PRIMARY KEY("event_id","handler")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "families"."family_invites" ADD CONSTRAINT "family_invites_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "families"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "families"."family_members" ADD CONSTRAINT "family_members_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "families"."families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "ledger"."transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "ledger"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "ledger"."transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "ledger"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "platform"."outbox_deliveries" ADD CONSTRAINT "outbox_deliveries_event_id_outbox_id_fk" FOREIGN KEY ("event_id") REFERENCES "platform"."outbox"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budget_family_cat_month_uidx" ON "budgeting"."budgets" USING btree ("family_id","category_id","month");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_family_seq_idx" ON "ledger"."transactions" USING btree ("family_id","sync_seq");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_family_time_idx" ON "ledger"."transactions" USING btree ("family_id","occurred_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "txn_family_trx_uidx" ON "ledger"."transactions" USING btree ("family_id","trx_id") WHERE "ledger"."transactions"."trx_id" is not null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_status_next_attempt_idx" ON "platform"."outbox" USING btree ("status","next_attempt_at");
