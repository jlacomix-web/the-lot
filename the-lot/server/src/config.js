const publicUrl = (process.env.PUBLIC_URL || 'https://localhost').replace(/\/$/, '');
export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  publicUrl,
  secureCookies: publicUrl.startsWith('https://'),
  smtpUrl: process.env.SMTP_URL || '',                       // empty = print emails to the server log (dev)
  mailFrom: process.env.MAIL_FROM || 'The Lot <no-reply@localhost>',
  requireVerified: (process.env.REQUIRE_EMAIL_VERIFICATION || 'true') !== 'false',
  sessionDays: 30,
};
