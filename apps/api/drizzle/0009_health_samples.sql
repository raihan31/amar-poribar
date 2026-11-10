CREATE TABLE "platform"."health_samples" (
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"key" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "health_samples_key_at_pk" PRIMARY KEY("key","at")
);
