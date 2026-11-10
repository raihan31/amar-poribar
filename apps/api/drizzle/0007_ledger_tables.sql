DO $$ BEGIN
	CREATE TYPE "ledger"."account_type" AS ENUM('cash', 'bkash', 'nagad', 'rocket', 'upay', 'bank', 'card', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "ledger"."category_kind" AS ENUM('expense', 'income');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "ledger"."txn_source" AS ENUM('manual', 'ai_text', 'sms', 'voice', 'receipt');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "ledger"."txn_type" AS ENUM('expense', 'income', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "ledger"."txn_sync_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
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
DO $$ BEGIN
	ALTER TABLE "ledger"."transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "ledger"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "ledger"."transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "ledger"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_family_seq_idx" ON "ledger"."transactions" USING btree ("family_id","sync_seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_family_time_idx" ON "ledger"."transactions" USING btree ("family_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "txn_family_trx_uidx" ON "ledger"."transactions" USING btree ("family_id","trx_id") WHERE "ledger"."transactions"."trx_id" is not null;