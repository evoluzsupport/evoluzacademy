'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { match, usePortal } from '@/lib/store';
import type { Kind } from '@/lib/types';
import { Avatar, Empty, Guard, PageHead } from '@/components/ui';

const ROLES: { value: Kind; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'trainee', label: 'Trainee' },
];

export default function RolesPage() {
  const { S, me, setRole, addPeople, toast } = usePortal();
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [role, setNewRole] = useState<Kind>('admin');

  const people = [
    ...S.admins.map((p) => ({ ...p, kind: 'admin' as Kind, tone: '' })),
    ...S.trainers.map((p) => ({ ...p, kind: 'trainer' as Kind })),
    ...S.trainees.map((p) => ({ ...p, kind: 'trainee' as Kind })),
  ].filter((p) => match(q, p.name, p.email, p.kind));

  // one person per line: "Name, email@evoluz.tech" (or just an email)
  const add = (e: FormEvent) => {
    e.preventDefault();
    const list = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.split(/[,;\t]/).map((x) => x.trim());
        return parts.length > 1 ? { name: parts[0], email: parts[1], role } : { name: '', email: parts[0], role };
      });
    if (!list.length) return toast('Add at least one email');
    const { added, skipped } = addPeople(list);
    if (added) setText('');
    toast(
      `${added} ${added === 1 ? 'person' : 'people'} added as ${role}` +
        (skipped.length ? ` · skipped ${skipped.length} (invalid or already listed)` : '')
    );
  };

  return (
    <Guard kinds={['admin']}>
      <PageHead
        title="Roles & access"
        desc="Choose who is an admin, trainer or trainee. People sign in with Zoho using the email listed here."
      />
      <section className="card detail-panel" style={{ marginBottom: 17 }}>
        <h3 style={{ font: '700 14px Manrope', margin: '0 0 6px' }}>Add people</h3>
        <p className="subtle" style={{ lineHeight: 1.6, margin: '0 0 12px' }}>
          One person per line as <b>Name, email</b>. Add several admins at once by choosing Admin.
        </p>
        <form onSubmit={add}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="r-list">People</label>
              <textarea
                id="r-list"
                rows={4}
                placeholder={'Jyoti Raj, jyoti.raj@evoluz.tech\nVishal Kumar, vishal.kumar@evoluz.tech'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="r-role">Role</label>
              <select id="r-role" value={role} onChange={(e) => setNewRole(e.target.value as Kind)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-actions"><button className="btn primary">Add people</button></div>
        </form>
      </section>

      <div className="toolbar" style={{ marginBottom: 15 }}>
        <input className="input" placeholder="Search people..." aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="subtle">{S.admins.length} admins · {S.trainers.length} trainers · {S.trainees.length} trainees</span>
      </div>
      <section className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Person</th><th>Email</th><th>Role</th></tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td><div className="person"><Avatar name={p.name} tone={p.tone} />{p.name}{p.id === me?.id && <span className="pill neutral">You</span>}</div></td>
                  <td>{p.email || <span className="subtle">No email · cannot sign in</span>}</td>
                  <td>
                    <select
                      className="select"
                      aria-label={`Role for ${p.name}`}
                      value={p.kind}
                      onChange={(e) => setRole(p.id, e.target.value as Kind)}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!people.length && <Empty>No one matches that search.</Empty>}
      </section>
    </Guard>
  );
}
