// Module boundary rules (SRS §3.4, R1-R9). Run with `pnpm arch`.
// ARCH_ROOT lets `pnpm arch:negative` point the same rules at tiny violating fixtures.
const root = process.env.ARCH_ROOT ?? "apps/api/src";
const deps = require("./apps/api/src/platform/arch/module-deps.json");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const R = esc(root);

const directionRules = Object.entries(deps).map(([name, allowed]) => {
  const ok = [name, ...allowed].join("|");
  return {
    name: `module-direction-${name}`,
    comment: `R2: ${name} may import only the facades of: ${allowed.join(", ") || "(nothing)"}`,
    severity: "error",
    from: { path: `^${R}/modules/${name}/` },
    to: { path: `^${R}/modules/(?!(?:${ok})/)[^/]+/` },
  };
});

module.exports = {
  forbidden: [
    {
      name: "no-cross-module-internals",
      comment: "R1: other modules may import only a module's index.ts",
      severity: "error",
      from: { path: `^${R}/modules/([^/]+)/` },
      to: { path: `^${R}/modules/[^/]+/(?!index\\.ts$)`, pathNot: `^${R}/modules/$1/` },
    },
    { name: "no-circular", comment: "R2: no import cycles", severity: "error", from: {}, to: { circular: true } },
    ...directionRules,
    {
      name: "schema-not-exported",
      comment: "R3: only the module's own infra (and its schema.ts) may import schema.ts",
      severity: "error",
      from: { path: `^${R}/modules/([^/]+)/`, pathNot: `^${R}/modules/[^/]+/(schema\\.ts|infra/|.*\\.test\\.ts)` },
      to: { path: `^${R}/modules/[^/]+/schema\\.ts$` },
    },
    {
      name: "admin-staff-safe-only",
      comment:
        "R6/DEC-18: admin may import only modules/<m>/index.ts for m in families, billing, privacy (platform lives outside modules/)",
      severity: "error",
      from: { path: `^${R}/modules/admin/` },
      to: {
        path: `^${R}/modules/[^/]+/`,
        pathNot: [`^${R}/modules/admin/`, `^${R}/modules/(families|billing|privacy)/index\\.ts$`],
      },
    },
    {
      name: "composition-allowed",
      comment: "R2: composition/* may import any module's facade (index.ts) but never its internals",
      severity: "error",
      from: { path: `^${R}/composition/` },
      to: { path: `^${R}/modules/[^/]+/(?!index\\.ts$)` },
    },
    {
      name: "domain-pure",
      comment: "R7: domain code does no I/O",
      severity: "error",
      from: { path: `^${R}/modules/[^/]+/domain/` },
      to: { path: ["node_modules/(drizzle-orm|fastify)/", `^${R}/modules/[^/]+/(infra|http|app)/`] },
    },
    {
      name: "platform-independent",
      comment: "platform code does not know any module",
      severity: "error",
      from: { path: `^${R}/platform/` },
      to: { path: `^${R}/modules/` },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: require("node:path").join(__dirname, "apps/api/tsconfig.json") },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default"] },
    tsPreCompilationDeps: true,
    exclude: { path: ["\\.test\\.ts$", "\\.json$"] },
  },
};
