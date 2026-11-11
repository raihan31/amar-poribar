import { useQuery } from "@tanstack/react-query";
import { client } from "../client";
import { toProblem } from "../errors";
import { qk } from "../queryKeys";

async function ok<T>(p: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await p;
  if (!response.ok) throw await toProblem(response, error);
  return data as T;
}

export function useCategories(familyId: string) {
  return useQuery({
    queryKey: qk.family(familyId).categories(),
    queryFn: () => ok(client.GET("/v1/families/{familyId}/categories", { params: { path: { familyId } } })),
  });
}

export function useAccounts(familyId: string) {
  return useQuery({
    queryKey: qk.family(familyId).accounts(),
    queryFn: () => ok(client.GET("/v1/families/{familyId}/accounts", { params: { path: { familyId } } })),
  });
}

export function useMembers(familyId: string) {
  return useQuery({
    queryKey: qk.family(familyId).members(),
    queryFn: () => ok(client.GET("/v1/families/{familyId}/members", { params: { path: { familyId } } })),
  });
}
