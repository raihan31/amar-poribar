// Usage: node scripts/pwa-check.mjs [baseUrl]   (run against `next start`)
const base = process.argv[2] ?? process.env.PWA_BASE_URL ?? "http://localhost:3000";
const problems = [];

const mRes = await fetch(`${base}/manifest.webmanifest`).catch((e) => ({ ok: false, status: String(e) }));
if (!mRes.ok) problems.push(`manifest.webmanifest not served (${mRes.status})`);
else {
  const m = await mRes.json();
  for (const k of ["name", "short_name", "start_url", "display", "theme_color", "background_color", "icons"]) {
    if (!m[k] || (Array.isArray(m[k]) && m[k].length === 0)) problems.push(`manifest missing ${k}`);
  }
  if (m.display !== "standalone") problems.push("manifest display must be standalone");
  if (m.theme_color?.toLowerCase() !== "#1b5e20") problems.push("manifest theme_color must be #1B5E20");
  const sizes = (m.icons ?? []).map((i) => i.sizes);
  for (const s of ["192x192", "512x512"]) if (!sizes.includes(s)) problems.push(`manifest missing ${s} icon`);
  if (!(m.icons ?? []).some((i) => i.purpose === "maskable")) problems.push("manifest missing maskable icon");
  for (const i of m.icons ?? []) {
    const r = await fetch(new URL(i.src, base));
    if (!r.ok) problems.push(`icon ${i.src} not served (${r.status})`);
  }
}

const sRes = await fetch(`${base}/sw.js`).catch((e) => ({ ok: false, status: String(e), headers: new Headers() }));
if (!sRes.ok) problems.push(`sw.js not served (${sRes.status})`);
else if (!/javascript/.test(sRes.headers.get("content-type") ?? ""))
  problems.push("sw.js has a non-JavaScript content type");

const oRes = await fetch(`${base}/offline`).catch((e) => ({ ok: false, status: String(e) }));
if (!oRes.ok) problems.push(`/offline not served (${oRes.status})`);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("pwa-check ok");
