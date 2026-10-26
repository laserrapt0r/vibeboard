'use strict';
// E-Mail-Versand über den in der Admin-Oberfläche konfigurierten SMTP-Server
const nodemailer = require('nodemailer');
const settings = require('./settings');

function transportFor(smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.security === 'tls',
    requireTLS: smtp.security === 'starttls',
    ignoreTLS: smtp.security === 'none',
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    tls: { rejectUnauthorized: smtp.rejectUnauthorized !== false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layout(siteName, title, paragraphs, button) {
  const text = [title, '', ...paragraphs, ...(button ? ['', `${button.label}: ${button.url}`] : []), '', '— ' + siteName].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Helvetica,Arial,sans-serif;color:#1f2328">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;padding:28px 32px;border:1px solid #e3e5e8">
<div style="font-weight:800;font-size:18px;color:#4262ff;margin-bottom:18px">${escHtml(siteName)}</div>
<h1 style="font-size:20px;margin:0 0 14px">${escHtml(title)}</h1>
${paragraphs.map((p) => `<p style="line-height:1.55;margin:0 0 12px">${escHtml(p)}</p>`).join('')}
${button ? `<p style="margin:22px 0"><a href="${escHtml(button.url)}" style="background:#4262ff;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;display:inline-block">${escHtml(button.label)}</a></p>
<p style="font-size:12px;color:#6b7280;word-break:break-all">${escHtml(button.url)}</p>` : ''}
</div></body></html>`;
  return { text, html };
}

async function send(to, subject, title, paragraphs, button, smtpOverride) {
  const s = await settings.get();
  const smtp = smtpOverride || s.smtp;
  if (!smtp.host || !smtp.from) throw new Error('Kein Mailserver konfiguriert');
  const { text, html } = layout(s.general.siteName, title, paragraphs, button);
  const info = await transportFor(smtp).sendMail({ from: smtp.from, to, subject: `[${s.general.siteName}] ${subject}`, text, html });
  return info.messageId;
}

// Versand im Hintergrund – Fehler werden nur protokolliert
function sendQuietly(...args) {
  send(...args).catch((e) => console.error('E-Mail konnte nicht gesendet werden:', e.message));
}

module.exports = { send, sendQuietly, transportFor };
