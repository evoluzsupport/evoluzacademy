'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { usePortal } from '@/lib/store';
import { notificationsFor, scopeTrainees, visibleCourses } from '@/lib/selectors';
import type { Kind } from '@/lib/types';
import { initials } from '@/lib/util';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}
const NAV: Record<Kind, { workspace: NavItem[]; insights: NavItem[]; assigned?: NavItem[]; adminOnly?: NavItem[] }> = {
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
    adminOnly: [
      { href: '/assessments', label: 'Assessments', icon: '✎' },
      { href: '/availability', label: 'Availability', icon: '◷' },
      { href: '/integrations', label: 'Integrations', icon: '⚙' },
    ],
  },
  trainer: {
    workspace: [
      { href: '/', label: 'Overview', icon: '⌂' },
      { href: '/trainees', label: 'My Trainee', icon: '♙' },
      { href: '/my-courses', label: 'Assigned Courses', icon: '▤' },
      { href: '/session', label: 'Log a session', icon: '＋' },
      { href: '/sessions', label: 'Session history', icon: '☰' },
    ],
    assigned: [
      { href: '/my-trainer', label: 'My Trainer', icon: '♧' },
      { href: '/assigned-courses', label: 'My Course', icon: '▤' },
    ],
    insights: [{ href: '/analytics', label: 'Analytics', icon: '◔' }],
  },
  trainee: {
    workspace: [
      { href: '/', label: 'Overview', icon: '⌂' },
      { href: '/tracker', label: 'My Course', icon: '▤' },
      { href: '/trainers', label: 'My Trainer', icon: '♧' },
      { href: '/my-assessments', label: 'My Assessments', icon: '✎' },
    ],
    insights: [],
  },
};

const ROLE_LABEL: Record<Kind, string> = { admin: 'Training coordinator', trainer: 'Trainer', trainee: 'Trainee' };
const TONES = ['', 'coral', 'mint', 'lilac'];

const NOTICE_ICON: Record<string, string> = { assigned: '▤', teach: '♧', learn: '▤', overdue: '!', hold: '❚❚', nocourse: '＋' };
const NOTICE_LABEL: Record<string, string> = { assigned: 'New course', teach: 'Teaching', learn: 'Learning', overdue: 'Overdue', hold: 'On hold', nocourse: 'No course' };

const ago = (d?: string) => {
  if (!d) return '';
  const n = Math.floor((Date.now() - new Date(d + 'T00:00').getTime()) / 86400000);
  return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`;
};

function Bell() {
  const { S, me } = usePortal();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const key = `evoluzSeen:${me?.id ?? ''}`;
  const items = notificationsFor(S, me);
  const unread = items.filter((x) => !seen.includes(x.id));

  useEffect(() => {
    try {
      setSeen(JSON.parse(localStorage.getItem(key) || '[]'));
    } catch {}
  }, [key]);
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

  const mark = (ids: string[]) => {
    const next = [...new Set([...seen, ...ids])].slice(-300);
    setSeen(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  const go = (id: string, href: string) => {
    mark([id]);
    setOpen(false);
    router.push(href);
  };

  return (
    <div className="nbox" ref={box}>
      <button className="bell" title="Notifications" aria-label={`Notifications (${unread.length} unread)`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ♧{unread.length > 0 && <span className="badge">{unread.length > 9 ? '9+' : unread.length}</span>}
      </button>
      {open && (
        <div className="npanel" role="dialog" aria-label="Notifications">
          <div className="nhead">
            <div>
              <b>Notifications</b>
              <small>{unread.length ? `${unread.length} new` : 'You are all caught up'}</small>
            </div>
            {unread.length > 0 && <button className="nlink" onClick={() => mark(items.map((x) => x.id))}>Mark all read</button>}
          </div>
          <div className="nlist">
            {items.map((x) => (
              <button key={x.id} className={`nitem ${seen.includes(x.id) ? '' : 'new'}`} onClick={() => go(x.id, x.href)}>
                <span className={`nico n-${x.kind}`}>{NOTICE_ICON[x.kind]}</span>
                <span className="ntext">
                  <b>{x.title}</b>
                  <small>{x.sub}</small>
                  <em>{NOTICE_LABEL[x.kind]}{x.date ? ` · ${ago(x.date)}` : ''}</em>
                </span>
                <span className="narrow">›</span>
              </button>
            ))}
            {!items.length && <div className="empty">Nothing new right now.</div>}
          </div>
        </div>
      )}
    </div>
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
  const { S, me, logout } = usePortal();
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
  // job role: a trainer's specialty or a trainee's role; access: what they can do in the portal
  const jobRole =
    me.kind === 'trainer' ? S.trainers.find((t) => t.id === me.id)?.specialty : me.kind === 'trainee' ? S.trainees.find((t) => t.id === me.id)?.jobRole : '';
  const access = me.kind[0].toUpperCase() + me.kind.slice(1);
  return (
    <div className="pmenu" ref={box}>
      <div className="pmenu-id">
        <b>{me.name}</b>
        <small>{jobRole ? `Role: ${jobRole} · ` : ''}Access: {access}</small>
      </div>
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
            <small>{jobRole ? `Role: ${jobRole} · ` : ''}Access: {access}</small>
          </div>
          <Link href="/profile" role="menuitem" onClick={() => setOpen(false)}>My profile</Link>
          <button role="menuitem" onClick={() => { setOpen(false); logout(); router.replace('/login'); }}>Log out</button>
        </div>
      )}
    </div>
  );
}

export default function Frame({ children }: { children: ReactNode }) {
  const { ready, me, S, logout, toast, congrats, clearCongrats } = usePortal();
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

  // signed in but not added yet: their request is with the admins, nothing else is shown
  if (me.pending)
    return (
      <div className="login-wrap">
        <div className="login-box" style={{ textAlign: 'center' }}>
          <Image src="/evoluz-logo.png" alt="Evoluz" width={190} height={51} priority style={{ width: 190, height: 'auto', margin: '0 auto 6px' }} />
          <h1>Your request has been sent</h1>
          <p className="lead">
            Hi {me.name.split(' ')[0]}, your request for access to Evoluz Academy has been sent. The Evoluz Academy team will review it and reach out to you. Once you are added you will get a
            welcome email and can sign in to start learning.
          </p>
          <p className="lead" style={{ fontSize: 12 }}>Signed in as {me.email}</p>
          <button className="btn primary login-btn" onClick={() => { logout(); router.replace('/login'); }}>Sign out</button>
        </div>
      </div>
    );

  const nav = NAV[me.kind];
  const active = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const current = [...nav.workspace, ...(nav.assigned ?? []), ...nav.insights, ...(nav.adminOnly ?? []), { href: '/profile', label: 'My profile', icon: '' }].find((n) => active(n.href));
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
        {nav.assigned && nav.assigned.length > 0 && (
          <>
            <div className="nav-label" style={{ marginTop: 17 }}>Assigned Items</div>
            <nav className="nav">{nav.assigned.map(link)}</nav>
          </>
        )}
        {nav.insights.length > 0 && (
          <>
            <div className="nav-label" style={{ marginTop: 17 }}>Insights</div>
            <nav className="nav">{nav.insights.map(link)}</nav>
          </>
        )}
        {nav.adminOnly && nav.adminOnly.length > 0 && (
          <>
            <div className="nav-label" style={{ marginTop: 17 }}>Admin</div>
            <nav className="nav">{nav.adminOnly.map(link)}</nav>
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
        <div className="content">
          {congrats && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#eaf7f1', border: '1px solid #bfe6d6', color: '#14684f', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
              <span>🎉 {congrats}</span>
              <button className="btn" onClick={clearCongrats}>Dismiss</button>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
