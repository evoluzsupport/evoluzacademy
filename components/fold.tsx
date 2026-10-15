'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * One row of a list report that opens downward. The row itself toggles the details; `href` adds an
 * "Open" link that drills into the full page, and `actions` sit to the right without toggling.
 */
export function Fold({
  title,
  meta,
  right,
  actions,
  href,
  hrefLabel = 'Open →',
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  actions?: ReactNode;
  href?: string;
  hrefLabel?: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`fold ${open ? 'open' : ''}`}>
      <div className="fold-head">
        <button className="fold-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="chev">▸</span>
          <span className="fold-title">
            <b>{title}</b>
            {meta && <small>{meta}</small>}
          </span>
        </button>
        {right && <div className="fold-right">{right}</div>}
        <div className="fold-actions">
          {actions}
          {href && <Link className="btn soft" href={href}>{hrefLabel}</Link>}
        </div>
      </div>
      {open && <div className="fold-body">{children}</div>}
    </div>
  );
}

/** Expand/collapse every Fold inside a list report is left to each row; this just frames the list. */
export function FoldList({ children, empty }: { children?: ReactNode; empty?: ReactNode }) {
  return <div className="fold-list">{children ?? empty}</div>;
}
