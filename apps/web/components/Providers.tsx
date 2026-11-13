"use client";

import { useEffect, useState } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { ApiProblem, notifySessionExpired, onSessionExpired } from "@/lib/api/errors";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (e) => notifySessionExpired(e) }),
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        // Retry once for network errors only; an ApiProblem (any HTTP status) is never retried.
        retry: (count, error) => !(error instanceof ApiProblem) && count < 1,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    onSessionExpired(() => router.replace(`/session-expired?next=${encodeURIComponent(pathname ?? "/")}`));
    return () => onSessionExpired(null);
  }, [router, pathname]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
