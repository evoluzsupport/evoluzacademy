'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePortal } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Empty, Guard, PageHead, Pill } from '@/components/ui';
import { fmtDate } from '@/lib/util';

type Status = 'open' | 'in-progress' | 'resolved' | 'closed';
interface Ticket {
  id: string;
  number: number;
  raisedBy: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: Status;
  response: string;
  handledBy: string;
  createdAt: string;
}

const CATEGORIES = ['Course content', 'Trainer or session', 'Assessment', 'Login or access', 'Technical issue', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const STATUS_LABEL: Record<Status, string> = { open: 'Open', 'in-progress': 'In progress', resolved: 'Resolved', closed: 'Closed' };
const STATUS_PILL: Record<Status, string> = { open: 'overdue', 'in-progress': 'progress', resolved: 'active', closed: 'neutral' };

const toTicket = (r: Record<string, unknown>): Ticket => ({
  id: String(r.id),
  number: Number(r.number),
  raisedBy: String(r.raised_by),
  category: String(r.category ?? ''),
  priority: String(r.priority ?? 'Medium'),
  subject: String(r.subject ?? ''),
  description: String(r.description ?? ''),
  status: (r.status as Status) ?? 'open',
  response: String(r.response ?? ''),
  handledBy: String(r.handled_by ?? ''),
  createdAt: String(r.created_at ?? ''),
});

/** Support tickets: trainees and trainers raise them from their own portal, admins answer them. */
export default function TicketsPage() {
  const { S, me, toast } = usePortal();
  const admin = me?.kind === 'admin';
  const [list, setList] = useState<Ticket[] | null>(null);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [raising, setRaising] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
    if (error) {
      toast(error.message);
      return setList([]);
    }
    setList((data ?? []).map(toTicket));
  }, [toast]);
  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const who = (id: string) => {
    const t = S.trainees.find((x) => x.id === id);
    if (t) return { name: t.name, role: 'Trainee' };
    const r = S.trainers.find((x) => x.id === id);
    if (r) return { name: r.name, role: 'Trainer' };
    const a = S.admins.find((x) => x.id === id);
    return a ? { name: a.name, role: 'Admin' } : { name: '(removed)', role: '' };
  };

  const all = list ?? [];
  const shown = all.filter((t) => filter === 'all' || t.status === filter);
  const count = (s: Status) => all.filter((t) => t.status === s).length;

  return (
    <Guard kinds={['admin', 'trainer', 'trainee']}>
      <PageHead
        title={admin ? 'Tickets' : 'My Tickets'}
        desc={admin ? 'Issues raised by trainees and trainers. Reply and update the status as you work on them.' : 'Having a problem or a question? Raise a ticket and the Evoluz Academy team will get back to you.'}
        actions={!admin && <button className="btn primary" onClick={() => setRaising((r) => !r)}>{raising ? 'Close form' : '＋ Raise a ticket'}</button>}
      />
      {raising && !admin && (
        <NewTicket
          onCancel={() => setRaising(false)}
          onSaved={() => {
            setRaising(false);
            void load();
          }}
        />
      )}
      <div className="tabs" role="tablist">
        {(['all', 'open', 'in-progress', 'resolved', 'closed'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {k === 'all' ? 'All' : STATUS_LABEL[k]}
            <span className="count">{k === 'all' ? all.length : count(k)}</span>
          </button>
        ))}
      </div>
      {list === null ? (
        <Empty>Loading tickets…</Empty>
      ) : !shown.length ? (
        <Empty>{all.length ? 'No tickets with this status.' : admin ? 'No tickets have been raised yet.' : 'You have not raised any tickets yet.'}</Empty>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          {shown.map((t) => (
            <TicketCard key={t.id} t={t} admin={!!admin} raiser={who(t.raisedBy)} onSaved={load} />
          ))}
        </div>
      )}
    </Guard>
  );
}

function NewTicket({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const { me, toast } = usePortal();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState('Medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !subject.trim()) return toast('Add a subject for the ticket');
    setBusy(true);
    const { error } = await supabase.from('tickets').insert({ raised_by: me.id, category, priority, subject: subject.trim(), description: description.trim() });
    setBusy(false);
    if (error) return toast(error.message);
    toast('Ticket raised. The team will get back to you.');
    onSaved();
  };

  return (
    <form className="card section-card" style={{ marginBottom: 16, maxWidth: 760 }} onSubmit={submit}>
      <h3 style={{ marginTop: 0 }}>Raise a ticket</h3>
      <div className="field">
        <label htmlFor="t-subject">Subject</label>
        <input id="t-subject" value={subject} maxLength={140} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary of the problem" />
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="t-cat">Category</label>
          <select id="t-cat" className="select" style={{ width: '100%' }} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="t-pri">Priority</label>
          <select id="t-pri" className="select" style={{ width: '100%' }} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="t-desc">Details</label>
        <textarea id="t-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened, and what did you expect?" />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Submit ticket'}</button>
      </div>
    </form>
  );
}

function TicketCard({ t, admin, raiser, onSaved }: { t: Ticket; admin: boolean; raiser: { name: string; role: string }; onSaved: () => Promise<void> }) {
  const { me, toast, confirm } = usePortal();
  const [status, setStatus] = useState<Status>(t.status);
  const [response, setResponse] = useState(t.response);
  const [busy, setBusy] = useState(false);
  const dirty = status !== t.status || response !== t.response;

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('tickets')
      .update({ status, response: response.trim(), handled_by: me?.name ?? '', updated_at: new Date().toISOString() })
      .eq('id', t.id);
    setBusy(false);
    if (error) return toast(error.message);
    toast(`Ticket #${t.number} updated`);
    await onSaved();
  };
  const remove = () =>
    confirm(
      `Delete ticket #${t.number}?`,
      async () => {
        const { error } = await supabase.from('tickets').delete().eq('id', t.id);
        if (error) return toast(error.message);
        await onSaved();
      },
      'Delete'
    );

  return (
    <section className="card section-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>#{t.number} · {t.subject}</h3>
          <small className="subtle">
            {admin && <>{raiser.name}{raiser.role ? ` (${raiser.role})` : ''} · </>}
            {t.category} · {t.priority} priority · {t.createdAt ? fmtDate(t.createdAt.slice(0, 10)) : ''}
          </small>
        </div>
        <Pill kind={STATUS_PILL[t.status]}>{STATUS_LABEL[t.status]}</Pill>
      </div>
      {t.description && <p style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{t.description}</p>}

      {admin ? (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <div className="field">
            <label htmlFor={`r-${t.id}`}>Reply to {raiser.name.split(' ')[0]}</label>
            <textarea id={`r-${t.id}`} rows={3} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write a reply or the resolution" />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button className="btn primary" disabled={!dirty || busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="btn" onClick={remove}>Delete</button>
            {t.handledBy && <small className="subtle">Last updated by {t.handledBy}</small>}
          </div>
        </div>
      ) : t.response ? (
        <div style={{ marginTop: 14, background: '#eef3fe', borderRadius: 10, padding: '10px 14px' }}>
          <small className="subtle">Reply{t.handledBy ? ` from ${t.handledBy}` : ''}</small>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{t.response}</p>
        </div>
      ) : (
        <small className="subtle" style={{ display: 'block', marginTop: 12 }}>Waiting for a reply from the team.</small>
      )}
    </section>
  );
}
