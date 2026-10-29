'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { useWorkspace } from '../lib/store';
export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useWorkspace((state) => state.theme);
  useEffect(() => {
    void useWorkspace.persist.rehydrate();
  }, []);
  useEffect(() => {
    // Portals and native controls inherit the same tokens as workspace content.
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster theme={theme} richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
