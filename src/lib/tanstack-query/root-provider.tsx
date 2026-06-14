import { QueryCache, QueryClient, type QueryClientConfig, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

const queryClientOptions: QueryClientConfig = {
  queryCache: new QueryCache({
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast.error("Error", { description: message });
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
