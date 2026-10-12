'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { usePortal } from '@/lib/store';

const DEMO = [
  ['Admin', 'admin@evoluz.tech', 'demo@123'],
  ['Trainer', 'shivangi@evoluz.tech', 'demo123'],
  ['Trainee', 'mira.shah@evoluz.tech', 'demo123'],
];

export default function LoginPage() {
  const { login, loginWithZoho, ready, me } = usePortal();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (ready && me) router.replace('/');
  }, [ready, me, router]);

  const zoho = async () => {
    const m = await loginWithZoho();
    if (m) setErr(m);
  };

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
          <div className="login-actions">
            <button className="btn primary login-btn">Sign in</button>
            <span className="login-or">or</span>
            <button type="button" className="btn login-btn zoho-btn" onClick={zoho}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <rect width="24" height="24" rx="5" fill="#fff" />
                <path d="M6 7h12l-8.5 10H18" fill="none" stroke="#e42527" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign in with Zoho
            </button>
          </div>
        </form>
        <p className="subtle" style={{ margin: '18px 0 0' }}>Demo accounts:</p>
        <div className="demo-row">
          {DEMO.map(([label, em, pass]) => (
            <button key={em} type="button" className="btn" onClick={() => { setEmail(em); setPw(pass); setErr(''); }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
