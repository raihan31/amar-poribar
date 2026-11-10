import { randomUUID } from "node:crypto";
// End-to-end smoke test against a running API and a real Postgres.
//   pnpm db:up && pnpm db:migrate && PORT=4177 pnpm --filter @amar-poribar/api dev   (in another terminal)
//   API_URL=http://localhost:4177 node apps/api/scripts/e2e.mjs
// Needs NODE_ENV != production (it logs in with the dev OTP). Creates its own users and family each run.
const BASE = process.env.API_URL ?? "http://localhost:4177";
let pass = 0,
  fail = 0;
const ok = (name, cond, extra) => {
  if (cond) pass++;
  else {
    fail++;
    console.log("FAIL:", name, extra ?? "");
  }
};
async function call(method, path, { token, body, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text };
}
async function login(phone) {
  const r = await call("POST", "/v1/auth/otp/request", { body: { phone } });
  const v = await call("POST", "/v1/auth/otp/verify", { body: { phone, code: r.json.devCode } });
  return v.json.accessToken;
}
const suffix = String(Date.now()).slice(-7);
const A = await login("0171" + suffix),
  B = await login("0181" + suffix),
  C = await login("0191" + suffix);

// family + seed data
const fam = await call("POST", "/v1/families", { token: A, body: { name: "Test পরিবার" } });
ok("create family", fam.status === 201);
const F = fam.json.id;
const cats = (await call("GET", `/v1/families/${F}/categories`, { token: A })).json;
const accs = (await call("GET", `/v1/families/${F}/accounts`, { token: A })).json;
ok("seeded categories/accounts", cats.length > 20 && accs.length === 2);
const bazaar = cats.find((c) => c.key === "bazaar"),
  remit = cats.find((c) => c.key === "remittance"),
  cash = accs[0];

// invites + roles
let inv = await call("POST", `/v1/families/${F}/invites`, { token: A, body: { role: "member" } });
ok("create invite", inv.status === 201 && inv.json.token);
ok(
  "accept invite",
  (await call("POST", `/v1/invites/${inv.json.token}/accept`, { token: B, body: {} })).status === 200,
);
ok(
  "invite is single use",
  (await call("POST", `/v1/invites/${inv.json.token}/accept`, { token: C, body: {} })).status === 404,
);
const invV = await call("POST", `/v1/families/${F}/invites`, { token: A, body: { role: "viewer" } });
ok(
  "viewer joins",
  (await call("POST", `/v1/invites/${invV.json.token}/accept`, { token: C, body: {} })).status === 200,
);
const members = (await call("GET", `/v1/families/${F}/members`, { token: A })).json;
ok("3 members", members.length === 3);
const idOf = (role) => members.find((m) => m.role === role).userId;
const bId = idOf("member");
ok("member cannot invite", (await call("POST", `/v1/families/${F}/invites`, { token: B, body: {} })).status === 403);
ok(
  "owner promotes member to admin",
  (await call("PATCH", `/v1/families/${F}/members/${idOf("member")}`, { token: A, body: { role: "admin" } })).status ===
    200,
);
ok(
  "admin cannot remove owner",
  (await call("DELETE", `/v1/families/${F}/members/${idOf("owner")}`, { token: B })).status === 403,
);
ok(
  "admin cannot make admin",
  (await call("POST", `/v1/families/${F}/invites`, { token: B, body: { role: "admin" } })).status === 403,
);
ok(
  "outsider gets 404",
  (await call("GET", `/v1/families/${F}/members`, { token: await login("0161" + suffix) })).status === 404,
);

// accounts + categories
const na = await call("POST", `/v1/families/${F}/accounts`, {
  token: A,
  body: { name: "Nagad", type: "nagad", ownerUserId: bId },
});
ok("create account", na.status === 201);
ok(
  "owner must be a member",
  (
    await call("POST", `/v1/families/${F}/accounts`, {
      token: A,
      body: { name: "X", type: "cash", ownerUserId: randomUUID() },
    })
  ).status === 400,
);
ok(
  "archive account",
  (await call("PATCH", `/v1/families/${F}/accounts/${na.json.id}`, { token: A, body: { archived: true } })).json
    .archivedAt,
);
ok(
  "archived hidden from list",
  !(await call("GET", `/v1/families/${F}/accounts`, { token: A })).json.some((a) => a.id === na.json.id),
);
ok(
  "includeArchived",
  (await call("GET", `/v1/families/${F}/accounts?includeArchived=true`, { token: A })).json.some(
    (a) => a.id === na.json.id,
  ),
);
const nc = await call("POST", `/v1/families/${F}/categories`, {
  token: A,
  body: { kind: "expense", nameEn: "Pets", nameBn: "পোষা প্রাণী", icon: "🐈" },
});
ok("create category", nc.status === 201 && nc.json.key.startsWith("custom_"));
ok(
  "hide category",
  (await call("PATCH", `/v1/families/${F}/categories/${nc.json.id}`, { token: A, body: { isHidden: true } })).json
    .isHidden === true,
);

// transactions
const now = new Date().toISOString();
const t1 = await call("POST", `/v1/families/${F}/transactions`, {
  token: A,
  body: {
    type: "expense",
    amountPaisa: 85000,
    occurredAt: now,
    categoryId: bazaar.id,
    accountId: cash.id,
    note: "bazaar",
  },
});
ok("create txn with hlc", t1.status === 201 && /Z-[0-9A-F]{4}-server-/.test(t1.json.hlc), t1.text);
const t2 = await call("PATCH", `/v1/families/${F}/transactions/${t1.json.id}`, {
  token: B,
  body: { amountPaisa: 90000, note: "edited by admin" },
});
ok(
  "admin edits others' txn; hlc advances",
  t2.status === 200 && t2.json.amountPaisa === 90000 && t2.json.hlc > t1.json.hlc,
  t2.text,
);
ok(
  "viewer cannot list transactions",
  (await call("GET", `/v1/families/${F}/transactions`, { token: C })).status === 403,
);
ok(
  "viewer cannot export csv",
  (await call("GET", `/v1/families/${F}/reports/export.csv`, { token: C })).status === 403,
);
ok(
  "empty patch rejected",
  (await call("PATCH", `/v1/families/${F}/transactions/${t1.json.id}`, { token: A, body: {} })).status === 400,
);
await call("POST", `/v1/families/${F}/transactions`, {
  token: A,
  body: {
    type: "income",
    amountPaisa: 2000000,
    occurredAt: now,
    categoryId: remit.id,
    counterparty: "Tanvir",
    note: "=cmd|calc",
  },
});
await call("POST", `/v1/families/${F}/transactions`, {
  token: A,
  body: { type: "expense", amountPaisa: 5000, occurredAt: now, isPrivate: true, note: "secret" },
});

// summary + reports
const sum = (await call("GET", `/v1/families/${F}/reports/summary`, { token: B })).json;
ok(
  "summary has previous/byMember/byAccount",
  sum.previous && sum.byMember.length >= 1 && sum.byAccount.length >= 1 && sum.expensePaisa === 90000,
  JSON.stringify(sum),
);
ok("private entry hidden from other member's totals", sum.expensePaisa === 90000);
const sumA = (await call("GET", `/v1/families/${F}/reports/summary`, { token: A })).json;
ok("creator sees own private entry", sumA.expensePaisa === 95000, JSON.stringify(sumA));
const rem = (await call("GET", `/v1/families/${F}/reports/remittances`, { token: C })).json;
ok(
  "remittance report visible to viewer",
  rem.totalRemittancePaisa === 2000000 && rem.bySender[0].name === "Tanvir" && rem.months.length === 6,
  JSON.stringify(rem),
);
const csv = await call("GET", `/v1/families/${F}/reports/export.csv`, { token: A });
const rawCsv = new Uint8Array(
  await (
    await fetch(BASE + `/v1/families/${F}/reports/export.csv`, { headers: { authorization: `Bearer ${A}` } })
  ).arrayBuffer(),
);
ok("csv starts with UTF-8 BOM", rawCsv[0] === 0xef && rawCsv[1] === 0xbb && rawCsv[2] === 0xbf);
ok(
  "csv header, formula guard and exact amounts",
  csv.text.startsWith("Date,Type") && csv.text.includes("'=cmd|calc") && csv.text.includes("900.00"),
);

// budgets
const month = now.slice(0, 7);
const put = await call("PUT", `/v1/families/${F}/budgets?month=${month}`, {
  token: A,
  body: {
    budgets: [
      { categoryId: bazaar.id, limitPaisa: 100000 },
      { categoryId: null, limitPaisa: 5000000 },
    ],
  },
});
ok("put budgets", put.status === 200 && put.json.updated === 2, put.text);
let bud = (await call("GET", `/v1/families/${F}/budgets?month=${month}`, { token: B })).json.budgets;
const bz = bud.find((b) => b.categoryId === bazaar.id);
ok("budget level warning at 90%", bz.level === "warning" && bz.spentPaisa === 90000, JSON.stringify(bud));
ok(
  "overall budget present",
  bud.some((b) => b.categoryId === null && b.limitPaisa === 5000000),
);
await call("PUT", `/v1/families/${F}/budgets?month=${month}`, {
  token: A,
  body: { budgets: [{ categoryId: null, limitPaisa: 6000000 }] },
});
bud = (await call("GET", `/v1/families/${F}/budgets?month=${month}`, { token: B })).json.budgets;
ok(
  "overall budget updated, not duplicated",
  bud.filter((b) => b.categoryId === null).length === 1 &&
    bud.find((b) => b.categoryId === null).limitPaisa === 6000000,
  JSON.stringify(bud),
);
const [y, m] = month.split("-").map(Number);
const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
bud = (await call("GET", `/v1/families/${F}/budgets?month=${nextMonth}`, { token: B })).json.budgets;
ok("budgets carry forward", bud.length === 2 && bud.every((b) => b.inherited));
ok(
  "member cannot set budgets",
  (
    await call("PUT", `/v1/families/${F}/budgets?month=${month}`, {
      token: C,
      body: { budgets: [{ categoryId: null, limitPaisa: 1 }] },
    })
  ).status === 403,
);

// festival + recurring
const fb = await call("POST", `/v1/families/${F}/festival-budgets`, {
  token: A,
  body: { name: "Eid", startsOn: now.slice(0, 10), endsOn: now.slice(0, 10), limitPaisa: 100000 },
});
ok("festival create", fb.status === 201, fb.text);
const fl = (await call("GET", `/v1/families/${F}/festival-budgets`, { token: B })).json;
ok("festival spend and level", fl[0].spentPaisa === 90000 + 0 && fl[0].level === "warning", JSON.stringify(fl));
ok(
  "festival range validated",
  (
    await call("PATCH", `/v1/families/${F}/festival-budgets/${fb.json.id}`, {
      token: A,
      body: { endsOn: "2000-01-01" },
    })
  ).status === 400,
);
const rc = await call("POST", `/v1/families/${F}/recurring`, {
  token: A,
  body: {
    name: "House rent",
    amountPaisa: 1200000,
    dayOfMonth: 31,
    startsOn: "2026-01-01",
    categoryId: cats.find((c) => c.key === "rent").id,
  },
});
ok("recurring create", rc.status === 201, rc.text);
const dr = (await call("GET", `/v1/families/${F}/recurring/drafts?month=${month}`, { token: B })).json;
ok("recurring draft due", dr.drafts.length === 1);
ok(
  "recurring confirm once",
  (await call("POST", `/v1/families/${F}/recurring/${rc.json.id}/confirm?month=${month}`, { token: B, body: {} }))
    .status === 201,
);
ok(
  "recurring second confirm 409",
  (await call("POST", `/v1/families/${F}/recurring/${rc.json.id}/confirm?month=${month}`, { token: B, body: {} }))
    .status === 409,
);
ok(
  "recurring draft gone",
  (await call("GET", `/v1/families/${F}/recurring/drafts?month=${month}`, { token: B })).json.drafts.length === 0,
);
ok("reminders endpoint", (await call("GET", `/v1/families/${F}/recurring/reminders`, { token: B })).status === 200);

// ai without key
ok(
  "ask unavailable without key",
  (await call("POST", `/v1/families/${F}/ai/ask`, { token: A, body: { question: "hi" } })).status === 503,
);
ok(
  "receipt unavailable without key",
  (
    await call("POST", `/v1/families/${F}/ai/receipt`, {
      token: A,
      body: { mediaType: "image/png", imageBase64: "A".repeat(200) },
    })
  ).status === 503,
);
const parsed = await call("POST", `/v1/families/${F}/ai/parse`, { token: A, body: { text: "আজ বাজারে ৮৫০ টাকা" } });
ok("offline quick parse works", parsed.status === 200 && parsed.json.drafts[0]?.amountPaisa === 85000, parsed.text);

// SYNC
const hl = (t, c, n) => `${new Date(t).toISOString()}-${c.toString(16).toUpperCase().padStart(4, "0")}-${n}`;
const T0 = Date.now() - 60_000;
const s1 = randomUUID(),
  s2 = randomUUID(),
  priv = randomUUID(),
  dup = randomUUID();
const base = { type: "expense", feePaisa: 0, occurredAt: now, source: "manual", isPrivate: false };
let r = await call("POST", `/v1/families/${F}/sync`, {
  token: A,
  body: {
    nodeId: "phoneA",
    cursor: null,
    changes: {
      transactions: [
        { ...base, id: s1, amountPaisa: 1000, note: "v1", hlc: hl(T0, 0, "phoneA") },
        { ...base, id: s2, amountPaisa: 2000, trxId: "TRX123", categoryId: bazaar.id, hlc: hl(T0, 1, "phoneA") },
        { ...base, id: priv, amountPaisa: 3000, isPrivate: true, hlc: hl(T0, 2, "phoneA") },
        { ...base, id: dup, amountPaisa: 4000, trxId: "TRX123", hlc: hl(T0, 3, "phoneA") },
        { ...base, id: randomUUID(), amountPaisa: 5000, categoryId: randomUUID(), hlc: hl(T0, 4, "phoneA") },
        { id: "garbage" },
      ],
    },
  },
});
ok("sync push applied 3", r.status === 200 && r.json.applied === 3, r.text);
ok(
  "sync rejects dup trxId, foreign category and garbage",
  r.json.rejected
    .map((x) => x.reason)
    .sort()
    .join() === "duplicate_trx_id,invalid,unknown_reference",
  JSON.stringify(r.json.rejected),
);
// B pulls everything
r = await call("POST", `/v1/families/${F}/sync`, {
  token: B,
  body: { nodeId: "phoneB", cursor: null, changes: { transactions: [] } },
});
const ids = r.json.changes.transactions.map((t) => t.id);
ok(
  "B receives pushed rows, not A's private one",
  ids.includes(s1) && ids.includes(s2) && !ids.includes(priv),
  JSON.stringify(ids),
);
ok("B also receives REST-made rows with hlc", ids.includes(t1.json.id));
ok("numeric cursor returned", /^\d+$/.test(r.json.cursor));
const mark = r.json.cursor;
// B edits s1 newer; A pushes an OLDER edit afterwards -> must lose
await call("POST", `/v1/families/${F}/sync`, {
  token: B,
  body: {
    nodeId: "phoneB",
    cursor: mark,
    changes: {
      transactions: [{ ...base, id: s1, amountPaisa: 7777, note: "B newer", hlc: hl(T0 + 5000, 0, "phoneB") }],
    },
  },
});
// B is a different user than creator A but is admin, so allowed.
r = await call("POST", `/v1/families/${F}/sync`, {
  token: A,
  body: {
    nodeId: "phoneA",
    cursor: mark,
    changes: {
      transactions: [{ ...base, id: s1, amountPaisa: 1111, note: "A older", hlc: hl(T0 + 1000, 0, "phoneA") }],
    },
  },
});
ok("older edit does not overwrite", r.json.applied === 0, r.text);
ok(
  "A pulls B's newer edit",
  r.json.changes.transactions.some((t) => t.id === s1 && t.amountPaisa === 7777),
);
// replay is idempotent
const again = await call("POST", `/v1/families/${F}/sync`, {
  token: B,
  body: {
    nodeId: "phoneB",
    cursor: null,
    changes: {
      transactions: [{ ...base, id: s1, amountPaisa: 7777, note: "B newer", hlc: hl(T0 + 5000, 0, "phoneB") }],
    },
  },
});
ok("replaying same change applies nothing", again.json.applied === 0);
// offline entry with an HLC older than the cursor must still be delivered
const old = randomUUID();
await call("POST", `/v1/families/${F}/sync`, {
  token: B,
  body: {
    nodeId: "phoneB",
    cursor: null,
    changes: { transactions: [{ ...base, id: old, amountPaisa: 42, hlc: hl(T0 - 86400_000, 0, "phoneB") }] },
  },
});
r = await call("POST", `/v1/families/${F}/sync`, {
  token: A,
  body: { nodeId: "phoneA", cursor: mark, changes: { transactions: [] } },
});
ok(
  "entry with old HLC is still delivered after the cursor",
  r.json.changes.transactions.some((t) => t.id === old),
  r.text.slice(0, 200),
);
// tombstone
await call("POST", `/v1/families/${F}/sync`, {
  token: B,
  body: {
    nodeId: "phoneB",
    cursor: null,
    changes: {
      transactions: [
        {
          ...base,
          id: s2,
          amountPaisa: 2000,
          trxId: "TRX123",
          categoryId: bazaar.id,
          deletedAt: now,
          hlc: hl(T0 + 9000, 0, "phoneB"),
        },
      ],
    },
  },
});
r = await call("POST", `/v1/families/${F}/sync`, {
  token: A,
  body: { nodeId: "phoneA", cursor: mark, changes: { transactions: [] } },
});
ok(
  "tombstone reaches other device",
  r.json.changes.transactions.some((t) => t.id === s2 && t.deletedAt),
);
ok(
  "deleted row leaves REST list",
  !(await call("GET", `/v1/families/${F}/transactions`, { token: A })).json.some((t) => t.id === s2),
);
// future clock
r = await call("POST", `/v1/families/${F}/sync`, {
  token: A,
  body: {
    nodeId: "evil",
    cursor: null,
    changes: {
      transactions: [{ ...base, id: randomUUID(), amountPaisa: 1, hlc: hl(Date.now() + 3 * 86400_000, 0, "evil") }],
    },
  },
});
ok("far-future clock rejected", r.status === 400 && r.json.error.code === "clock_drift", r.text);
ok(
  "viewer cannot sync",
  (await call("POST", `/v1/families/${F}/sync`, { token: C, body: { nodeId: "v" } })).status === 403,
);
// REST edit after sync stays ahead of a phone clock that ran ahead
const ahead = randomUUID();
const aheadHlc = hl(Date.now() + 3600_000, 0, "phoneA");
await call("POST", `/v1/families/${F}/sync`, {
  token: A,
  body: {
    nodeId: "phoneA",
    cursor: null,
    changes: { transactions: [{ ...base, id: ahead, amountPaisa: 100, hlc: aheadHlc }] },
  },
});
const edited = await call("PATCH", `/v1/families/${F}/transactions/${ahead}`, { token: A, body: { amountPaisa: 200 } });
ok(
  "REST edit sorts after a phone clock running ahead",
  edited.status === 200 && edited.json.hlc > aheadHlc,
  edited.text,
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
