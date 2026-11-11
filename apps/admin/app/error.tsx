"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main role="alert" className="admin-placeholder">
      <h1>Something went wrong</h1>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
