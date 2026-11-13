import postgres from "postgres";
import { DEMO_MEMBERS, fetchClient, seedDemoFamily } from "@amar-poribar/fixtures";

const apiUrl = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? "4000"}`;
const fakesUrl = process.env.FAKES_URL ?? "http://localhost:4100";
const databaseUrl = process.env.DATABASE_URL ?? "postgres://amar:amar@localhost:5432/amar_poribar";
const out = (s: string) => process.stdout.write(`${s}\n`);

const api = fetchClient(apiUrl, fakesUrl);
const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
// The demo family has five members; the Free plan allows three, and no API changes plans yet (FR-FAM-10).
const prepareFamily = async (familyId: string) => {
  await sql`update families.families set member_limit = ${DEMO_MEMBERS.length} where id = ${familyId}`;
};
const result = await seedDemoFamily(api, { prepareFamily })
  .catch((e: unknown) => {
    console.error(`seed:dev failed against ${apiUrl}. Is the API running (docker compose up)?`);
    throw e;
  })
  .finally(() => sql.end());

out(
  result.created
    ? `Created the demo family "${result.family.name}".`
    : `Demo family "${result.family.name}" already exists; nothing to do.`,
);
out("Dev login (phone, role):");
for (const m of DEMO_MEMBERS) out(`  ${m.phone}  ${m.name} (${m.role})`);
out("OTP is shown in the fake SMS list at http://localhost:4100/sms/messages");
