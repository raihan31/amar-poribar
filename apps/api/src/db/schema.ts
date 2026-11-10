// `accounts`, `categories` and `transactions` (and their enums and the sync sequence) are owned by the ledger
// module (T-PLAT-25). They are re-exported so the legacy tables below and the unmoved routes keep working.
export {
  accounts,
  accountTypeEnum,
  bumpSyncSeq,
  categories,
  categoryKindEnum,
  transactions,
  txnSourceEnum,
  txnSyncSeq,
  txnTypeEnum,
} from "../modules/ledger/schema.js";

// `users` is owned by the identity module (T-PLAT-23); re-exported so the legacy tables below keep their foreign keys.
export { users } from "../modules/identity/schema.js";

// `families`, `family_members` and `family_invites` are owned by the families module (T-PLAT-24). Only the
// `families` table is re-exported, so the legacy tables below keep their foreign keys and the AI quota lookup.
export { families } from "../modules/families/schema.js";

// `budgets`, `festival_budgets` (T-PLAT-26), `recurring_templates` (T-PLAT-27) and the AI tables (T-PLAT-28) are owned by their modules.
