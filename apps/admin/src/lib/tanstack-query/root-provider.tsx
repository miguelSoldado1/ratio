import { QueryCache, QueryClient, type QueryClientConfig, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

const queryClientOptions: QueryClientConfig = {
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error("Something went wrong", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  }),
};

export function getContext() {
  return { queryClient: new QueryClient(queryClientOptions) };
}

export function Provider({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
