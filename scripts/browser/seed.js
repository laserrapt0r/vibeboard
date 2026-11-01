'use strict';
// Testkonten und Einstellungen für die Browsertests. Nur für Testdatenbanken.
const BASE = process.env.BASE || 'http://127.0.0.1:3310';
const ADMIN = { login: process.env.ADMIN_EMAIL || 'admin@test.example', password: process.env.ADMIN_PASSWORD || 'Rotkehlchen-Wolke-47' };
const PASSWORD = 'Gewitter-Laterne-83';

(async () => {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'X-Vibeboard': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) });
  if (!r.ok) throw new Error(`Anmeldung gescheitert: ${r.status}`);
  const headers = { 'X-Vibeboard': '1', 'Content-Type': 'application/json', Cookie: r.headers.getSetCookie()[0].split(';')[0] };
  const put = await fetch(`${BASE}/api/admin/settings`, { method: 'PUT', headers, body: JSON.stringify({ security: { requireVirusScan: false }, collab: { guestLinks: true } }) });
  if (!put.ok) throw new Error(`Einstellungen gescheitert: ${put.status}`);
  const people = [['Zweite Leitung', 'leitung@test.example', ADMIN.password, 'admin'], ...['Anna', 'Ben', 'Cleo', 'Dora'].map((n) => [n, `${n.toLowerCase()}@example.org`, PASSWORD, 'user'])];
  for (const [name, email, password, role] of people) {
    const u = await fetch(`${BASE}/api/admin/users`, { method: 'POST', headers, body: JSON.stringify({ name, email, password, role }) });
    // Vorhanden ist in Ordnung: Die Tests lassen sich so wiederholen
    if (!u.ok && u.status !== 409 && u.status !== 400) throw new Error(`Konto ${email}: ${u.status}`);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
