ALTER TABLE "ledger"."transactions" ADD COLUMN IF NOT EXISTS "to_account_id" uuid;--> statement-breakpoint
ALTER TABLE "ledger"."transactions" DROP CONSTRAINT IF EXISTS "transactions_to_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "ledger"."transactions" ADD CONSTRAINT "transactions_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "ledger"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger"."transactions" DROP CONSTRAINT IF EXISTS "transfer_needs_destination";--> statement-breakpoint
-- NOT VALID: transfers recorded before destinations existed keep their rows; every new or changed row is checked.
ALTER TABLE "ledger"."transactions" ADD CONSTRAINT "transfer_needs_destination" CHECK (("ledger"."transactions"."type" = 'transfer') = ("ledger"."transactions"."to_account_id" is not null)) NOT VALID;
