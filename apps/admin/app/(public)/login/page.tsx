import { Suspense } from "react";
import type { Metadata } from "next";
import "../../../styles/login.css";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Staff sign-in | Amar Poribar Admin" };

export default function LoginPage() {
  return (
    <div className="login">
      <aside className="login__brand">
        <div>
          <div className="login__name">আমার পরিবার</div>
          <div className="login__sub">Admin console</div>
        </div>
        <p className="login__tag">Staff tools for families, plans and privacy requests. Family data stays private.</p>
      </aside>
      <main className="login__main">
        <div className="login__card">
          <h1>Staff sign-in</h1>
          <p className="login__lead">Only for Amar Poribar staff. Family members sign in on the app.</p>
          <Suspense>
            <SignInForm />
          </Suspense>
          <p className="login__warn" role="note">
            5 wrong tries lock the account for 15 minutes. Every sign-in is recorded in the audit log.
          </p>
        </div>
      </main>
    </div>
  );
}
