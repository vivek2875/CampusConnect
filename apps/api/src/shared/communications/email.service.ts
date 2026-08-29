import nodemailer from 'nodemailer';

import { env } from '../../config/env';
import { logger } from '../../observability/logger';

interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
}

export type EmailDeliveryMode = 'preview' | 'sent';

/**
 * Mail delivery is intentionally isolated from feature modules. A production SMTP/provider adapter
 * can replace this development-safe implementation without changing authentication use cases.
 */
let transporter: nodemailer.Transporter | undefined;

export async function sendEmail(email: OutboundEmail): Promise<EmailDeliveryMode> {
  if (!env.SMTP_URL) {
    logger.info({ to: email.to, subject: email.subject, preview: email.text }, 'Development email');
    return 'preview';
  }

  transporter ??= nodemailer.createTransport(env.SMTP_URL);
  await transporter.sendMail({ from: env.MAIL_FROM, ...email });
  return 'sent';
}
