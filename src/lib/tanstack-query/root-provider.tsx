import { QueryCache, QueryClient, type QueryClientConfig, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

const queryClientOptions: QueryClientConfig = {
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.suppressErrorToast) return;

      const message = error instanceof Error ? error.message : "Please try again.";
      toast.error("Something went wrong", { description: message });
    },
  }),
};

export function getContext() {
  const queryClient = new QueryClient(queryClientOptions);
  return { queryClient };
}

export function Provider({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
