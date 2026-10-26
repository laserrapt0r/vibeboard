'use strict';
// Sicherheitsprotokoll: Anmeldungen, Kontoänderungen und Admin-Aktionen
const db = require('./db');
const { clientIp } = require('./http');

const LABELS = {
  login: 'Anmeldung',
  login_failed: 'Fehlgeschlagene Anmeldung',
  login_mfa_failed: 'Falscher Zwei-Faktor-Code',
  logout: 'Abmeldung',
  register: 'Registrierung',
  email_verified: 'E-Mail bestätigt',
  email_changed: 'E-Mail-Adresse geändert',
  password_changed: 'Kennwort geändert',
  password_reset: 'Kennwort zurückgesetzt',
  mfa_enabled: 'Zwei-Faktor-Anmeldung aktiviert',
  mfa_disabled: 'Zwei-Faktor-Anmeldung deaktiviert',
  recovery_code_used: 'Wiederherstellungscode verwendet',
  sessions_revoked: 'Sitzungen beendet',
  admin_user_created: 'Benutzer angelegt (Admin)',
  admin_user_updated: 'Benutzer geändert (Admin)',
  admin_user_deleted: 'Benutzer gelöscht (Admin)',
  admin_settings: 'Einstellungen geändert (Admin)',
  admin_board_owner: 'Board-Besitzer geändert (Admin)',
  upload_blocked: 'Upload abgelehnt (Virenscan/Dateityp)',
  app_upgraded: 'Anwendung aktualisiert',
};

// Schreibt einen Eintrag; Fehler beim Protokollieren dürfen die eigentliche Aktion nie verhindern
function log(req, event, { userId = null, actorId = null, details = null } = {}) {
  db.query('INSERT INTO audit_log (event, user_id, actor_id, ip, user_agent, details) VALUES ($1, $2, $3, $4, $5, $6)',
    [event, userId, actorId, req ? clientIp(req).slice(0, 64) : null, req ? String(req.headers['user-agent'] || '').slice(0, 200) : null, details])
    .catch((e) => console.error('Protokolleintrag fehlgeschlagen:', e.message));
}

module.exports = { log, LABELS };
