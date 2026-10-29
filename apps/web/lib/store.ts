'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSyncExternalStore } from 'react';
type WorkspaceState = {
  district: string;
  period: string;
  theme: 'dark' | 'light';
  role: 'analyst' | 'administrator';
  saved: { district: string; period: string } | null;
  readIds: string[];
  setDistrict: (value: string) => void;
  setPeriod: (value: string) => void;
  setTheme: (value: 'dark' | 'light') => void;
  setRole: (value: 'analyst' | 'administrator') => void;
  save: () => void;
  restore: () => void;
  markRead: (id: string) => void;
};
export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      district: 'all',
      period: '14',
      theme: 'dark',
      role: 'analyst',
      saved: null,
      readIds: [],
      setDistrict: (district) => set({ district }),
      setPeriod: (period) => set({ period }),
      setTheme: (theme) => set({ theme }),
      setRole: (role) => set({ role }),
      save: () => set({ saved: { district: get().district, period: get().period } }),
      restore: () => {
        const saved = get().saved;
        if (saved) set(saved);
      },
      markRead: (id) => set({ readIds: [...new Set([...get().readIds, id])] }),
    }),
    { name: 'citypulse-workspace-v1', skipHydration: true },
  ),
);

const subscribeHydration = (notify: () => void) => {
  const start = useWorkspace.persist.onHydrate(notify);
  const finish = useWorkspace.persist.onFinishHydration(notify);
  return () => {
    start();
    finish();
  };
};
export function useWorkspaceReady() {
  return useSyncExternalStore(
    subscribeHydration,
    () => useWorkspace.persist.hasHydrated(),
    () => false,
  );
}
