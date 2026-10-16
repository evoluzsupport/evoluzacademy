import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

/**
 * Sends one email. Uses Zoho/any SMTP when SMTP_HOST, SMTP_USER, SMTP_PASS are set,
 * otherwise Resend (RESEND_API_KEY). EMAIL_FROM is the sender address.
 * Only signed-in admins and trainers may call it, so it can't be used as an open relay.
 */
export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const { data: prof } = await sb.from('profiles').select('role').eq('auth_user_id', u.user.id).maybeSingle();
  if (!prof || (prof.role !== 'admin' && prof.role !== 'trainer'))
    return NextResponse.json({ error: 'Only admins and trainers can send email' }, { status: 403 });

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || smtpUser;
  const useSmtp = !!(smtpHost && smtpUser && smtpPass);
  if (!from || (!useSmtp && !key)) return NextResponse.json({ error: 'not-configured' }, { status: 501 });

  const { to, subject, html, text } = (await req.json()) as { to?: string; subject?: string; html?: string; text?: string };
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) || !subject || !html)
    return NextResponse.json({ error: 'Missing recipient, subject or body' }, { status: 400 });

  if (useSmtp) {
    const port = Number(process.env.SMTP_PORT || 465);
    const mailer = nodemailer.createTransport({ host: smtpHost, port, secure: port === 465, auth: { user: smtpUser, pass: smtpPass } });
    try {
      await mailer.sendMail({ from, to, subject, html, text });
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: 'The mail server rejected the message. Check the SMTP settings.' }, { status: 502 });
    }
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!r.ok) return NextResponse.json({ error: 'The email service rejected the message' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
