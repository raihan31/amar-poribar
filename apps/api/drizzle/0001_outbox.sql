CREATE TABLE "platform"."outbox" (
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
CREATE TABLE "platform"."outbox_deliveries" (
	"event_id" uuid NOT NULL,
	"handler" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "outbox_deliveries_event_id_handler_pk" PRIMARY KEY("event_id","handler")
);
--> statement-breakpoint
ALTER TABLE "platform"."outbox_deliveries" ADD CONSTRAINT "outbox_deliveries_event_id_outbox_id_fk" FOREIGN KEY ("event_id") REFERENCES "platform"."outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_status_next_attempt_idx" ON "platform"."outbox" USING btree ("status","next_attempt_at");