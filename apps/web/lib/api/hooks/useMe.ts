import { useQuery } from "@tanstack/react-query";
import { client } from "../client";
import { toProblem } from "../errors";
import { qk } from "../queryKeys";

export function useMe() {
  return useQuery({
    queryKey: qk.me(),
    queryFn: async () => {
      const { data, error, response } = await client.GET("/v1/me");
      if (!response.ok) throw await toProblem(response, error);
      return data;
    },
  });
}
