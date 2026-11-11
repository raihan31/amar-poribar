CREATE TABLE IF NOT EXISTS "identity"."sms_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_hash" text NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now(),
	"delivered_at" timestamp with time zone
);
