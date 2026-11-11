CREATE TABLE IF NOT EXISTS "identity"."devices" (
	"user_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"platform" text NOT NULL,
	"fcm_token" text,
	"app_version" text,
	"locale" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_user_id_device_id_pk" PRIMARY KEY("user_id","device_id")
);
