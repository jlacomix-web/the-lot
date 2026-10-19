import { config } from './config.js';
let transport;
export async function sendMail({ to, subject, text }) {
  if (!config.smtpUrl) { console.log(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n${text}\n`); return; }
  if (!transport) { const nm = await import('nodemailer'); transport = nm.default.createTransport(config.smtpUrl); }
  await transport.sendMail({ from: config.mailFrom, to, subject, text });
}
