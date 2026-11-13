/** A bill is due (emitted by the reminder job, T-REC-02). Carries the amount because events are internal. */
export interface BillDuePayload {
  familyId: string;
  templateId: string;
  name: string;
  dueDate: string;
  amountPaisa: number;
}

declare module "../../platform/events/types.js" {
  interface EventMap {
    "recurring.BillDue.v1": BillDuePayload;
  }
}
