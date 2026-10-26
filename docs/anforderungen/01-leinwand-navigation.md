# 01 – Leinwand und Navigation

### REQ-CANVAS-001 Unendliche Leinwand
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Jedes Board ist eine unbegrenzte zweidimensionale Fläche, auf der Elemente an beliebigen Koordinaten liegen können.
- **Akzeptanzkriterien:**
  - Elemente können in alle Richtungen beliebig weit vom Ursprung entfernt platziert werden.
  - Die Darstellung erfolgt vektorbasiert (SVG) und bleibt in jeder Zoomstufe scharf.

### REQ-CANVAS-002 Zoomen
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Die Ansicht lässt sich zwischen 1 % und 800 % zoomen.
- **Akzeptanzkriterien:**
  - Zoom per Mausrad (Standard) oder Strg + Mausrad, per Strg +/−, über die Zoomleiste und per Pinch-Geste auf Touch-Geräten.
  - Der Punkt unter dem Mauszeiger bzw. der Gestenmitte bleibt beim Zoomen an Ort und Stelle.
  - Strg+0 setzt auf 100 %, Umschalt+1 zeigt alle Inhalte, Umschalt+2 die Auswahl.
  - Die Zoomstufe wird in der Zoomleiste angezeigt und ist dort über ein Menü wählbar.

### REQ-CANVAS-003 Verschieben der Ansicht
- **Seit:** 1.0.0 · **Priorität:** Muss · **Status:** umgesetzt
- **Beschreibung:** Die sichtbare Ansicht lässt sich verschieben.
- **Akzeptanzkriterien:**
  - Verschieben mit gehaltener Leertaste, Hand-Werkzeug, mittlerer Maustaste, Trackpad-Scrollen oder Umschalt + Mausrad (horizontal).
  - Wird die Leertaste losgelassen, während ein anderes Fenster aktiv ist, bleibt der Verschiebemodus nicht hängen.

### REQ-CANVAS-004 Minimap
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Eine verkleinerte Übersicht zeigt alle Inhalte und den sichtbaren Ausschnitt.
- **Akzeptanzkriterien:**
  - Klicken oder Ziehen in der Minimap verschiebt die Ansicht dorthin.
  - Die Minimap lässt sich ein- und ausblenden und funktioniert auch per Touch.

### REQ-CANVAS-005 Raster, Einrasten und Hilfslinien
- **Seit:** 1.0.0 · **Priorität:** Soll · **Status:** umgesetzt
- **Beschreibung:** Ein Punktraster dient der Orientierung, optional rasten Elemente ein; beim Verschieben erscheinen Hilfslinien an Kanten und Mitten anderer Elemente.
- **Akzeptanzkriterien:**
  - Raster, Einrasten (20-px-Raster) und intelligente Hilfslinien sind in den Einstellungen einzeln schaltbar.
  - Mit gedrückter Strg-Taste werden Hilfslinien beim Ziehen vorübergehend ignoriert.

### REQ-CANVAS-006 Helles und dunkles Design
- **Seit:** 1.0.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Beschreibung:** Die Oberfläche kann hell oder dunkel dargestellt werden.
- **Akzeptanzkriterien:**
  - Die Wahl gilt für alle Seiten und bleibt im Browser gespeichert.

### REQ-CANVAS-007 Ansicht merken
- **Seit:** 1.0.0 · **Priorität:** Kann · **Status:** umgesetzt
- **Beschreibung:** Zoom und Position werden pro Board im Browser gespeichert und beim nächsten Öffnen wiederhergestellt.
- **Akzeptanzkriterien:**
  - Beim ersten Öffnen eines Boards werden alle Inhalte eingepasst angezeigt.
