'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/button';
export function SessionControls() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const status = useQuery({
    queryKey: ['security-session'],
    queryFn: async () => {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!response.ok) throw new Error('Session service unavailable');
      return response.json() as Promise<{ authenticated: boolean; configured: boolean }>;
    },
    retry: false,
  });
  return (
    <div>
      <p>
        {status.isLoading
          ? 'Checking authenticated session…'
          : status.data?.authenticated
            ? 'Authenticated organization session'
            : status.data?.configured
              ? 'Not signed in to the configured provider'
              : 'Local preview; no organization session configured'}
      </p>
      {status.data?.authenticated && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const response = await fetch('/api/auth/logout', { method: 'POST' });
              if (!response.ok) throw new Error('Server logout could not be confirmed');
              window.location.assign('/login');
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          Sign out of CityPulse
        </Button>
      )}
      {(error || status.isError) && (
        <p role="alert">
          {error || 'Session service unavailable. Protected API calls fail closed.'}
        </p>
      )}
    </div>
  );
}
