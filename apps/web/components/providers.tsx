'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { useWorkspace } from '../lib/store';
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useWorkspace.persist.rehydrate();
  }, []);
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
