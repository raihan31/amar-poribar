# Runbook: personal data breach

Applies to any confirmed or suspected loss, leak, or unauthorised access to personal data (SRS §11.4, NFR-07). Checked for existence by `node tools/check-docs.mjs`.

Roles: **incident lead** (the product owner unless delegated), **engineer on call**, **contact for the regulator** (the product owner). Write every decision and time into the incident log (step 4) as you go.

## 1. Detection

Signals to watch:

- **Audit log** (`admin` module, `GET /admin/v1/audit`): staff actions outside working hours, bulk exports, repeated `family.read` on one family, failed 2FA bursts.
- **Health** (`GET /health`, `GET /ready`, `/metrics`): spikes in 401/403 rates, OTP request rate, refresh-token reuse (`session_family_revoked` events), unusual egress or object-storage read counts.
- **Reports** from users or staff (support inbox) and alerts from the hosting provider.

Triage question: is personal data (phone numbers, names, transactions, messages, voice notes, video) possibly exposed to someone who should not have it? If yes or unsure, open an incident and continue. Do not wait for certainty.

## 2. Containment (first hour)

Do the smallest action that stops the exposure, then widen.

1. **Revoke sessions.** All users: `UPDATE identity.sessions SET revoked_at = now() WHERE revoked_at IS NULL;` (run through the DB console, record the row count). One user: add `AND user_id = '<id>'`. Staff: revoke `admin.staff_sessions` and set `locked_until` on affected `admin.staff_users`.
2. **Rotate `JWT_SECRET`.** Generate a new value (`openssl rand -base64 48`), set it in the secret store, redeploy the API. Every access token becomes invalid at once.
3. **Rotate other secrets** that may be exposed: database password (`DATABASE_URL`), object-storage keys, FCM credentials, SMS gateway keys, TURN shared secret.
4. **Disable features** through flags in `FEATURE_FLAGS` (for example `FEATURE_FLAGS=comms.video=off,privacy.export=off`) and redeploy. Pause staff console access if the cause is a staff account.
5. **Block the source** (IP, key, account) at the edge or firewall.
6. **Preserve evidence before changing anything destructive** (step 3).

## 3. Evidence capture

Run from a trusted machine; store output in a restricted folder named `incident-YYYYMMDD/` and record SHA-256 of each file.

```bash
mkdir -p incident-$(date +%Y%m%d) && cd incident-$(date +%Y%m%d)

# application logs for the window (adjust the window and the log source)
docker compose logs --since "2026-01-01T00:00:00" api > api.log
# audit log, hash chain intact? (prev_hash/hash columns)
psql "$DATABASE_URL" -c "\copy (SELECT * FROM admin.audit_log WHERE at >= now() - interval '7 days' ORDER BY at) TO 'audit.csv' CSV HEADER"
# sessions and devices touched in the window
psql "$DATABASE_URL" -c "\copy (SELECT id, user_id, created_at, last_used_at, revoked_at FROM identity.sessions WHERE last_used_at >= now() - interval '7 days') TO 'sessions.csv' CSV HEADER"
# a point-in-time dump for forensics (never restore it over production)
pg_dump "$DATABASE_URL" -Fc -f forensic.dump
sha256sum * > SHA256SUMS
```

Also keep: the deployed image digest, the configuration (secrets removed), and object-storage access logs.

## 4. Assessment

Fill in the incident log: when it started and was found, what data types (phone, name, transaction amounts, messages, media), how many people and families, whether data was readable or encrypted, who may have seen it, and whether it is still happening. Use the audit log and the session export to count affected users.

## 5. PDPO notification

The Personal Data Protection Ordinance 2025 requires notifying the regulator of a breach likely to harm people, and telling the affected people. Confirm the exact deadline and the format against the current text of the Ordinance and any guidance, because this runbook cannot replace legal advice. Working timeline until counsel confirms otherwise:

| When | Action |
|---|---|
| Within 24 hours of confirmation | Incident lead decides whether the harm threshold is met and records the reasoning |
| Within 72 hours of becoming aware | Notify the regulator: what happened, data types and approximate counts, likely consequences, measures taken, contact person |
| As soon as the risk is understood | Tell affected users in Bangla by push and in-app inbox, and by SMS if push is not possible: what happened, what data, what we did, what they should do (for example be careful with calls claiming to be from us) |
| Within 7 days | Send the regulator an update with the final scope and the fix |

Do not send notifications from the incident chat; use the product owner's approved templates. Do not include more personal data in the notification than needed.

## 6. Recovery

- Deploy the fix, confirm with a test that reproduces the original path and now fails.
- Re-enable flags one at a time, watching `/metrics` and the audit log.
- Force a fresh sign-in for all users if sessions were revoked (the app shows its session-expired screen, `F6`).

## 7. Post-incident checklist

- [ ] Incident log complete and stored with the evidence
- [ ] Regulator and affected users notified, copies saved
- [ ] Root cause written in plain words; a regression test or alert added
- [ ] Secrets rotated and old ones revoked everywhere
- [ ] Record of processing (FR-PRIV-07) and privacy policy updated if processing changed
- [ ] Blameless review held within 14 days; follow-up tasks added to the backlog
- [ ] This runbook updated with anything that was unclear or slow
