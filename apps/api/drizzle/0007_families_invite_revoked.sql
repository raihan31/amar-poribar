ALTER TABLE "families"."family_invites" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;
