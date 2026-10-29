'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Search,
  X,
  Menu,
  ChevronRight,
  Bell,
  Command,
  ArrowUpRight,
  PanelLeftClose,
} from 'lucide-react';
import { navigation } from '../lib/seed';
import { useWorkspace } from '../lib/store';
import { NavIcon } from './icons';
import { Button } from './ui/button';

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [command, setCommand] = useState(false);
  const [query, setQuery] = useState('');
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { role, theme } = useWorkspace();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setCommand((open) => !open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const links = navigation.filter((item) => !item.admin || (mounted && role === 'administrator'));
  const current = navigation.find((item) => item.href === path);
  const nav = (
    <>
      <Link className="brand" href="/">
        <span className="brand-icon" aria-hidden="true">
          c<span>p</span>
        </span>
        <span className="brand-name">
          citypulse<span className="brand-dot">.</span>
        </span>
      </Link>
      <div className="workspace-choice">
        <span className="workspace-avatar">D</span>
        <span className="nav-copy">
          Demo City<small>Development workspace</small>
        </span>
        <ChevronRight size={14} />
      </div>
      <nav aria-label="Workspace">
        {links.map((item, i) => (
          <div key={item.href}>
            {(i === 0 || links[i - 1].group !== item.group) && (
              <p className="nav-group">{item.group}</p>
            )}
            <Link
              href={item.href}
              onClick={() => setMobile(false)}
              className={`nav-link ${path === item.href ? 'active' : ''}`}
              aria-current={path === item.href ? 'page' : undefined}
              title={item.label}
            >
              <NavIcon name={item.icon} />
              <span className="nav-copy">{item.label}</span>
              {item.href === '/predictions' && <span className="nav-tag">AI</span>}
            </Link>
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <p className="eyebrow">BUILT FOR EXPLORATION</p>
        <p>
          Synthetic data.
          <br />
          Real possibilities.
        </p>
        <Link href="/help">
          Meet your workspace <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="persona">
        <span className="avatar">JD</span>
        <span className="nav-copy">
          Demo {mounted && role === 'administrator' ? 'Admin' : 'Analyst'}
          <small>Local preview</small>
        </span>
      </div>
    </>
  );
  return (
    <div
      className={`app-shell ${collapsed ? 'collapsed' : ''}`}
      data-theme={mounted ? theme : 'dark'}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">{nav}</aside>
      <Dialog.Root open={mobile} onOpenChange={setMobile}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="mobile-sidebar">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Choose a workspace page</Dialog.Description>
            <Dialog.Close className="icon-button close-menu" aria-label="Close navigation">
              <X size={20} />
            </Dialog.Close>
            {nav}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button desktop-collapse"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <PanelLeftClose size={18} />
            </button>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{current?.label ?? 'Overview'}</strong>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setCommand(true)}>
              <Search size={15} />
              <span>Search anything…</span>
              <kbd aria-hidden="true">⌘ K</kbd>
            </button>
            <span className="sample-pill">
              <i />
              Sample data
            </span>
            <Link href="/notifications" className="icon-button" aria-label="Notifications">
              <Bell size={18} />
            </Link>
            <Link href="/settings" className="avatar" aria-label="JD profile and settings">
              JD
            </Link>
          </div>
        </header>
        {children}
      </div>
      <Dialog.Root open={command} onOpenChange={setCommand}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="command-dialog">
            <Dialog.Title>
              <Command size={20} /> Jump to a workspace
            </Dialog.Title>
            <Dialog.Description>
              Search pages. Use Tab to navigate results and Enter to open.
            </Dialog.Description>
            <label className="sr-only" htmlFor="command-search">
              Search pages
            </label>
            <input
              id="command-search"
              autoFocus
              placeholder="Type a page name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="command-results">
              {links
                .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
                .map((item) => (
                  <button
                    key={item.href}
                    onClick={() => {
                      router.push(item.href);
                      setCommand(false);
                      setQuery('');
                    }}
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                    <ChevronRight size={15} />
                  </button>
                ))}
              {!links.some((item) => item.label.toLowerCase().includes(query.toLowerCase())) && (
                <p>No matching pages. Try “city” or “reports”.</p>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost">Close palette · Esc</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
