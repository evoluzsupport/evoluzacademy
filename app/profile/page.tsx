'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePortal } from '@/lib/store';
import { fmtDate } from '@/lib/util';
import { Guard, PageHead } from '@/components/ui';

export default function ProfilePage() {
  const { S, me, update, toast } = usePortal();
  const rec = me && (me.kind === 'admin' ? S.admins : me.kind === 'trainer' ? S.trainers : S.trainees).find((x) => x.id === me.id);
  const [name, setName] = useState(me?.name ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  if (!me || !rec) return null;

  const trainee = me.kind === 'trainee' ? S.trainees.find((t) => t.id === me.id) : undefined;
  const trainer = me.kind === 'trainer' ? S.trainers.find((t) => t.id === me.id) : undefined;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast('Please add your name');
    update((s) => {
      const list = me.kind === 'admin' ? s.admins : me.kind === 'trainer' ? s.trainers : s.trainees;
      const x = list.find((y) => y.id === me.id)!;
      const old = x.name;
      x.name = name.trim();
      x.phone = phone.trim();
      if (me.kind === 'trainer' && old !== x.name) {
        s.courses.forEach((c) => { if (c.primaryTrainer === old) c.primaryTrainer = x.name; });
        s.trainees.forEach((t) => { if (t.trainer === old) t.trainer = x.name; });
        Object.values(s.progress).forEach((r) => { if (r.trainer === old) r.trainer = x.name; });
        s.sessions.forEach((r) => { if (r.trainer === old) r.trainer = x.name; });
      }
    });
    toast('Profile saved');
  };

  return (
    <Guard kinds={['admin', 'trainer', 'trainee']}>
      <PageHead title="My profile" desc="Your own information. You sign in with your Zoho account." />
      <section className="card detail-panel" style={{ maxWidth: 560 }}>
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="field full"><label htmlFor="p-n">Full name</label><input id="p-n" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div className="field full"><label>Email</label><input value={me.email || '— none —'} disabled readOnly /></div>
            <div className="field full"><label htmlFor="p-p">Phone</label><input id="p-p" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            {trainee && (
              <>
                <div className="field"><label>Role</label><input value={trainee.jobRole} disabled readOnly /></div>
                <div className="field"><label>Joined on</label><input value={fmtDate(trainee.joined)} disabled readOnly /></div>
              </>
            )}
            {trainer && <div className="field full"><label>Role</label><input value={trainer.specialty} disabled readOnly /></div>}
          </div>
          <div className="modal-actions"><button className="btn primary">Save changes</button></div>
        </form>
      </section>
    </Guard>
  );
}
