CREATE TABLE "platform"."feature_flags" (
	"name" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
