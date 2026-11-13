import { cx } from "./cx";
import { Dialog, type DialogProps } from "./Dialog";

/** Bottom sheet: a Dialog pinned to the bottom edge. */
export function Sheet({ className, ...rest }: DialogProps) {
  return <Dialog {...rest} className={cx("ui-sheet", className)} />;
}
