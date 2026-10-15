/** HTML email templates in the portal's look (navy/blue, rounded cards). Inline styles and tables so mail apps render them. */
export interface Email {
  to: string;
  toName: string;
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (d?: string) => (d ? new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'To be confirmed');

const row = (label: string, value: string) =>
  `<tr><td style="padding:11px 0;border-bottom:1px solid #eef1f6;color:#7a879c;font-size:12px;width:38%">${esc(label)}</td><td style="padding:11px 0;border-bottom:1px solid #eef1f6;color:#18243b;font-size:13px;font-weight:700">${value}</td></tr>`;

function shell(o: { origin: string; accent: string; tag: string; title: string; intro: string; body: string; cta: string; link: string; foot: string }) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f7f9fc;font-family:'DM Sans',Segoe UI,Arial,sans-serif;color:#18243b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e9edf4;border-radius:16px;overflow:hidden">
<tr><td style="background:#253f9b;background-image:linear-gradient(120deg,#253f9b,#3158b6 60%,#2e70c7);padding:26px 30px">
  <img src="${o.origin}/evoluz-logo.png" alt="Evoluz Academy" height="34" style="display:block;background:#ffffff;border-radius:9px;padding:6px 10px;height:34px">
  <div style="margin-top:20px;display:inline-block;background:${o.accent};color:#ffffff;border-radius:20px;padding:5px 11px;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">${esc(o.tag)}</div>
  <div style="margin-top:12px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-.5px;line-height:1.25">${o.title}</div>
</td></tr>
<tr><td style="padding:28px 30px 10px">
  <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#41506a">${o.intro}</p>
  ${o.body}
</td></tr>
<tr><td align="center" style="padding:18px 30px 30px">
  <a href="${o.link}" style="display:inline-block;background:#3158b6;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px">${esc(o.cta)}</a>
  <p style="margin:14px 0 0;font-size:11px;color:#98a3b1">Or open this link: <a href="${o.link}" style="color:#3158b6">${o.link}</a></p>
</td></tr>
<tr><td style="background:#f4f7fc;padding:18px 30px;border-top:1px solid #e9edf4;font-size:11px;color:#8d98a8;line-height:1.6">${o.foot}<br>Evoluz Academy · Training management portal</td></tr>
</table></td></tr></table></body></html>`;
}

const card = (rows: string, tone: 'blue' | 'amber') =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${tone === 'blue' ? '#f4f8ff' : '#fff8ec'};border:1px solid ${tone === 'blue' ? '#dbe6fa' : '#f6e3bf'};border-radius:12px;padding:6px 18px">${rows}</table>`;

export function welcomeEmail(p: { origin: string; name: string; email: string; role: string }): Email {
  const link = `${p.origin}/login`;
  const first = p.name.split(' ')[0];
  const html = shell({
    origin: p.origin,
    accent: '#168767',
    tag: 'Welcome',
    title: `Welcome to Evoluz Academy, ${esc(first)}`,
    intro: `Hi ${esc(first)}, your account on the Evoluz Academy portal is ready. Sign in to see your courses, track your progress and keep in touch with your trainer.`,
    body:
      card(row('Your name', esc(p.name)) + row('Sign in with', esc(p.email)) + row('Your role', esc(p.role)) + row('Portal', `<a href="${link}" style="color:#3158b6">${link}</a>`), 'blue') +
      `<p style="margin:18px 0 0;font-size:12px;line-height:1.65;color:#76839a"><b style="color:#41506a">What you can do:</b> view assigned courses and topics, see start and due dates, follow your progress and get notified when something new is assigned.</p>`,
    cta: 'Open the portal',
    link,
    foot: 'You received this because an administrator added you to Evoluz Academy. If this is a mistake, please ignore this email.',
  });
  const text = `Hi ${first},\n\nWelcome to Evoluz Academy. Your account is ready.\nSign in with: ${p.email}\nRole: ${p.role}\nPortal: ${link}\n\nRegards,\nEvoluz Academy`;
  return { to: p.email, toName: p.name, subject: 'Welcome to Evoluz Academy: your portal invitation', html, text };
}

export interface AssignInfo {
  origin: string;
  course: string;
  /** who gives the course */
  trainer: string;
  /** who attends */
  trainee: string;
  topics: number;
  start?: string;
  due?: string;
  assignedBy?: string;
}

export function courseAssignedTrainee(p: AssignInfo & { toName: string; toEmail: string }): Email {
  const link = `${p.origin}/login`;
  const first = p.toName.split(' ')[0];
  const html = shell({
    origin: p.origin,
    accent: '#3158b6',
    tag: 'New course',
    title: `${esc(p.course)} has been assigned to you`,
    intro: `Hi ${esc(first)}, you have been assigned a new course on Evoluz Academy. Here are the details so you can plan your learning.`,
    body:
      card(
        row('Course', esc(p.course)) + row('Your trainer', esc(p.trainer || 'To be confirmed')) + row('Topics', String(p.topics)) + row('Start date', fmt(p.start)) + row('Due date', fmt(p.due)) + (p.assignedBy ? row('Assigned by', esc(p.assignedBy)) : ''),
        'blue'
      ) +
      `<p style="margin:18px 0 0;font-size:12px;line-height:1.65;color:#76839a">Open the portal to see every topic and follow your progress as your trainer completes each session.</p>`,
    cta: 'View my course',
    link,
    foot: 'You received this because a course was assigned to you on Evoluz Academy.',
  });
  const text = `Hi ${first},\n\nYou have been assigned the course "${p.course}".\nTrainer: ${p.trainer || 'To be confirmed'}\nTopics: ${p.topics}\nStart: ${fmt(p.start)}\nDue: ${fmt(p.due)}\n\nOpen the portal: ${link}\n\nRegards,\nEvoluz Academy`;
  return { to: p.toEmail, toName: p.toName, subject: `Course assigned: ${p.course}`, html, text };
}

export function courseAssignedTrainer(p: AssignInfo & { toName: string; toEmail: string }): Email {
  const link = `${p.origin}/login`;
  const first = p.toName.split(' ')[0];
  const html = shell({
    origin: p.origin,
    accent: '#c88521',
    tag: 'Training to deliver',
    title: `You will deliver ${esc(p.course)}`,
    intro: `Hi ${esc(first)}, you have been named the trainer for a course on Evoluz Academy. Here is who will attend and when.`,
    body:
      card(
        row('Course', esc(p.course)) + row('Attending trainee', esc(p.trainee)) + row('Topics to deliver', String(p.topics)) + row('Start date', fmt(p.start)) + row('Due date', fmt(p.due)) + (p.assignedBy ? row('Assigned by', esc(p.assignedBy)) : ''),
        'amber'
      ) +
      `<p style="margin:18px 0 0;font-size:12px;line-height:1.65;color:#76839a">Open the portal to see the topic list, record each session you deliver and keep the trainee's progress up to date.</p>`,
    cta: 'Open the course',
    link,
    foot: 'You received this because you were named as trainer for a course on Evoluz Academy.',
  });
  const text = `Hi ${first},\n\nYou will deliver the course "${p.course}".\nTrainee: ${p.trainee}\nTopics: ${p.topics}\nStart: ${fmt(p.start)}\nDue: ${fmt(p.due)}\n\nOpen the portal: ${link}\n\nRegards,\nEvoluz Academy`;
  return { to: p.toEmail, toName: p.toName, subject: `Training assigned to you: ${p.course} for ${p.trainee}`, html, text };
}
