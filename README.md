# UAT Issue Log

Einfache Web-App als Ersatz für die UAT-Issue-Excel. Läuft komplett im Browser
(HTML/CSS/JS, kein Build-Schritt) und speichert Einträge + Screenshots in
Supabase (kostenlose Stufe), damit alle im Team dieselbe Liste sehen.

## Setup (einmalig)

### 1. Supabase-Projekt anlegen
1. Auf [supabase.com](https://supabase.com) kostenloses Konto anlegen, neues Projekt erstellen.
2. Im Dashboard: **SQL Editor** → **New query** → Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen → **Run**.
   Das legt die Tabelle `issues`, die Zugriffsrechte und den Storage-Bucket `screenshots` an.
3. Im Dashboard: **Project Settings → API** → **Project URL** und **anon public key** kopieren.

### 2. App verbinden
In [`config.js`](config.js) die beiden Platzhalter ersetzen:

```js
const SUPABASE_URL = "https://DEIN-PROJEKT.supabase.co";
const SUPABASE_ANON_KEY = "DEIN-ANON-KEY";
```

Der `anon key` ist bewusst öffentlich nutzbar (kein Geheimnis) — geschützt wird
über die Row-Level-Security-Regeln aus `schema.sql`, nicht über Geheimhaltung
des Keys.

Die Namen für die Dropdowns stehen ebenfalls in `config.js` (`TEAM_NAMES`) und
können dort einfach ergänzt werden.

### 3. Auf GitHub Pages veröffentlichen
1. Änderungen committen und pushen.
2. Im GitHub-Repo: **Settings → Pages** → Source: `Deploy from a branch` →
   Branch `main`, Ordner `/ (root)` → **Save**.
3. Nach kurzer Zeit ist die Seite unter der angezeigten `github.io`-URL erreichbar.

## Nutzung

- **+ Neuer Eintrag** öffnet das Formular mit Datum, Reported by (Dropdown),
  Issue Explained, Why?, Owner (Dropdown), Resolved-Häkchen und Screenshots.
- Screenshots: im Feld **Strg+V** drücken (z. B. nach einem Snipping-Tool-Screenshot)
  oder auf die Fläche klicken, um eine Datei auszuwählen. Mehrere Screenshots pro
  Eintrag sind möglich.
- In der Tabelle kann der **Resolved**-Status direkt per Klick auf das Häkchen
  geändert werden — wird sofort gespeichert.
- Klick auf ein Screenshot-Thumbnail öffnet es in groß.
- 🗑 löscht einen Eintrag (mit Sicherheitsabfrage).

## Nach jedem Deploy: Versionsnummer hochzählen

`style.css` und `app.js` werden in [`index.html`](index.html) mit einem
`?v=3`-Suffix eingebunden, damit Browser nach einem Update nicht versehentlich
eine alte, gecachte Version anzeigen. Bei sichtbaren CSS/JS-Änderungen die
Zahl in beiden `<script>`/`<link>`-Tags um eins erhöhen.

## Lokal testen

Da die App reines statisches HTML/JS ist, reicht ein einfacher lokaler
Webserver, z. B.:

```bash
python -m http.server 8000
```

Danach `http://localhost:8000` öffnen.
