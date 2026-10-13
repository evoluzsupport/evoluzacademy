'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { usePortal } from '@/lib/store';
import { attentionItems, scopeTrainees, visibleCourses } from '@/lib/selectors';
import type { Kind } from '@/lib/types';
import { initials } from '@/lib/util';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}
const NAV: Record<Kind, { workspace: NavItem[]; insights: NavItem[] }> = {
  admin: {
    workspace: [
      { href: '/', label: 'Overview', icon: '⌂' },
      { href: '/trainees', label: 'Trainees', icon: '♙' },
      { href: '/trainers', label: 'Trainers', icon: '♧' },
      { href: '/courses', label: 'Courses', icon: '▤' },
      { href: '/assignments', label: 'Ongoing Training Session', icon: '⇄' },
      { href: '/session', label: 'Log a session', icon: '＋' },
      { href: '/sessions', label: 'Session history', icon: '☰' },
    ],
    insights: [
      { href: '/analytics', label: 'Analytics', icon: '◔' },
      { href: '/users', label: 'Users', icon: '⚿' },
    ],
  },
  trainer: {
    workspace: [
      { href: '/', label: 'Overview', icon: '⌂' },
      { href: '/trainees', label: 'My Trainee', icon: '♙' },
      { href: '/my-courses', label: 'My Courses', icon: '▤' },
      { href: '/study', label: 'My Study', icon: '✎' },
      { href: '/session', label: 'Log a session', icon: '＋' },
      { href: '/sessions', label: 'Session history', icon: '☰' },
    ],
    insights: [{ href: '/analytics', label: 'Analytics', icon: '◔' }],
  },
  trainee: {
    workspace: [
      { href: '/', label: 'Overview', icon: '⌂' },
      { href: '/tracker', label: 'My Course', icon: '▤' },
      { href: '/trainers', label: 'My Trainer', icon: '♧' },
      { href: '/study', label: 'My Study', icon: '✎' },
    ],
    insights: [],
  },
};

const ROLE_LABEL: Record<Kind, string> = { admin: 'Training coordinator', trainer: 'Trainer', trainee: 'Trainee' };
const TONES = ['', 'coral', 'mint', 'lilac'];

function Bell() {
  const { S, me, openModal, closeModal } = usePortal();
  const router = useRouter();
  const items = attentionItems(S, scopeTrainees(S, me));
  const open = () =>
    openModal(
      <>
        <h2>Needs attention</h2>
        <p>Overdue courses, trainees on hold, and active trainees with no course.</p>
        <div className="attn">
          {items.length ? (
            items.map((x, i) => (
              <button
                key={i}
                className="attn-item"
                onClick={() => {
                  closeModal();
                  if (me?.kind !== 'trainee') router.push(`/trainees/${x.traineeId}`);
                }}
              >
                <span className={`pill ${x.kind === 'overdue' ? 'overdue' : x.kind === 'hold' ? 'wait' : 'neutral'}`}>
                  {x.kind === 'overdue' ? 'Overdue' : x.kind === 'hold' ? 'On hold' : 'No course'}
                </span>
                <span>
                  <b style={{ fontSize: 12 }}>{x.text}</b>
                  <small className="subtle" style={{ display: 'block' }}>{x.sub}</small>
                </span>
              </button>
            ))
          ) : (
            <div className="empty">Nothing needs attention right now.</div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={closeModal}>Close</button>
        </div>
      </>
    );
  return (
    <button className="bell" title="Notifications" aria-label={`Notifications (${items.length})`} onClick={open}>
      ♧{items.length > 0 && <span className="badge">{items.length}</span>}
    </button>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === 'dark'), []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('evoluzTheme', next ? 'dark' : 'light');
    } catch {}
  };
  return (
    <button className="bell" title={dark ? 'Switch to light mode' : 'Switch to night mode'} aria-label="Toggle night mode" aria-pressed={dark} onClick={flip}>
      {dark ? '☀' : '☾'}
    </button>
  );
}

function ProfileMenu({ tone }: { tone: string }) {
  const { me, logout } = usePortal();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  if (!me) return null;
  return (
    <div className="pmenu" ref={box}>
      <button
        className={`avatar ${TONES.includes(tone) ? tone : 'coral'}`}
        style={{ width: 33, height: 33, borderRadius: '50%', border: 0 }}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
        onClick={() => setOpen((o) => !o)}
      >
        {initials(me.name)}
      </button>
      {open && (
        <div className="pmenu-panel" role="menu">
          <div className="pmenu-who">
            <b>{me.name}</b>
            <small>{me.email}</small>
          </div>
          <Link href="/profile" role="menuitem" onClick={() => setOpen(false)}>My profile</Link>
          <button role="menuitem" onClick={() => { setOpen(false); logout(); router.replace('/login'); }}>Log out</button>
        </div>
      )}
    </div>
  );
}

export default function Frame({ children }: { children: ReactNode }) {
  const { ready, me, S, logout, toast } = usePortal();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isPublic = path === '/login' || path === '/welcome';

  useEffect(() => {
    if (!ready) return;
    if (!me && !isPublic) router.replace('/welcome');
    if (me && isPublic) router.replace('/');
  }, [ready, me, isPublic, router]);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (isPublic) return <>{children}</>;
  if (!ready || !me) return null;

  const nav = NAV[me.kind];
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const current = [...nav.workspace, ...nav.insights, { href: '/profile', label: 'My profile', icon: '' }].find((n) => active(n.href));
  const mine = me.kind === 'trainer' ? S.trainers.find((t) => t.id === me.id)?.tone : me.kind === 'trainee' ? S.trainees.find((t) => t.id === me.id)?.tone : '';

  const search = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const q = e.currentTarget.value.trim().toLowerCase();
    if (!q) return;
    const t = scopeTrainees(S, me).find((x) => (x.name + x.email).toLowerCase().includes(q));
    if (t) return router.push(`/trainees/${t.id}`);
    const c = visibleCourses(S, me).find((x) => x.name.toLowerCase().includes(q));
    if (c) return router.push(`/courses/${c.id}`);
    toast('No trainee or course matches that search');
  };

  const link = (n: NavItem) => (
    <Link key={n.href} href={n.href} className={active(n.href) ? 'active' : ''} aria-current={active(n.href) ? 'page' : undefined}>
      <span className="ico">{n.icon}</span>
      {n.label}
    </Link>
  );

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <Image src="/evoluz-logo.png" alt="Evoluz" width={178} height={47} priority style={{ width: 178, height: 'auto' }} />
          <small>Training academy</small>
        </div>
        <div className="nav-label">Workspace</div>
        <nav className="nav">{nav.workspace.map(link)}</nav>
        {nav.insights.length > 0 && (
          <>
            <div className="nav-label" style={{ marginTop: 17 }}>Insights</div>
            <nav className="nav">{nav.insights.map(link)}</nav>
          </>
        )}
        <div className="side-bottom">
          <div className="tip">
            <strong>Every learner, their own pace</strong>
            <p>Mark topics as they happen. Progress stays individual, even when sessions move.</p>
          </div>
          <div className="profile">
            <Link href="/profile" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <div className={`avatar ${mine ?? ''}`}>{initials(me.name)}</div>
              <div style={{ minWidth: 0 }}>
                <b>{me.name}</b>
                <small>{ROLE_LABEL[me.kind]}</small>
              </div>
            </Link>
            <button className="btn" style={{ padding: '5px 8px' }} onClick={() => { logout(); router.replace('/login'); }} title="Sign out">
              ⎋
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="mobile-menu" aria-label="Menu" onClick={() => setOpen((o) => !o)}>☰</button>
            <div className="crumb">Evoluz Academy <b>{current?.label ?? 'Overview'}</b></div>
          </div>
          <div className="topright">
            {me.kind !== 'trainee' && (
              <label className="search">
                <span>⌕</span>
                <input placeholder="Search trainees, courses..." onKeyDown={search} aria-label="Search" />
              </label>
            )}
            <ThemeToggle />
            <Bell />
            <ProfileMenu tone={mine ?? ''} />
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
