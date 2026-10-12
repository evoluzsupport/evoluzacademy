'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { usePortal } from '@/lib/store';

const DEMO = [
  ['Admin', 'admin@evoluz.tech'],
  ['Trainer', 'shivangi@evoluz.tech'],
  ['Trainee', 'mira.shah@evoluz.tech'],
];

export default function LoginPage() {
  const { login, ready } = usePortal();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (login(email, pw)) router.replace('/');
    else setErr('Invalid email or password.');
  };
  if (!ready) return null;
  return (
    <div className="login-wrap">
      <div className="login-box">
        <Image src="/evoluz-logo.png" alt="Evoluz" width={190} height={51} priority style={{ width: 190, height: 'auto' }} />
        <h1>Evoluz Academy</h1>
        <p className="lead">Sign in to see your trainees, courses and training progress.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="em">Email</label>
            <input id="em" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <p className="login-err" role="alert">{err}</p>
          <button className="btn primary" style={{ width: '100%', justifyContent: 'center', padding: 11 }}>Sign in</button>
        </form>
        <p className="subtle" style={{ margin: '18px 0 0' }}>Demo accounts (password <b>demo123</b>):</p>
        <div className="demo-row">
          {DEMO.map(([label, em]) => (
            <button key={em} type="button" className="btn" onClick={() => { setEmail(em); setPw('demo123'); setErr(''); }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
