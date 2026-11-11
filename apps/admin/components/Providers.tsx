"use client";

import { useEffect, useState } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loginUrl, notifySessionExpired, onSessionExpired } from "@/lib/api/errors";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (e) => notifySessionExpired(e) }),
    defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: false } },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  useEffect(() => {
    onSessionExpired(() => window.location.assign(loginUrl(window.location.pathname + window.location.search)));
    return () => onSessionExpired(null);
  }, []);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
