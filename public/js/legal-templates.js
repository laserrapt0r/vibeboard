// Formulierungshilfen für Impressum und Datenschutzerklärung (keine Rechtsberatung).
// Platzhalter stehen in [eckigen Klammern].

export const IMPRINT_TEMPLATE = `# Angaben gemäß § 5 DDG

[Vor- und Nachname bzw. Name des Unternehmens/Vereins]
[Straße Hausnummer]
[PLZ Ort]

**Vertreten durch:** [Name der vertretungsberechtigten Person – nur bei Unternehmen und Vereinen]

# Kontakt

E-Mail: [kontakt@example.de]
Telefon: [+49 …]

# Registereintrag

[Nur falls vorhanden: Registergericht und Registernummer (Handels-, Vereins- oder Partnerschaftsregister)]

# Umsatzsteuer-ID

[Nur falls vorhanden: Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz]

# Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV

[Name und Anschrift – nur bei journalistisch-redaktionellen Inhalten erforderlich, sonst Abschnitt löschen]`;

export const PRIVACY_TEMPLATE = `# Verantwortlicher

Verantwortlich für die Datenverarbeitung in dieser Anwendung ist:

[Name bzw. Unternehmen]
[Anschrift]
E-Mail: [datenschutz@example.de]

[Falls bestellt: Kontaktdaten der oder des Datenschutzbeauftragten]

# Überblick

Diese Anwendung ist ein kollaboratives Online-Whiteboard (vibeboard). Sie wird von uns selbst betrieben [auf eigenen Servern / bei folgendem Hosting-Anbieter: …]. Es werden keine Tracking- oder Analysedienste eingesetzt und keine Inhalte von Drittanbietern wie Schriften oder Skripte geladen.

# Hosting und Server-Protokolle

[Angaben zum Hosting-Anbieter einschließlich Auftragsverarbeitungsvertrag nach Art. 28 DSGVO. Falls ein vorgeschalteter Webserver oder Reverse-Proxy Zugriffsprotokolle mit IP-Adressen führt: Umfang, Zweck und Speicherdauer angeben.]

# Benutzerkonto

Für die Nutzung ist ein Benutzerkonto erforderlich. Dabei verarbeiten wir:

- Name (Anzeigename) und E-Mail-Adresse (für die Anmeldung)
- Kennwort (ausschließlich als nicht umkehrbarer Hashwert gespeichert)
- optional: Schlüssel für die Zwei-Faktor-Anmeldung und gehashte Wiederherstellungscodes
- Zeitpunkte der Registrierung, der Bestätigung der E-Mail-Adresse und der letzten Anmeldung
- die gewählte Farbe für Mauszeiger und Avatar

Zweck ist die Bereitstellung des Kontos und der Funktionen der Anwendung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Nutzungsverhältnis). Die Daten werden gespeichert, bis das Konto gelöscht wird. Registrierungen, deren E-Mail-Adresse nicht bestätigt wurde, werden nach 14 Tagen automatisch gelöscht.

# Inhalte auf Boards

Inhalte, die du auf Boards erstellst (z. B. Notizen, Texte, Zeichnungen, Bilder, Kommentare), werden gespeichert und sind für alle Personen sichtbar, mit denen das jeweilige Board geteilt ist. Während der Zusammenarbeit sehen andere Teilnehmende deinen Anzeigenamen, deinen Mauszeiger und deine Auswahl in Echtzeit. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Die Inhalte bleiben gespeichert, bis sie oder das Board gelöscht werden. Gelöschte Boards liegen zunächst im Papierkorb ihrer Besitzerin bzw. ihres Besitzers und werden nach der dort angegebenen Frist endgültig gelöscht.

Reaktionen (Emojis) auf Elemente speichern wir mit deinem Anzeigenamen; sie sind für alle mit Zugriff auf das Board sichtbar. Dateianhänge (z. B. PDF- oder Office-Dateien) werden mit Dateiname, Größe und hochladender Person gespeichert, auf Schadsoftware geprüft und mit dem Board gelöscht; nicht mehr verwendete Dateien entfernen wir nach sieben Tagen. Eigene Vorlagen speichern wir ohne Autorennamen, Kommentare und Dateien, bis sie gelöscht werden.

Beim anonymen Sammeln (z. B. in Retrospektiven) speichern wir zu den Beiträgen keinen Namen – auch nicht nach dem Aufdecken. Bei Schnellumfragen (z. B. Stimmungsabfrage) kennt der Server deine Stimme nur, solange die Umfrage läuft, damit du sie ändern kannst; mit dem Auflösen werden die Einzelstimmen verworfen und nur das Gesamtergebnis (Anzahl je Antwort) gespeichert.

Zum Schutz vor Datenverlust speichern wir frühere Stände eines Boards als Versionen (automatisch höchstens alle 30 Minuten während der Bearbeitung sowie auf Wunsch). Versionen enthalten die Inhalte des Boards zum jeweiligen Zeitpunkt und den Namen der Person, die sie angelegt hat. Ältere Versionen werden automatisch gelöscht (es bleiben höchstens 20 automatische, 30 gesicherte und 5 vor einer Wiederherstellung angelegte Versionen je Board); alle Versionen werden mit dem Board gelöscht. Nachrichten im Cursor-Chat sowie deine Abwesenheit (Wechsel in einen anderen Tab) werden nur in Echtzeit an die Teilnehmenden übertragen und nicht gespeichert.

Zu jedem Board führen wir einen Aktivitätsverlauf: Er zeigt allen mit Zugriff auf das Board, wer wann Elemente erstellt, geändert, gelöscht oder kommentiert hat (Anzeigename, Zeitpunkt, Art des Elements und ein kurzer Ausschnitt seines Textes). Außerdem speichern wir den Zeitpunkt deines letzten Besuchs, damit wir dir Änderungen seither zeigen können. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Einträge werden nach 90 Tagen gelöscht, spätestens mit dem Board.

# Kommentare, Erwähnungen und Benachrichtigungen

Kommentare speichern wir mit deinem Anzeigenamen und dem Zeitpunkt. Erwähnst du jemanden mit @Name, antwortet jemand in einem Kommentar-Thread, an dem du beteiligt bist, oder wird dir ein Kommentar als Aufgabe zugewiesen, legen wir eine Benachrichtigung an (Board, auslösende Person, Ausschnitt des Kommentars). Sie erscheint in der Glocke und – sofern du das nicht im Profil abgeschaltet hast – per E-Mail. Benachrichtigungen werden nach 90 Tagen gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.

[Nur aufnehmen, wenn Webhooks in der Administration eingeschaltet sind:] # Chat-Anbindung (Webhooks)

Auf eigenen Wunsch kannst du Benachrichtigungen an einen Chat-Kanal schicken lassen; Team-Verwaltende können neue Team-Boards und Retro-Zusammenfassungen an den Kanal des Teams senden. Dabei übertragen wir die Benachrichtigung (z. B. Name der auslösenden Person, Board-Name, Ausschnitt des Kommentars bzw. die Zusammenfassung) an den von dir angegebenen Dienst (z. B. Microsoft Teams, Slack, Matrix). Für die Verarbeitung dort gilt die Datenschutzerklärung dieses Dienstes. Die Webhook-Adresse speichern wir, bis du den Webhook löschst. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a bzw. b DSGVO.

# Teams und Ordner

Teams bestehen aus ihren Mitgliedern (Name, Rolle im Team). Mitglied wird man nur, wenn man eine Einladung annimmt; bis dahin speichern wir die offene Einladung (Team, eingeladene und einladende Person, Rolle, Zeitpunkt), und die eingeladene Person erhält eine Benachrichtigung. Mitglieder eines Teams sehen einander und erhalten Zugriff auf die Boards, die dem Team zugeordnet sind; die Team-Verwaltung sieht zusätzlich die E-Mail-Adressen der Mitglieder und Eingeladenen. Ordner dienen nur der Ordnung; persönliche Ordner sind nur für dich sichtbar. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.

# Aufzeichnungen (Rundgänge)

[Nur aufnehmen, wenn Aufzeichnungen in der Administration erlaubt sind:] Wer einen Rundgang aufzeichnet, speichert die Bewegung der eigenen Ansicht, des Mauszeigers und des Laserpointers sowie – nur bei ausdrücklicher Wahl – eine Tonaufnahme über das Mikrofon. Die Aufzeichnung ist für alle mit Zugriff auf das Board abspielbar und bleibt gespeichert, bis sie von der aufzeichnenden Person oder der Besitzerin bzw. dem Besitzer des Boards gelöscht wird, spätestens mit dem Board. Tonaufnahmen werden vor dem Speichern auf Schadsoftware geprüft. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, für Tonaufnahmen deine Einwilligung durch das bewusste Einschalten des Mikrofons (Art. 6 Abs. 1 lit. a DSGVO), die du durch Löschen der Aufzeichnung jederzeit widerrufen kannst.

# Gastzugang

[Nur aufnehmen, wenn der Gastzugang in der Administration eingeschaltet ist:] Über einen Gastlink können Personen ohne Benutzerkonto ein einzelnes Board ansehen oder kommentieren. Dabei verarbeiten wir den angegebenen Namen, die Inhalte, die der Gast erstellt (z. B. Kommentare), sowie die technisch notwendigen Sitzungsdaten (Cookie, IP-Adresse, Browser-Kennung, Zeitpunkt der letzten Aktivität). Der Gastzugang und seine Sitzung werden gelöscht, sobald der Link abläuft oder gesperrt wird; erstellte Kommentare bleiben mit dem angegebenen Namen auf dem Board, bis sie gelöscht werden. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b bzw. f DSGVO (Durchführung der Zusammenarbeit, zu der eingeladen wurde).

# Anmeldesitzungen und Cookies

Nach der Anmeldung setzen wir ein technisch notwendiges Cookie, das deine Sitzung kennzeichnet. Zu jeder Sitzung speichern wir die IP-Adresse, die Browser-Kennung und den Zeitpunkt der letzten Aktivität, damit du deine angemeldeten Geräte einsehen und abmelden kannst. Sitzungen enden nach 30 Tagen bzw. nach 14 Tagen ohne Aktivität. Rechtsgrundlage sind Art. 6 Abs. 1 lit. b und f DSGVO sowie § 25 Abs. 2 Nr. 2 TDDDG.

Im lokalen Speicher deines Browsers (localStorage) legen wir nur Ansichtseinstellungen wie Zoomstufe, dunkles Design oder Werkzeugoptionen ab sowie, ob die Echtzeit-Verbindung in deinem Netz das Ersatzverfahren braucht (7 Tage). Diese Daten werden nicht an uns übertragen.

# Sicherheitsprotokoll

Zum Schutz vor Missbrauch protokollieren wir sicherheitsrelevante Ereignisse (z. B. Anmeldungen, fehlgeschlagene Anmeldeversuche, Änderungen von Kennwort, E-Mail-Adresse oder Zwei-Faktor-Anmeldung sowie Verwaltungsaktionen) mit Zeitpunkt, IP-Adresse und Browser-Kennung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist die Sicherheit des Dienstes. Die Einträge werden nach 12 Monaten gelöscht.

# E-Mails

Wir senden E-Mails zur Bestätigung deiner E-Mail-Adresse, zum Zurücksetzen des Kennworts, zu Einladungen und Freigaben von Boards, bei Erwähnungen, Antworten und zugewiesenen Kommentaren (abschaltbar im Profil) sowie bei sicherheitsrelevanten Änderungen an deinem Konto. Der Versand erfolgt über [Mailserver bzw. E-Mail-Anbieter, ggf. mit Auftragsverarbeitungsvertrag].

# Prüfung auf kompromittierte Kennwörter

[Nur aufnehmen, wenn in der Administration unter „Sicherheit“ aktiviert:] Beim Festlegen eines Kennworts prüfen wir, ob es in bekannten Datenlecks vorkommt. Dazu werden die ersten fünf Zeichen eines SHA-1-Hashwerts des Kennworts an den Dienst „Pwned Passwords“ von Have I Been Pwned übermittelt. Das Kennwort selbst, dein Name oder deine E-Mail-Adresse werden nicht übertragen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.

# Empfänger

Eine Weitergabe deiner Daten an Dritte findet nicht statt, soweit sie nicht für den Betrieb erforderlich ist (Hosting, E-Mail-Versand) oder wir gesetzlich dazu verpflichtet sind.

# Deine Rechte

Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO) und Datenübertragbarkeit (Art. 20 DSGVO). Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO kannst du aus Gründen, die sich aus deiner besonderen Situation ergeben, widersprechen (Art. 21 DSGVO). Wende dich dazu an die oben genannte Kontaktadresse.

Außerdem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere bei der Behörde [deines Bundeslandes bzw. am Sitz des Verantwortlichen].`;
