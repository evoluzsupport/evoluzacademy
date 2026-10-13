'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './landing.css';

interface Step {
  icon: string;
  label: string;
  say: string;
}

const STEPS: Step[] = [
  { icon: '⌂', label: 'Overview', say: 'Start here: a live snapshot of every trainee, course and what needs attention today.' },
  { icon: '♙', label: 'Trainees & trainers', say: "Keep one directory of trainees and trainers, with each person's role and progress." },
  { icon: '▤', label: 'Courses', say: 'Build courses from planned days and topics. Import a whole curriculum from CSV.' },
  { icon: '⇄', label: 'Ongoing Training Session', say: 'Assign courses to trainees with due dates. Everyone learns at their own pace.' },
  { icon: '☑', label: 'Training tracker', say: 'Tick topics off as they happen. Progress stays individual, even when sessions move.' },
  { icon: '＋', label: 'Log a session', say: 'Ran a class? Log it once and mark the topics for every attendee in one go.' },
  { icon: '◔', label: 'Analytics', say: 'See completion, overdue courses and trainer delivery, and export it all to CSV.' },
  { icon: '⚿', label: 'Users & access', say: 'Admins add people and choose their access: admin, trainer or trainee. Sign in with Zoho.' },
];

const STEP_MS = 4600;
const CLICK_DELAY = 900;
const REDIRECT_S = 7;

function Robot({ talking }: { talking: boolean }) {
  return (
    <svg className={`lp-robot ${talking ? 'talking' : ''}`} viewBox="0 0 160 190" aria-hidden="true">
      <ellipse cx="80" cy="182" rx="40" ry="6" fill="#203d70" opacity=".14" />
      <g className="lp-bob">
        <line x1="80" y1="14" x2="80" y2="34" stroke="#3158b6" strokeWidth="4" strokeLinecap="round" />
        <circle className="lp-bulb" cx="80" cy="12" r="7" fill="#2e70c7" />
        <rect x="32" y="34" width="96" height="70" rx="22" fill="#fff" stroke="#3158b6" strokeWidth="5" />
        <rect x="44" y="48" width="72" height="42" rx="14" fill="#eaf4fc" />
        <g className="lp-eyes">
          <circle cx="64" cy="66" r="7" fill="#253f9b" />
          <circle cx="96" cy="66" r="7" fill="#253f9b" />
        </g>
        <path className="lp-mouth" d="M68 80 Q80 90 92 80" fill="none" stroke="#253f9b" strokeWidth="4" strokeLinecap="round" />
        <circle cx="38" cy="70" r="6" fill="#3158b6" />
        <circle cx="122" cy="70" r="6" fill="#3158b6" />
        <rect x="46" y="110" width="68" height="54" rx="16" fill="#3158b6" />
        <rect x="62" y="124" width="36" height="8" rx="4" fill="#fff" opacity=".85" />
        <circle cx="70" cy="146" r="4" fill="#9fe0c8" />
        <circle cx="90" cy="146" r="4" fill="#ffc46b" />
        <rect x="26" y="114" width="16" height="40" rx="8" fill="#2e70c7" />
        <rect className="lp-arm-r" x="118" y="114" width="16" height="40" rx="8" fill="#2e70c7" />
      </g>
    </svg>
  );
}

function Bar({ w, c = '#4d79cf' }: { w: number; c?: string }) {
  return (
    <div className="lp-track">
      <i style={{ width: w + '%', background: c }} />
    </div>
  );
}

function Screen({ i }: { i: number }) {
  switch (i) {
    case 0:
      return (
        <div className="lp-screen">
          <div className="lp-stats">
            {[
              ['Trainees', '24'],
              ['Courses', '8'],
              ['Avg. progress', '68%'],
              ['Overdue', '3'],
            ].map(([k, v]) => (
              <div key={k} className="lp-stat">
                <small>{k}</small>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <div className="lp-card">
            <Bar w={72} />
            <Bar w={48} c="#6fb99c" />
            <Bar w={86} />
          </div>
        </div>
      );
    case 1:
      return (
        <div className="lp-screen">
          {['Mira Shah · CRM Consultant', 'Arjun Mehta · Creator Developer', 'Sana Iyer · Project Coordinator'].map((n, k) => (
            <div key={n} className="lp-row">
              <span className="lp-av">{n[0]}</span>
              <span>{n}</span>
              <div style={{ width: 90 }}>
                <Bar w={[75, 52, 90][k]} />
              </div>
            </div>
          ))}
        </div>
      );
    case 2:
      return (
        <div className="lp-screen lp-grid3">
          {['Basic Zoho', 'Zoho CRM', 'Zoho Creator', 'Zoho People', 'Zoho Desk', 'Zoho Books'].map((n) => (
            <div key={n} className="lp-card">
              <b>{n}</b>
              <small>30 days · 24 topics</small>
            </div>
          ))}
        </div>
      );
    case 3:
      return (
        <div className="lp-screen">
          {[
            ['Mira Shah', 'Zoho CRM', 'Due 30 Oct'],
            ['Arjun Mehta', 'Zoho Creator', 'Due 05 Nov'],
            ['Sana Iyer', 'Project training', 'Due 12 Nov'],
          ].map(([a, b, c]) => (
            <div key={a} className="lp-row">
              <span>{a}</span>
              <span className="lp-pill">{b}</span>
              <small>{c}</small>
            </div>
          ))}
        </div>
      );
    case 4:
      return (
        <div className="lp-screen">
          {['Introduction to the portal', 'Leads and contacts', 'Deals pipeline', 'Reports and dashboards'].map((t, k) => (
            <div key={t} className="lp-row">
              <span className={`lp-check ${k < 3 ? 'on' : ''}`}>{k < 3 ? '✓' : ''}</span>
              <span>{t}</span>
              <small>Day {k + 1}</small>
            </div>
          ))}
        </div>
      );
    case 5:
      return (
        <div className="lp-screen">
          <div className="lp-card">
            <small>Course</small>
            <b>Zoho CRM</b>
          </div>
          <div className="lp-row">
            <span className="lp-pill">Mira</span>
            <span className="lp-pill">Arjun</span>
            <span className="lp-pill">Sana</span>
          </div>
          <div className="lp-btn">Save session · 9 topic marks</div>
        </div>
      );
    case 6:
      return (
        <div className="lp-screen">
          <div className="lp-bars">
            {[40, 62, 55, 80, 70, 92].map((h, k) => (
              <i key={k} style={{ height: h + '%' }} />
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div className="lp-screen">
          {[
            ['Admin', 'admin@evoluz.tech'],
            ['Trainer', 'trainer@evoluz.tech'],
            ['Trainee', 'trainee@evoluz.tech'],
          ].map(([r, e]) => (
            <div key={e} className="lp-row">
              <span>{e}</span>
              <span className="lp-pill">{r}</span>
            </div>
          ))}
        </div>
      );
  }
}

export default function WelcomePage() {
  const router = useRouter();
  const [cursor, setCursor] = useState(0); // where the robot's cursor is
  const [active, setActive] = useState(0); // which screen is shown
  const [clicks, setClicks] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const explored = useRef(false); // once the user takes over, never auto-redirect
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // robot moves the cursor to a feature, then "clicks" it
  const go = useCallback((i: number) => {
    setCursor(i);
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      setActive(i);
      setClicks((c) => c + 1);
    }, CLICK_DELAY);
  }, []);

  const cursorRef = useRef(0);
  cursorRef.current = cursor;

  // autoplay through every feature once, then offer to continue to sign in
  useEffect(() => {
    if (!playing || countdown !== null) return;
    const id = setInterval(() => {
      const next = cursorRef.current + 1;
      if (next >= STEPS.length) {
        if (!explored.current) setCountdown(REDIRECT_S);
        go(0);
      } else go(next);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [playing, countdown, go]);

  useEffect(() => () => clearTimeout(pending.current), []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      router.push('/login');
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? c : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, router]);

  const pick = (i: number) => {
    explored.current = true;
    setPlaying(false);
    setCountdown(null);
    go(i);
  };
  const stay = () => {
    explored.current = true;
    setCountdown(null);
    setPlaying(true);
  };

  return (
    <div className="lp">
      <header className="lp-top">
        <Image src="/evoluz-logo.png" alt="Evoluz" width={150} height={40} priority style={{ width: 150, height: 'auto' }} />
        <Link href="/login" className="btn primary">
          Sign in
        </Link>
      </header>

      <section className="lp-hero">
        <p className="lp-eyebrow">Evoluz Academy</p>
        <h1>Every learner. Every topic. One clear picture.</h1>
        <p>Plan courses, log sessions and track each trainee&apos;s progress. Let our guide show you around.</p>
      </section>

      <section className="lp-stage" aria-label="App tour">
        <div className="lp-guide">
          <div className="lp-bubble" key={active}>
            <small>
              {active + 1} / {STEPS.length} · {STEPS[active].label}
            </small>
            <p>{STEPS[active].say}</p>
          </div>
          <Robot talking={cursor === active} />
        </div>

        <div className="lp-window" role="img" aria-label={`Preview of ${STEPS[active].label}`}>
          <div className="lp-chrome">
            <i />
            <i />
            <i />
          </div>
          <div className="lp-app">
            <nav className="lp-nav">
              {STEPS.map((s, i) => (
                <button key={s.label} className={i === active ? 'on' : ''} onClick={() => pick(i)}>
                  <span>{s.icon}</span>
                  {s.label}
                </button>
              ))}
              <div className="lp-cursor" style={{ transform: `translate(118px, ${14 + cursor * 40}px)` }}>
                <svg viewBox="0 0 24 24" width="26" height="26">
                  <path d="M4 2l16 9-7 2-3 7z" fill="#18243b" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <span key={clicks} className="lp-ripple" />
              </div>
            </nav>
            <div className="lp-panel" key={active}>
              <h3>{STEPS[active].label}</h3>
              <Screen i={active} />
            </div>
          </div>
        </div>
      </section>

      <section className="lp-controls">
        <div className="lp-dots">
          {STEPS.map((s, i) => (
            <button key={s.label} aria-label={s.label} className={i === active ? 'on' : ''} onClick={() => pick(i)} />
          ))}
        </div>
        <button
          className="btn"
          onClick={() => {
            explored.current = true;
            setCountdown(null);
            setPlaying((p) => !p);
          }}
        >
          {playing ? '❚❚ Pause tour' : '▶ Play tour'}
        </button>
      </section>

      <section className="lp-cta">
        {countdown !== null ? (
          <div className="lp-redirect" role="status">
            <span>
              Taking you to sign in in <b>{countdown}s</b>
            </span>
            <button className="btn" onClick={stay}>
              Stay here
            </button>
            <Link href="/login" className="btn primary">
              Sign in now
            </Link>
          </div>
        ) : (
          <Link href="/login" className="btn primary lp-big">
            Sign in to Evoluz Academy
          </Link>
        )}
      </section>
    </div>
  );
}
