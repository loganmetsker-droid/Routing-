import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OnboardingEmailService {
  private readonly logger = new Logger(OnboardingEmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: {
    to: string;
    subject: string;
    message: string;
    actionLabel: string;
    actionUrl: string;
  }) {
    const token = this.config.get<string>('POSTMARK_SERVER_TOKEN');
    const from =
      this.config.get<string>('POSTMARK_FROM_EMAIL') ||
      this.config.get<string>('NOTIFICATION_FROM_EMAIL');
    if (!token || !from) return { status: 'SKIPPED' as const };

    const baseUrl = String(
      this.config.get('PUBLIC_APP_URL') ||
        this.config.get('FRONTEND_URL') ||
        'https://trytrovan.com',
    ).replace(/\/$/, '');
    const actionUrl = input.actionUrl.startsWith('http')
      ? input.actionUrl
      : `${baseUrl}${input.actionUrl}`;

    try {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-postmark-server-token': token,
        },
        body: JSON.stringify({
          From: from,
          To: input.to,
          Subject: input.subject,
          TextBody: `${input.message}\n\n${input.actionLabel}: ${actionUrl}`,
          HtmlBody: `<p>${escapeHtml(input.message)}</p><p><a href="${escapeHtml(actionUrl)}">${escapeHtml(input.actionLabel)}</a></p>`,
          MessageStream: 'outbound',
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        this.logger.warn(`Onboarding email failed with status ${response.status}`);
        return { status: 'FAILED' as const };
      }
      return { status: 'SENT' as const };
    } catch (error) {
      this.logger.warn(`Onboarding email failed: ${error instanceof Error ? error.message : error}`);
      return { status: 'FAILED' as const };
    }
  }
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
