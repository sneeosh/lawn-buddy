// Email send via the Cloudflare Workers `send_email` binding.
//
// Setup required (do once in your Cloudflare account):
//   1. Add a domain to Cloudflare and enable Email Routing.
//   2. Add destination addresses (the recipients you want to email) and verify them.
//   3. Set EMAIL_FROM in wrangler.toml to a sender on your routing-enabled domain
//      (e.g. "lawn-buddy@yourdomain.com").
//
// Note: Cloudflare Workers send_email can only deliver to addresses that are
// verified destinations in your Email Routing setup. For v1 (single user) this
// is fine; multi-user growth will require a transactional provider (Resend etc).

import { createMimeMessage } from 'mimetext';
import type { Env } from '../types';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(env: Env, msg: EmailMessage): Promise<void> {
  if (!env.EMAIL || !env.EMAIL_FROM) {
    console.warn('[email] binding or EMAIL_FROM not configured; skipping send', {
      to: msg.to,
      subject: msg.subject,
    });
    return;
  }

  const mime = createMimeMessage();
  mime.setSender({ name: 'Lawn Buddy', addr: env.EMAIL_FROM });
  mime.setRecipient(msg.to);
  mime.setSubject(msg.subject);
  mime.addMessage({ contentType: 'text/plain', data: msg.text });

  // EmailMessage class is provided at runtime by the workerd `cloudflare:email` module.
  // We import it dynamically to avoid build-time resolution (no published types).
  const { EmailMessage: CfEmailMessage } = await import('cloudflare:email' as string);
  const email = new CfEmailMessage(env.EMAIL_FROM, msg.to, mime.asRaw());
  await env.EMAIL.send(email);
}
