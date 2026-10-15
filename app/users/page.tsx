'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { match, usePortal } from '@/lib/store';
import { Avatar, Empty, Guard, PageHead } from '@/components/ui';
import { ImportDialog } from '@/components/csvdialog';
import { downloadCSV } from '@/lib/csv';
import { ViewBody, ViewSwitch, useView } from '@/components/views';
import type { Grouper } from '@/components/views';

function UserForm({ id }: { id?: string }) {
  const { S, saveUser, closeModal, toast } = usePortal();
  const cur = [...S.admins, ...S.trainers, ...S.trainees, ...S.users].find((x) => x.id === id);
  const [name, setName] = useState(cur?.name ?? '');
  const [email, setEmail] = useState(cur?.email ?? '');
  const [phone, setPhone] = useState(cur?.phone ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = saveUser(id ?? null, { name, email, phone });
    if (err) toast(err);
    else closeModal();
  };

  return (
    <>
      <h2>{id ? 'Edit user' : 'Add user'}</h2>
      <p>Users sign in with the email listed here. They become a trainee or trainer when you add them in the Trainee or Trainer form.</p>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field"><label htmlFor="u-n">Name</label><input id="u-n" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="field"><label htmlFor="u-e">Email</label><input id="u-e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
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
  const view = useView('users');

  // Access is read from the trainee and trainer lists, never set here.
  const users = [
    ...S.admins.map((p) => ({ ...p, listed: 'Admin' })),
    ...S.trainers.map((p) => ({ ...p, listed: 'Trainer' })),
    ...S.trainees.map((p) => ({ ...p, listed: 'Trainee' })),
    ...S.users.map((p) => ({ ...p, listed: 'Not enrolled' })),
  ]
    .filter((p) => match(q, p.name, p.email, p.listed))
    .sort((a, b) => a.name.localeCompare(b.name));
  type U = (typeof users)[number];
  const groupers: Grouper<U>[] = [{ key: 'listed', label: 'Listed as', of: (p) => p.listed }];

  // one person per line: "Name, email@evoluz.tech" (or just an email)
  const addMany = (e: FormEvent) => {
    e.preventDefault();
    const list = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.split(/[,;\t]/).map((x) => x.trim());
        return parts.length > 1 ? { name: parts[0], email: parts[1] } : { name: '', email: parts[0] };
      });
    if (!list.length) return toast('Add at least one email');
    const { added, skipped } = addPeople(list);
    if (added) setText('');
    toast(`${added} ${added === 1 ? 'user' : 'users'} added` + (skipped.length ? ` · skipped ${skipped.length} (invalid or already listed)` : ''));
  };

  const del = (id: string, name: string) =>
    confirm(`Remove ${name}? They lose access, and their assignments and progress are deleted.`, () => removeUser(id), 'Remove user');

  return (
    <Guard kinds={['admin']}>
      <PageHead
        title="Users"
        desc="Everyone who can sign in to Evoluz Academy. Add people here first, then add them as a trainee or trainer to give them that access."
        actions={
          <>
            <button className="btn" onClick={() => openModal(<ImportDialog kind="users" />)}>Import CSV</button>
            <button className="btn" onClick={() => downloadCSV([['Name', 'Email', 'Phone', 'Listed as'], ...users.map((u) => [u.name, u.email, u.phone ?? '', u.listed])], 'evoluz-users.csv')}>
              Export CSV
            </button>
            <button className="btn primary" onClick={() => openModal(<UserForm />)}>＋ Add user</button>
          </>
        }
      />

      <div className="toolbar" style={{ marginBottom: 15 }}>
        <input className="input" placeholder="Search users..." aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="subtle">{S.admins.length} admins · {S.trainers.length} trainers · {S.trainees.length} trainees · {S.users.length} not enrolled</span>
        <span style={{ marginLeft: 'auto' }}><ViewSwitch view={view} groupers={groupers} /></span>
      </div>

      <section className="card table-card" style={{ marginBottom: 17 }}>
        <ViewBody
          view={view}
          items={users}
          groupers={groupers}
          id={(p) => p.id}
          empty={<Empty>No users match that search.</Empty>}
          card={(p) => (
            <div className="vcard">
              <div className="vtop">
                <div className="person"><Avatar name={p.name} />{p.name}{p.id === me?.id && <span className="pill neutral">You</span>}</div>
              </div>
              <div className="vmail">{p.email || 'No email · cannot sign in'}</div>
              <dl className="vmeta">
                <div><dt>Phone</dt><dd>{p.phone || '—'}</dd></div>
                <div><dt>Listed as</dt><dd>{p.listed}</dd></div>
              </dl>
              <div className="vfoot" style={{ justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => openModal(<UserForm id={p.id} />)}>Edit</button>
                <button className="btn" aria-label={`Remove ${p.name}`} disabled={p.id === me?.id} onClick={() => del(p.id, p.name)}>×</button>
              </div>
            </div>
          )}
          list={
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>User</th><th>Email</th><th>Phone</th><th>Listed as</th><th></th></tr>
                </thead>
                <tbody>
                  {users.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="person">
                          <Avatar name={p.name} />
                          {p.name}
                          {p.id === me?.id && <span className="pill neutral">You</span>}
                        </div>
                      </td>
                      <td>{p.email || <span className="subtle">No email · cannot sign in</span>}</td>
                      <td>{p.phone || '—'}</td>
                      <td><span className={`pill ${p.listed === 'Not enrolled' ? 'neutral' : p.listed === 'Admin' ? 'progress' : 'active'}`}>{p.listed}</span></td>
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
          }
        />
        {view.mode === 'list' && !users.length && <Empty>No users match that search.</Empty>}
      </section>

      <section className="card detail-panel">
        <h3 style={{ font: '700 14px Manrope', margin: '0 0 6px' }}>Add several users at once</h3>
        <p className="subtle" style={{ lineHeight: 1.6, margin: '0 0 12px' }}>
          One person per line as <b>Name, email</b>.
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
          </div>
          <div className="modal-actions"><button className="btn primary">Add users</button></div>
        </form>
      </section>
    </Guard>
  );
}
