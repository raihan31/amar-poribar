import type { ReactNode } from "react";
import { Banner } from "@/components/ui/Banner";

/** A7 banner: icon, bold title, optional body. Rendered with role="alert". */
export function OtpErrorBanner({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Banner tone="danger">
      <p className="auth__banner-title">{title}</p>
      {children ? <p style={{ margin: 0 }}>{children}</p> : null}
    </Banner>
  );
}
