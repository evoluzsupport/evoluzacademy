'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { match, usePortal } from '@/lib/store';
import type { Kind } from '@/lib/types';
import { Avatar, Empty, Guard, PageHead } from '@/components/ui';
import { ImportDialog } from '@/components/csvdialog';
import { downloadCSV } from '@/lib/csv';

const ACCESS: { value: Kind; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'trainee', label: 'Trainee' },
];

function UserForm({ id }: { id?: string }) {
  const { S, saveUser, closeModal, toast } = usePortal();
  const admin = S.admins.find((x) => x.id === id);
  const trainer = S.trainers.find((x) => x.id === id);
  const trainee = S.trainees.find((x) => x.id === id);
  const cur = admin ?? trainer ?? trainee;
  const [name, setName] = useState(cur?.name ?? '');
  const [email, setEmail] = useState(cur?.email ?? '');
  const [phone, setPhone] = useState(cur?.phone ?? '');
  const [access, setAccess] = useState<Kind>(admin ? 'admin' : trainer ? 'trainer' : trainee ? 'trainee' : 'trainee');
  const [title, setTitle] = useState(trainer?.specialty ?? trainee?.jobRole ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = saveUser(id ?? null, { name, email, phone, access, title });
    if (err) toast(err);
    else closeModal();
  };

  return (
    <>
      <h2>{id ? 'Edit user' : 'Add user'}</h2>
      <p>Users sign in with the email listed here. Access decides what they can do in the portal.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label htmlFor="u-n">Name</label><input id="u-n" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="field"><label htmlFor="u-e">Email</label><input id="u-e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="field">
            <label htmlFor="u-a">Access</label>
            <select id="u-a" value={access} onChange={(e) => setAccess(e.target.value as Kind)}>
              {ACCESS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {access !== 'admin' && (
            <div className="field"><label htmlFor="u-t">Role</label><input id="u-t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={access === 'trainer' ? 'e.g. Zoho CRM' : 'e.g. CRM Consultant'} /></div>
          )}
          <div className="field"><label htmlFor="u-p">Phone</label><input id="u-p" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={closeModal}>Cancel</button>
          <button className="btn primary">{id ? 'Save changes' : 'Add user'}</button>
        </div>
      </form>
    </>
  );
}

export default function UsersPage() {
  const { S, me, openModal, confirm, removeUser, addPeople, toast } = usePortal();
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [bulkAccess, setBulkAccess] = useState<Kind>('admin');

  const users = [
    ...S.admins.map((p) => ({ ...p, kind: 'admin' as Kind, tone: '', title: '' })),
    ...S.trainers.map((p) => ({ ...p, kind: 'trainer' as Kind, title: p.specialty })),
    ...S.trainees.map((p) => ({ ...p, kind: 'trainee' as Kind, title: p.jobRole })),
  ].filter((p) => match(q, p.name, p.email, p.kind, p.title));

  // one person per line: "Name, email@evoluz.tech" (or just an email)
  const addMany = (e: FormEvent) => {
    e.preventDefault();
    const list = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.split(/[,;\t]/).map((x) => x.trim());
        return parts.length > 1 ? { name: parts[0], email: parts[1], role: bulkAccess } : { name: '', email: parts[0], role: bulkAccess };
      });
    if (!list.length) return toast('Add at least one email');
    const { added, skipped } = addPeople(list);
    if (added) setText('');
    toast(
      `${added} ${added === 1 ? 'user' : 'users'} added as ${bulkAccess}` +
        (skipped.length ? ` · skipped ${skipped.length} (invalid or already listed)` : '')
    );
  };

  const del = (id: string, name: string) =>
    confirm(`Remove ${name}? They lose access, and their assignments and progress are deleted.`, () => removeUser(id), 'Remove user');

  return (
    <Guard kinds={['admin']}>
      <PageHead
        title="Users"
        desc="Everyone who can sign in to Evoluz Academy, with their access. People sign in with Zoho using the email listed here."
        actions={
          <>
            <button className="btn" onClick={() => openModal(<ImportDialog kind="users" />)}>Import CSV</button>
            <button
              className="btn"
              onClick={() =>
                downloadCSV(
                  [['Name', 'Email', 'Access', 'Role', 'Phone'], ...users.map((u) => [u.name, u.email, u.kind, u.title, u.phone ?? ''])],
                  'evoluz-users.csv'
                )
              }
            >
              Export CSV
            </button>
            <button className="btn primary" onClick={() => openModal(<UserForm />)}>＋ Add user</button>
          </>
        }
      />

      <div className="toolbar" style={{ marginBottom: 15 }}>
        <input className="input" placeholder="Search users..." aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="subtle">{S.admins.length} admins · {S.trainers.length} trainers · {S.trainees.length} trainees</span>
      </div>

      <section className="card table-card" style={{ marginBottom: 17 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>User</th><th>Email</th><th>Access</th><th>Role</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="person">
                      <Avatar name={p.name} tone={p.tone} />
                      {p.name}
                      {p.id === me?.id && <span className="pill neutral">You</span>}
                    </div>
                  </td>
                  <td>{p.email || <span className="subtle">No email · cannot sign in</span>}</td>
                  <td><span className={`pill ${p.kind === 'admin' ? 'progress' : p.kind === 'trainer' ? 'active' : 'neutral'}`}>{p.kind[0].toUpperCase() + p.kind.slice(1)}</span></td>
                  <td>{p.title || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn" onClick={() => openModal(<UserForm id={p.id} />)}>Edit</button>
                      <button className="btn" aria-label={`Remove ${p.name}`} disabled={p.id === me?.id} title={p.id === me?.id ? 'You cannot remove yourself' : 'Remove'} onClick={() => del(p.id, p.name)}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length && <Empty>No users match that search.</Empty>}
      </section>

      <section className="card detail-panel">
        <h3 style={{ font: '700 14px Manrope', margin: '0 0 6px' }}>Add several users at once</h3>
        <p className="subtle" style={{ lineHeight: 1.6, margin: '0 0 12px' }}>
          One person per line as <b>Name, email</b>. Choose Admin to add multiple admins in one go.
        </p>
        <form onSubmit={addMany}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="b-list">Users</label>
              <textarea
                id="b-list"
                rows={4}
                placeholder={'Jyoti Raj, jyoti.raj@evoluz.tech\nVishal Kumar, vishal.kumar@evoluz.tech'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="b-access">Access</label>
              <select id="b-access" value={bulkAccess} onChange={(e) => setBulkAccess(e.target.value as Kind)}>
                {ACCESS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-actions"><button className="btn primary">Add users</button></div>
        </form>
      </section>
    </Guard>
  );
}
