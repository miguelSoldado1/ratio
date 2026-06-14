import { QueryClient, type QueryClientConfig, QueryClientProvider } from "@tanstack/react-query";

const queryClientOptions: QueryClientConfig = {};

export function getContext() {
  const queryClient = new QueryClient(queryClientOptions);
  return { queryClient };
}

export function Provider({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
