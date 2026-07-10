import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminQueryKeys } from "@/lib/tanstack-query/query-keys";
import { getAdminAccessState } from "@/server/admin-functions";

export function useAdminAccess() {
  const getAdminAccessStateFn = useServerFn(getAdminAccessState);

  return useQuery({
    queryFn: () => getAdminAccessStateFn(),
    queryKey: adminQueryKeys.access(),
  });
}
