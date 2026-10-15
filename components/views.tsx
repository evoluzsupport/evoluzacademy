'use client';
import { Fragment, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type ViewMode = 'list' | 'grid' | 'group';

/** The chosen view for a page, remembered in this browser. */
export function useView(page: string, fallback: ViewMode = 'list') {
  const key = `evoluzView:${page}`;
  const [mode, setMode] = useState<ViewMode>(fallback);
  const [group, setGroup] = useState('');
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      if (v?.mode) setMode(v.mode);
      if (v?.group) setGroup(v.group);
    } catch {}
  }, [key]);
  const save = (m: ViewMode, g: string) => {
    setMode(m);
    setGroup(g);
    try {
      localStorage.setItem(key, JSON.stringify({ mode: m, group: g }));
    } catch {}
  };
  return { mode, group, setMode: (m: ViewMode) => save(m, group), setGroup: (g: string) => save(mode, g) };
}

export interface Grouper<T> {
  key: string;
  label: string;
  of: (item: T) => string;
}

const MODES: { value: ViewMode; label: string; icon: string }[] = [
  { value: 'list', label: 'List', icon: '☰' },
  { value: 'grid', label: 'Grid', icon: '▦' },
  { value: 'group', label: 'Group by', icon: '▤' },
];

/** List / Grid / Group by switch, with the "group by" field picker when grouping. */
export function ViewSwitch<T>({
  view,
  groupers,
}: {
  view: ReturnType<typeof useView>;
  groupers: Grouper<T>[];
}) {
  const active = groupers.find((g) => g.key === view.group) ?? groupers[0];
  return (
    <div className="vswitch">
      <div className="vseg" role="group" aria-label="View type">
        {MODES.map((m) => (
          <button key={m.value} className={view.mode === m.value ? 'on' : ''} aria-pressed={view.mode === m.value} onClick={() => view.setMode(m.value)} title={`${m.label} view`}>
            <span aria-hidden>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>
      {view.mode === 'group' && (
        <select className="select" aria-label="Group by" value={active.key} onChange={(e) => view.setGroup(e.target.value)}>
          {groupers.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
      )}
    </div>
  );
}

/** Renders `list` as-is, or the items as a card grid, or as card grids under group headings. */
export function ViewBody<T>({
  view,
  items,
  groupers,
  id,
  card,
  list,
  empty,
}: {
  view: ReturnType<typeof useView>;
  items: T[];
  groupers: Grouper<T>[];
  id: (item: T) => string;
  card: (item: T) => ReactNode;
  list: ReactNode;
  empty?: ReactNode;
}) {
  if (view.mode === 'list') return <>{list}</>;
  if (!items.length) return <>{empty ?? null}</>;
  if (view.mode === 'grid') {
    return (
      <div className="cards">
        {items.map((it) => <Fragment key={id(it)}>{card(it)}</Fragment>)}
      </div>
    );
  }
  const g = groupers.find((x) => x.key === view.group) ?? groupers[0];
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const k = g.of(it) || '—';
    buckets.set(k, [...(buckets.get(k) ?? []), it]);
  }
  const keys = [...buckets.keys()].sort((a, b) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)));
  return (
    <div className="vgroups">
      {keys.map((k) => (
        <details className="vgroup" key={k} open>
          <summary>
            <span className="chev">▸</span> {k} <span className="vcount">{buckets.get(k)!.length}</span>
          </summary>
          <div className="cards">
            {buckets.get(k)!.map((it) => <Fragment key={id(it)}>{card(it)}</Fragment>)}
          </div>
        </details>
      ))}
    </div>
  );
}
