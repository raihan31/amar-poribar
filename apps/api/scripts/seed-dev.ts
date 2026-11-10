import { DEMO_MEMBERS, fetchClient, seedDemoFamily } from "@amar-poribar/fixtures";

const apiUrl = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? "4000"}`;
const fakesUrl = process.env.FAKES_URL ?? "http://localhost:4100";
const out = (s: string) => process.stdout.write(`${s}\n`);

const api = fetchClient(apiUrl, fakesUrl);
const result = await seedDemoFamily(api).catch((e: unknown) => {
  console.error(`seed:dev failed against ${apiUrl}. Is the API running (docker compose up)?`);
  throw e;
});

out(
  result.created
    ? `Created the demo family "${result.family.name}".`
    : `Demo family "${result.family.name}" already exists; nothing to do.`,
);
out("Dev login (phone, role):");
for (const m of DEMO_MEMBERS) out(`  ${m.phone}  ${m.name} (${m.role})`);
out("OTP is shown in the fake SMS list at http://localhost:4100/sms/messages");
