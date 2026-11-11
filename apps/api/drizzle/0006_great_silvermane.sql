CREATE TABLE IF NOT EXISTS "notifications"."delivery_stats" (
	"day" date NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"ok" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "delivery_stats_day_channel_kind_pk" PRIMARY KEY("day","channel","kind")
);
