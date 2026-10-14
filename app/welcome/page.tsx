'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import TourSection from './Tour';
import TrainingVideo from './TrainingVideo';
import './landing.css';
import './site.css';

/** Adds `.in` to an element the first time it scrolls into view. */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return setOn(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${on ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Counts up to `to` once it is visible. */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1400);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    if (typeof IntersectionObserver === 'undefined') {
      setN(to);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        run();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  );
}

const FEATURES = [
  { icon: '▤', title: 'Course Library', text: 'Build learning paths from planned days and topics. Each topic carries what to cover and the practical activity.' },
  { icon: '♙', title: 'Learner Tracking', text: 'Progress stays individual. See who is on track, who is overdue and what is next for every learner.' },
  { icon: '＋', title: 'Log Sessions Once', text: 'Run a class, pick the attendees and topics, and mark everyone in one go. Undo a session any time.' },
  { icon: '♧', title: 'Assign Trainers', text: 'Set the trainer responsible for each learner on each course, with a clear report for both sides.' },
  { icon: '◔', title: 'Analytics And Reports', text: 'Completion, overdue courses and trainer delivery at a glance, with CSV export for any list.' },
  { icon: '⚿', title: 'Roles And Access', text: 'Admin, trainer or trainee. Admins change access in one click and everyone sees only what they should.' },
  { icon: '⇪', title: 'Import In Minutes', text: 'Bring your whole curriculum, users and trainees from a spreadsheet-style CSV with a ready sample file.' },
  { icon: '✓', title: 'Sign In With Zoho', text: 'One secure sign-in with the Zoho account your team already uses. New people start as trainees.' },
];

const HOW = [
  { n: '01', title: 'Add Your People', text: 'Import users or add them one by one, then choose who is an admin, trainer or trainee.' },
  { n: '02', title: 'Load The Courses', text: 'Import the training manual. Every course, day, topic and activity is ready to use.' },
  { n: '03', title: 'Assign And Teach', text: 'Assign courses and a trainer to each learner, then log sessions as training happens.' },
  { n: '04', title: 'Track And Report', text: 'Watch progress update live and export reports for managers, trainers and learners.' },
];

const ROLES = [
  {
    name: 'Admin',
    tone: 'blue',
    line: 'Runs the academy',
    points: ['Add, edit and import users', 'Change anyone\'s access', 'Manage courses and topics', 'Assign courses and trainers', 'Full analytics and exports'],
  },
  {
    name: 'Trainer',
    tone: 'green',
    line: 'Teaches and tracks',
    points: ['See only assigned courses', 'Log sessions for attendees', 'Mark topics as covered', 'Follow their own learners', 'Take courses as a learner too'],
  },
  {
    name: 'Trainee',
    tone: 'amber',
    line: 'Learns with clarity',
    points: ['See assigned courses and trainers', 'Follow a clear learning plan', 'View progress and due dates', 'Read what each topic covers', 'View-only, so records stay trusted'],
  },
];

const COURSES = [
  'Basic Zoho', 'Zoho CRM', 'Zoho Creator', 'Zoho People', 'Zoho Desk', 'Zoho Books', 'Zoho Projects', 'Zoho Recruit',
  'Zoho Analytics', 'Zoho Marketing Automation', 'Zoho Campaigns', 'Zoho Inventory', 'Zoho SalesIQ', 'Zoho Billing',
  'Zoho POS', 'Zoho FSM', 'Zoho Thrive', 'Zoho Vault', 'Zoho Qengine', 'Zoho Directory', 'Zoho OneAuth', 'Zoho eProtect',
  'Zoho Command Center', 'Zoho RPA', 'PC Training',
];

const FAQ = [
  { q: 'Who can sign in?', a: 'Anyone with a Zoho account. People already added by an admin keep the access they were given. A brand new email starts as a trainee, and an admin can change it later.' },
  { q: 'Can trainees change their own progress?', a: 'No. Trainees can view their courses, trainers and progress, but only trainers and admins record completion, which keeps the records trusted.' },
  { q: 'What does a trainer see?', a: 'Only the courses an admin assigned to them, and the learners on those courses. Trainers can also be assigned courses to learn, with their own report.' },
  { q: 'How do we load our courses?', a: 'Use Import Curriculum with the sample file. It uses the same columns as the training manual: day, trainer, category, topic, what we cover and the activity.' },
  { q: 'Is the data shared between people?', a: 'Yes. Everything is stored centrally, so a trainer\'s update shows for the trainee and the admin straight away.' },
  { q: 'Can I export reports?', a: 'Yes. Courses, users, trainers and assignments can be exported to CSV from their pages.' },
];

const BENEFITS = [
  { icon: '⏱', title: 'Save Hours Every Week', text: 'Log a whole class in one step instead of updating every learner by hand.' },
  { icon: '◎', title: 'Always Know Where Everyone Stands', text: 'Live completion, overdue alerts and next topics for every learner.' },
  { icon: '☁', title: 'One Shared Source Of Truth', text: 'Admins, trainers and trainees all see the same up-to-date records.' },
  { icon: '⚑', title: 'Consistent Quality', text: 'Every trainer follows the same topics and activities, batch after batch.' },
  { icon: '⇩', title: 'Reports On Demand', text: 'Export courses, users, trainers and assignments to CSV in a click.' },
  { icon: '☺', title: 'Easy For Everyone', text: 'A clean, simple interface that new trainers and trainees pick up in minutes.' },
];

const SHOWCASE = [
  { label: 'Zoho CRM', value: 88, tone: 'blue' },
  { label: 'Zoho Creator', value: 72, tone: 'green' },
  { label: 'Zoho Books', value: 64, tone: 'amber' },
  { label: 'Zoho Desk', value: 91, tone: 'purple' },
];

const TESTIMONIALS = [
  { q: 'We stopped chasing spreadsheets. Every trainer logs a session and the progress is just there.', n: 'Training Lead', r: 'Operations' },
  { q: 'New joiners know exactly what to learn and who is teaching them. Onboarding feels organised.', n: 'Team Manager', r: 'Delivery' },
  { q: 'Seeing overdue courses at a glance changed how we plan our week.', n: 'Senior Trainer', r: 'Zoho Practice' },
];

const WORDS = ['Learner', 'Trainer', 'Course', 'Session'];

const NAV = [
  ['Features', '#features'],
  ['Training Video', '#video'],
  ['How It Works', '#how'],
  ['Roles', '#roles'],
  ['Courses', '#courses'],
  ['FAQ', '#faq'],
];

export default function WelcomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [progress, setProgress] = useState(0);
  const [wordIx, setWordIx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setWordIx((i) => (i + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > 12);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <div className="site">
      <div className="scroll-bar" style={{ width: `${progress}%` }} />
      <header className={`site-head ${scrolled ? 'scrolled' : ''}`}>
        <div className="site-head-in">
          <a href="#top" className="site-logo">
            <Image src="/evoluz-logo.png" alt="Evoluz" width={150} height={40} priority style={{ width: 150, height: 'auto' }} />
          </a>
          <nav className="site-nav" aria-label="Sections">
            {NAV.map(([label, href]) => (
              <a key={href} href={href}>{label}</a>
            ))}
          </nav>
          <Link href="/login" className="btn primary">Sign In</Link>
        </div>
      </header>

      <section id="top" className="hero">
        <div className="hero-bg" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <div className="hero-copy">
          <p className="hero-pill"><i /> Evoluz Academy · Training Management</p>
          <h1>
            Every <span className="word" key={wordIx}>{WORDS[wordIx]}</span>. Every Topic.
            <br />
            <em>One Clear Picture.</em>
          </h1>
          <p className="hero-sub">
            Plan courses, assign trainers, log sessions and watch each person&apos;s progress grow. One calm place for admins, trainers and trainees.
          </p>
          <div className="hero-cta">
            <Link href="/login" className="btn primary big">Sign In With Zoho</Link>
            <a href="#tour" className="btn big">Watch The Tour</a>
          </div>
          <div className="hero-trust">
            <div className="avatars"><i>A</i><i>T</i><i>L</i><i>+</i></div>
            <span>Trusted by admins, trainers and trainees across the Evoluz team</span>
          </div>
          <ul className="hero-points">
            <li>✓ Zoho single sign-in</li>
            <li>✓ Role based views</li>
            <li>✓ Live progress</li>
          </ul>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="float-card f1"><small>Course Progress</small><b>82%</b><div className="mini-bar"><i style={{ width: '82%' }} /></div></div>
          <div className="float-card f2"><span className="dot ok">✓</span><div><b>Session Logged</b><small>Zoho CRM · 6 attendees</small></div></div>
          <div className="float-card f3"><span className="dot">♧</span><div><b>Trainer Assigned</b><small>Shivangi Kumari</small></div></div>
          <div className="float-card f4"><small>Topics Completed</small><b>24 / 37</b></div>
          <div className="hero-orb"><span>⌂</span></div>
          <div className="ring r1" /><div className="ring r2" />
          <div className="float-card f5"><span className="dot">★</span><div><b>25+ Courses</b><small>Ready to teach</small></div></div>
        </div>
      </section>

      <section className="stats-band">
        <Reveal className="stats-in">
          {[
            ['Courses', 25, '+'],
            ['Topics', 550, '+'],
            ['Roles', 3, ''],
            ['Sign In', 1, ' Click'],
          ].map(([k, v, s]) => (
            <div key={String(k)} className="stat-big">
              <b><Counter to={Number(v)} suffix={String(s)} /></b>
              <span>{k}</span>
            </div>
          ))}
        </Reveal>
      </section>

      <section id="features" className="block">
        <Reveal>
          <p className="kicker">Features</p>
          <h2 className="block-title">Everything A Training Team Needs</h2>
          <p className="block-sub">From the first onboarding day to the last assessment, every step has a home.</p>
        </Reveal>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 90} className="feature">
              <span className="feature-ico">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="block showcase">
        <Reveal className="show-copy">
          <p className="kicker left">Live Progress</p>
          <h2 className="block-title left">Watch Learning Grow In Real Time</h2>
          <p className="block-sub left">Every logged session updates the numbers instantly, so managers, trainers and learners always see the same picture.</p>
          <ul className="tick-list">
            <li>Course completion per learner</li>
            <li>Overdue topics highlighted early</li>
            <li>Trainer delivery at a glance</li>
          </ul>
          <Link href="/login" className="btn primary big">Get Started</Link>
        </Reveal>
        <Reveal delay={150} className="show-panel">
          <div className="panel-head"><b>Course Completion</b><span className="live"><i /> Live</span></div>
          {SHOWCASE.map((s) => (
            <div key={s.label} className="bar-row">
              <span>{s.label}</span>
              <div className={`bar bar-${s.tone}`}><i style={{ ['--w' as string]: `${s.value}%` }} /></div>
              <b>{s.value}%</b>
            </div>
          ))}
          <div className="panel-foot">
            <div><b>128</b><small>Sessions Logged</small></div>
            <div><b>46</b><small>Active Learners</small></div>
            <div><b>12</b><small>Trainers</small></div>
          </div>
        </Reveal>
      </section>

      <section className="block">
        <Reveal>
          <p className="kicker">Why Evoluz Academy</p>
          <h2 className="block-title">Built To Make Training Easier</h2>
          <p className="block-sub">Less admin, more teaching. Here is what teams gain from day one.</p>
        </Reveal>
        <div className="benefit-grid">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 3) * 100} className="benefit">
              <span className="benefit-ico">{b.icon}</span>
              <div><h3>{b.title}</h3><p>{b.text}</p></div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="tour" className="block tinted">
        <Reveal>
          <p className="kicker">Take A Tour</p>
          <h2 className="block-title">See It In Action</h2>
          <p className="block-sub">Our guide walks through each part of the academy. Click any item to jump straight to it.</p>
        </Reveal>
        <Reveal delay={120}>
          <TourSection />
        </Reveal>
      </section>

      <section id="video" className="block">
        <Reveal>
          <p className="kicker">Training Video</p>
          <h2 className="block-title">Watch How It Works</h2>
          <p className="block-sub">A short guided video, with our robot as your host.</p>
        </Reveal>
        <Reveal delay={120}>
          <TrainingVideo />
        </Reveal>
      </section>

      <section id="how" className="block">
        <Reveal>
          <p className="kicker">How It Works</p>
          <h2 className="block-title">Up And Running In Four Steps</h2>
        </Reveal>
        <div className="steps">
          {HOW.map((h, i) => (
            <Reveal key={h.n} delay={i * 120} className="step">
              <span className="step-n">{h.n}</span>
              <h3>{h.title}</h3>
              <p>{h.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="roles" className="block tinted">
        <Reveal>
          <p className="kicker">Roles</p>
          <h2 className="block-title">The Right View For Everyone</h2>
          <p className="block-sub">Each person sees what they need and nothing they don&apos;t.</p>
        </Reveal>
        <div className="role-grid">
          {ROLES.map((r, i) => (
            <Reveal key={r.name} delay={i * 120} className={`role role-${r.tone}`}>
              <div className="role-top">
                <span className="role-badge">{r.name}</span>
                <small>{r.line}</small>
              </div>
              <ul>
                {r.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="courses" className="block">
        <Reveal>
          <p className="kicker">Course Library</p>
          <h2 className="block-title">A Full Zoho Curriculum, Ready To Teach</h2>
          <p className="block-sub">From the common onboarding path to role-based practice across the Zoho suite.</p>
        </Reveal>
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[...COURSES, ...COURSES].map((c, i) => <span key={i} className="chip">{c}</span>)}
          </div>
        </div>
        <div className="marquee rev" aria-hidden="true">
          <div className="marquee-track">
            {[...COURSES].reverse().concat([...COURSES].reverse()).map((c, i) => <span key={i} className="chip alt">{c}</span>)}
          </div>
        </div>
      </section>

      <section className="block">
        <Reveal>
          <p className="kicker">Voices</p>
          <h2 className="block-title">What Teams Say</h2>
        </Reveal>
        <div className="quote-grid">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.n} delay={i * 120} className="quote">
              <span className="quote-mark">“</span>
              <p>{t.q}</p>
              <div className="quote-by"><i>{t.n[0]}</i><div><b>{t.n}</b><small>{t.r}</small></div></div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="faq" className="block tinted">
        <Reveal>
          <p className="kicker">FAQ</p>
          <h2 className="block-title">Questions, Answered</h2>
        </Reveal>
        <div className="faq">
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <div className={`faq-item ${open === i ? 'open' : ''}`}>
                <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                  <span>{f.q}</span>
                  <i>{open === i ? '−' : '+'}</i>
                </button>
                <div className="faq-body"><p>{f.a}</p></div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <Reveal className="cta-in">
          <h2>Ready To Bring Your Training Together?</h2>
          <p>Sign in with Zoho and see every learner, course and session in one place.</p>
          <Link href="/login" className="btn big cta-btn">Sign In To Evoluz Academy</Link>
        </Reveal>
      </section>

      <footer className="site-foot">
        <div className="site-foot-in">
          <Image src="/evoluz-logo.png" alt="Evoluz" width={120} height={32} style={{ width: 120, height: 'auto' }} />
          <nav aria-label="Footer">
            {NAV.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
            <Link href="/login">Sign In</Link>
          </nav>
          <small>© {new Date().getFullYear()} Evoluz Academy · Think · Innovate · Grow</small>
        </div>
      </footer>
    </div>
  );
}
