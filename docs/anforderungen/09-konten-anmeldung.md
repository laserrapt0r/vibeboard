# 09 – Konten und Anmeldung

### REQ-AUTH-001 Registrierung
- **Seit:** 2.0.0, geändert in 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Pflichtangaben: Benutzername (3–32 Zeichen, Buchstaben, Ziffern, `.` `_` `-`), E-Mail-Adresse, Kennwort; optional Anzeigename.
  - Das erste Konto einer Installation wird Administrator und ist sofort aktiv.
  - Weitere Registrierungen sind nur möglich, wenn ein Mailserver eingerichtet ist.
  - Registrierungsmodus *offen*, *mit Freigabe* oder *geschlossen* ([REQ-ADMIN-004](10-administration.md)).
  - Bei bereits verwendeter E-Mail-Adresse sieht die Antwort aus wie bei einer erfolgreichen Registrierung; die Inhaberin bzw. der Inhaber der Adresse erhält stattdessen einen Hinweis per E-Mail.
  - Geändert in 4.0.0: Pflichtangaben sind Name, E-Mail-Adresse und Kennwort. Der Name ist ein Anzeigename (1–60 Zeichen, Leerzeichen erlaubt, Steuerzeichen werden entfernt) und muss nicht eindeutig sein; einen eigenen Benutzernamen gibt es nicht mehr.

### REQ-AUTH-002 E-Mail-Bestätigung
- **Seit:** 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Nach der Registrierung wird ein Bestätigungslink verschickt (48 Stunden gültig, einmal verwendbar).
  - Eine Anmeldung ist erst nach Bestätigung möglich; die Anmeldeseite bietet dann „Bestätigungsmail erneut senden“ an.
  - Nie bestätigte Konten ohne Boards werden nach 14 Tagen gelöscht.
  - Der Token wird nach dem Öffnen aus der Adresszeile entfernt.

### REQ-AUTH-003 Keine Wegwerf-E-Mail-Adressen
- **Seit:** 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Adressen bekannter Wegwerf-Anbieter (Liste mit ca. 10.000 Domains, inklusive Subdomains) werden mit verständlicher Meldung abgelehnt.
  - Zusätzliche Sperrliste und optionale Erlaubnisliste (nur diese Domains) in der Administration.

### REQ-AUTH-004 Sichere Kennwörter
- **Seit:** 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Kennwortrichtlinie nach NIST SP 800-63B.
- **Akzeptanzkriterien:**
  - Mindestlänge 12 Zeichen (einstellbar 8–64), höchstens 256 Zeichen; keine erzwungenen Zeichenklassen.
  - Abgelehnt werden: die 10.000 häufigsten Kennwörter, bekannte Grundwörter mit angehängten Ziffern/Zeichen, Tastaturreihen und Folgen, Wiederholungen sowie Kennwörter, die Name oder E-Mail-Adresse enthalten (geändert in 4.0.0: Name statt Benutzername).
  - Optional: Abgleich mit der Pwned-Passwords-Datenbank per k-Anonymität (standardmäßig aus).
  - Eine Stärkeanzeige gibt beim Eintippen Rückmeldung; geprüft wird verbindlich auf dem Server.

### REQ-AUTH-005 Anmeldung
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Mit Benutzername oder E-Mail-Adresse und Kennwort.
  - Geändert in 4.0.0: Anmeldung nur noch mit E-Mail-Adresse und Kennwort. Übergang für ältere Konten ohne E-Mail-Adresse: Anmeldung mit dem bisherigen Namen, sofern genau ein Konto ohne Adresse diesen Namen trägt; die Startseite und die Administration weisen auf fehlende Adressen hin. „Kennwort vergessen“ und „Bestätigungsmail erneut senden“ arbeiten nur mit der E-Mail-Adresse.
  - Geändert in 4.0.1: Scheitert eine Anmeldung mit einer Eingabe ohne „@“, erklärt die Meldung, dass die Anmeldung mit der E-Mail-Adresse erfolgt (für alle solchen Eingaben gleich, unabhängig davon, ob ein Konto existiert). Das Formular weist unter dem Feld darauf hin.
  - Fehlermeldungen unterscheiden nicht zwischen unbekanntem Konto und falschem Kennwort.
  - Deaktivierte, unbestätigte und noch nicht freigeschaltete Konten erhalten eine passende Meldung (erst nach korrektem Kennwort).
  - Nach der Anmeldung wird zur ursprünglich aufgerufenen Seite weitergeleitet – nur innerhalb der Anwendung.

### REQ-AUTH-006 Zwei-Faktor-Anmeldung (TOTP)
- **Seit:** 3.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Einrichtung per QR-Code oder manuell eingegebenem Schlüssel; Aktivierung erst nach Eingabe eines gültigen Codes.
  - 10 Wiederherstellungscodes, jeweils einmal verwendbar, neu erzeugbar (mit Kennwortbestätigung).
  - Bei aktivierter Zwei-Faktor-Anmeldung wird nach dem Kennwort ein Code verlangt; ein Code kann nicht zweimal verwendet werden.
  - Ausschalten nur mit Kennwort; Hinweis-Mail bei Aktivierung und Deaktivierung.
  - Für Administratoren kann sie verpflichtend gemacht werden ([REQ-ADMIN-005](10-administration.md)).

### REQ-AUTH-007 Kennwort vergessen
- **Seit:** 2.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Link per E-Mail, eine Stunde gültig, einmal verwendbar; die Antwort verrät nicht, ob ein Konto existiert.
  - Nach dem Zurücksetzen werden alle Sitzungen beendet; die E-Mail-Adresse gilt dadurch als bestätigt.
  - Bei ungültigem neuem Kennwort bleibt der Link gültig.

### REQ-AUTH-008 Profil
- **Seit:** 2.0.0, geändert in 3.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Anzeigename und Farbe sind direkt änderbar.
  - Geändert in 4.0.0: Der Name ist Pflicht und für alle Funktionen der angezeigte Name (Board, Kommentare, Teams, Aktivität, Administration). Konten ohne E-Mail-Adresse werden auf der Startseite gebeten, eine Adresse zu ergänzen.
  - Eine neue E-Mail-Adresse wird erst nach Bestätigung über einen Link an die neue Adresse übernommen; die alte Adresse erhält einen Hinweis.
  - Kennwort ändern erfordert das aktuelle Kennwort, meldet andere Geräte ab und verschickt einen Hinweis.

### REQ-AUTH-009 Sitzungen und Geräte
- **Seit:** 2.0.0, geändert in 3.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Sitzungen gelten 30 Tage und enden nach 14 Tagen ohne Aktivität.
  - Unter „Sicherheit & Geräte“ sind alle Sitzungen mit Browser, Betriebssystem, IP-Adresse und letzter Aktivität sichtbar; einzelne oder alle anderen lassen sich beenden.
  - Abmelden, Kennwortwechsel und Deaktivierung beenden auch offene Live-Verbindungen der betroffenen Sitzungen.

### REQ-AUTH-010 Anmeldung über Keycloak
- **Seit:** 4.3.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Authorization Code Flow mit PKCE (S256), `state` und `nonce`; `state` ist einmalig und an den Browser gebunden.
  - ID-Token: nur asymmetrische Signaturen, Prüfung von Aussteller, Empfänger, Ablauf und `nonce`.
  - Unbestätigte Adressen werden abgelehnt, außer die Administration vertraut ihnen ausdrücklich.
  - Eine nötige Rolle oder Gruppe begrenzt den Zugang; eine Rolle oder Gruppe kann Adminrechte vergeben.
  - Abmelden führt zur Abmeldung beim Dienst. Das Ziel nach der Anmeldung bleibt erhalten und muss innerhalb der Anwendung liegen.

### REQ-AUTH-011 Anmeldung über LDAP und Active Directory
- **Seit:** 4.3.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Die Zuordnung ist für Active Directory vorbelegt (`objectGUID`, `sAMAccountName`, `mail`, `displayName`, `memberOf`, Filter ohne deaktivierte Konten) und änderbar.
  - Anmeldung im normalen Formular mit Anmeldename, UPN oder E-Mail-Adresse: Suche mit Dienstkonto, dann Bind als gefundene Person.
  - Nur `ldaps://` oder StartTLS, außer auf localhost. Serverzertifikate werden geprüft; eine eigene Zertifizierungsstelle ist möglich.
  - Eingaben werden im Filter maskiert, leere Kennwörter abgelehnt, mehrdeutige Treffer nicht angemeldet.
  - Fehlversuche sind auch je Verzeichniseintrag begrenzt, damit keine Kontosperre im AD entsteht.
  - Gruppen begrenzen den Zugang und vergeben Adminrechte, auf Wunsch mit verschachtelten Gruppen.
  - Fällt das Verzeichnis aus, erscheint eine klare Meldung; lokale Konten melden sich weiter an.

### REQ-AUTH-012 Einmalanmeldung per Kerberos
- **Seit:** 4.3.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - HTTP Negotiate (SPNEGO) mit Keytab, ohne vorgeschalteten Proxy-Dienst; die Antwort bestätigt den Dienst gegenüber dem Browser.
  - Nur Prinzipale des eingetragenen Realms; Dienstprinzipale werden abgelehnt.
  - Mit LDAP kommen Adresse, Name und Gruppen aus dem Verzeichnis und es entsteht dieselbe Identität wie bei LDAP; ohne LDAP ist die E-Mail-Domain Pflicht und es gilt Kurzname@Domain.
  - Browser ohne Kerberos landen ohne Fehlerseite wieder bei der Anmeldung; NTLM wird nicht akzeptiert.

### REQ-AUTH-013 Mehrere Anmeldemethoden und Verknüpfung
- **Seit:** 4.3.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - Lokal, Keycloak, LDAP und Kerberos können gleichzeitig aktiv sein; die Anmeldeseite zeigt, was eingeschaltet ist. Standard: nur lokal.
  - Die lokale Anmeldung lässt sich auf Administratoren begrenzen, aber nie ganz abschalten (Notzugang). Das setzt eine eingeschaltete externe Methode und ein aktives Admin-Konto mit Kennwort voraus; auch das Abschalten der letzten Methode wird dann abgelehnt.
  - Die erste externe Anmeldung verknüpft ein Konto mit derselben Adresse. Admin-Konten nur nach Freigabe je Konto.
  - Neue Konten: automatisch aktiv, mit Freigabe oder gar nicht. Offene Einladungen werden eingelöst.
  - Name und Adresse folgen dem Verzeichnis. Die Rolle folgt ihm nur bei Konten ohne lokales Kennwort; die letzte Administration wird nie entzogen.
  - Rein externe Konten haben kein Kennwort: Kennwortwechsel, Zurücksetzen und Adressänderung sind gesperrt. Sie können die Zwei-Faktor-Anmeldung einrichten; zurücksetzen kann sie nur die Administration.
  - Ein eingerichteter zweiter Faktor gilt bei jeder Methode. „Administration nur mit Zwei-Faktor-Anmeldung“ gilt auch für LDAP; nur rein externe Konten mit Keycloak oder Kerberos sind ausgenommen.
  - Wird ein unbestätigtes Konto verknüpft, verliert es sein Kennwort, seine Sitzungen und offene Links (Schutz vor vorab angelegten Konten).
  - Solange eine externe Methode aktiv ist, lässt sich das letzte aktive Admin-Konto mit lokalem Kennwort weder deaktivieren noch herabstufen oder löschen.
  - Extern angemeldete Sitzungen gelten einstellbar kürzer (Standard: 7 Tage), damit im Verzeichnis gesperrte Personen herausfallen.

### REQ-AUTH-014 Anmeldung über SAML
- **Seit:** 4.4.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - SAML 2.0 mit signierten Assertions, `InResponseTo`-Prüfung und Bindung an den Browser. Unsignierte oder wiederholte Antworten werden abgelehnt.
  - Attribute für Adresse, Name und Gruppen sind einstellbar; Gruppen begrenzen den Zugang und vergeben Adminrechte. Metadaten sind abrufbar.
  - Für Verknüpfung und Notzugang gilt REQ-AUTH-013.

### REQ-AUTH-015 Konten über SCIM verwalten
- **Seit:** 4.4.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Akzeptanzkriterien:**
  - SCIM 2.0 für Benutzer: anlegen, lesen, suchen (`userName eq`), ändern (PUT, PATCH), sperren. Standardmäßig aus.
  - Zugriff nur mit Token aus der Administration; gespeichert wird nur sein Hash, angezeigt wird es einmal.
  - DELETE sperrt, statt zu löschen: Boards bleiben, Sitzungen enden sofort. Das letzte lokale Admin-Konto lässt sich nicht sperren, die Adresse lokaler Admins nicht ändern. Gruppen werden nicht übertragen.
