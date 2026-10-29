import React from 'react';
import Link from 'next/link';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../components/ui/button';
import { useWorkspace } from '../lib/store';
import { districts } from '../lib/seed';
describe('accessible controls and workspace state', () => {
  it('keeps button semantics and invokes an action', () => {
    const action = vi.fn();
    render(<Button onClick={action}>Save view</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
    expect(action).toHaveBeenCalledOnce();
  });
  it('keeps native link behavior through the shadcn Slot pattern', () => {
    render(
      <Button asChild>
        <Link href="/dashboard">Explore</Link>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('href', '/dashboard');
  });
  it('restores saved filters without changing a demo role', () => {
    useWorkspace.getState().setDistrict('east');
    useWorkspace.getState().save();
    useWorkspace.getState().setDistrict('all');
    useWorkspace.getState().restore();
    expect(useWorkspace.getState().district).toBe('east');
    expect(useWorkspace.getState().role).toBe('analyst');
  });
  it('uses unique sample districts with bounded valid coordinates', () => {
    expect(new Set(districts.map((row) => row.id)).size).toBe(districts.length);
    for (const row of districts) {
      expect(row.latitude).toBeGreaterThanOrEqual(-90);
      expect(row.latitude).toBeLessThanOrEqual(90);
      expect(row.demand).toBeGreaterThanOrEqual(0);
    }
  });
});
