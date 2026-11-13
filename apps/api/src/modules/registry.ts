import type { ModuleDefinition } from "../platform/module.js";
// <imports>
import { identityModule } from "./identity/index.js";
import { familiesModule } from "./families/index.js";
import { billingModule } from "./billing/index.js";
import { ledgerModule } from "./ledger/index.js";
import { budgetingModule } from "./budgeting/index.js";
import { recurringModule } from "./recurring/index.js";
import { aiModule } from "./ai/index.js";
import { reportingModule } from "./reporting/index.js";
import { syncModule } from "./sync/index.js";
import { notificationsModule } from "./notifications/index.js";
import { commsModule } from "./comms/index.js";
import { shoppingModule } from "./shopping/index.js";
import { lendingModule } from "./lending/index.js";
import { privacyModule } from "./privacy/index.js";
import { adminModule } from "./admin/index.js";
// </imports>

/**
 * Every module, in dependency order (SRS §3.3). This is the only list of modules (SRS R8).
 * New modules are added by `pnpm gen:module`.
 */
export const modules: readonly ModuleDefinition[] = [
  // <modules>
  identityModule,
  familiesModule,
  billingModule,
  ledgerModule,
  budgetingModule,
  recurringModule,
  aiModule,
  reportingModule,
  syncModule,
  notificationsModule,
  commsModule,
  shoppingModule,
  lendingModule,
  privacyModule,
  adminModule,
  // </modules>
];
