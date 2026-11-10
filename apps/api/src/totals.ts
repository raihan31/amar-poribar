// Month totals live in modules/ledger (T-PLAT-25). Unmoved routes call `ctx.facades.ledger.monthTotals`;
// this file only keeps the type importable until they move (T-PLAT-26..30).
export type { MonthTotals } from "./modules/ledger/index.js";
