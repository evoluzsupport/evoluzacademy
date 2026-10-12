'use client';
import type { ReactNode } from 'react';
import { usePortal } from '@/lib/store';
import type { Kind } from '@/lib/types';
import { initials } from '@/lib/util';

export const Avatar = ({ name, tone = '' }: { name: string; tone?: string }) => (
  <div className={`avatar ${tone}`}>{initials(name)}</div>
);

export const Pill = ({ kind = 'neutral', children }: { kind?: string; children: ReactNode }) => (
  <span className={`pill ${kind}`}>{children}</span>
);

export const ProgressBar = ({ pct }: { pct: number }) => (
  <div className="progressline">
    <div className="track">
      <i style={{ width: `${pct}%` }} />
    </div>
    <span className="pct">{pct}%</span>
  </div>
);

export function PageHead({
  title,
  desc,
  actions,
  back,
}: {
  title: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{back ?? 'Evoluz Academy · Training management'}</div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export const Stat = ({ label, icon, children, note }: { label: string; icon?: string; children: ReactNode; note?: ReactNode }) => (
  <div className="card stat">
    <div className="stat-top">
      {label} {icon && <span className="stat-icon">{icon}</span>}
    </div>
    <div className="stat-num">{children}</div>
    {note && <div className="stat-note">{note}</div>}
  </div>
);

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export const SectionTitle = ({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) => (
  <div className="section-title">
    <div>
      <h3>{title}</h3>
      {sub && <span className="subtle">{sub}</span>}
    </div>
    {right}
  </div>
);

export function Modal() {
  const { modal, closeModal } = usePortal();
  if (!modal) return null;
  return (
    <div
      className="modal-back"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" style={modal.wide ? { width: 'min(720px,100%)', maxHeight: '92vh', overflow: 'auto' } : { maxHeight: '92vh', overflow: 'auto' }}>
        {modal.content}
      </div>
    </div>
  );
}

export function Toast() {
  const { toastMsg } = usePortal();
  return toastMsg ? (
    <div className="toast" role="status">
      {toastMsg}
    </div>
  ) : null;
}

/** Renders children only for the given kinds. */
export function Guard({ kinds, children }: { kinds: Kind[]; children: ReactNode }) {
  const { me } = usePortal();
  if (!me) return null;
  if (!kinds.includes(me.kind))
    return (
      <section className="card empty">
        This page isn’t available for your role.
      </section>
    );
  return <>{children}</>;
}

export const FormActions = ({ onCancel, save = 'Save' }: { onCancel: () => void; save?: string }) => (
  <div className="modal-actions">
    <button type="button" className="btn" onClick={onCancel}>
      Cancel
    </button>
    <button className="btn primary">{save}</button>
  </div>
);

export const COURSE_ICONS = ['✳', '◉', '▦'];
export const COURSE_TONES = ['', 'gold', 'purple'];
