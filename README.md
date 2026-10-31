# vibeboard

**English** · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md)

A self-hosted, collaborative online whiteboard. Several people work at the same time on an infinite canvas: with sticky
notes, shapes, connectors, mind maps, comments, votes and more than 75 templates for workshops, retrospectives, strategy
work, software development, project management and IT service management. For development teams there are code blocks,
diagrams from text (Mermaid syntax), estimation rounds and a card import from Jira or Excel exports. For teamwork there
are notifications for @mentions, an activity history, facilitation rights, teams and folders, time-limited guest links
and recorded walkthroughs. In addition there are user accounts with email confirmation and optional two-factor sign-in,
permissions per board and an administration interface. The data is stored in PostgreSQL.

- Runs entirely on your own server: no CDNs, no tracking, no mandatory dependency on external services.
- Uploaded files are scanned for malware with ClamAV.
- Automatic upgrades with backup: new versions update the database themselves on startup.
- All features are documented as requirements: [docs/anforderungen](docs/anforderungen/README.md) (the requirements documents are in German).
- Frontend in plain JavaScript and SVG, without a build step.
- Backend in Node.js with few dependencies (`pg`, `nodemailer`, `uqr`, `pdfjs-dist`, `ldapts`, `@node-saml/node-saml`, optionally `kerberos`).
- Interface in English, German, Spanish and French – the language follows the browser, the default is English.

![Real-time collaboration: mouse pointers with names, another person's selection and cursor chat](docs/screenshots/zusammenarbeit.png)

---

## Screenshots

| | |
|---|---|
| ![Board overview with “My tasks”](docs/screenshots/uebersicht.png) | ![Sprint planning with task panel and estimation round](docs/screenshots/sprint-schaetzrunde.png) |
| **Overview:** own and shared boards, “My tasks” across all boards | **Sprint planning:** cards with priority and story points, task panel, estimation round with hidden cards |
| ![Architecture diagram with curved connector and bend points](docs/screenshots/architektur-verbinder.png) | ![“Diagram from text” dialog with live preview](docs/screenshots/diagramm-aus-text.png) |
| **Connectors:** attach freely, curve, bend points, line ends | **Diagram from text:** Mermaid syntax becomes editable shapes |
| ![API design with table and code block](docs/screenshots/api-design-code.png) | ![Incident postmortem template](docs/screenshots/incident-postmortem.png) |
| **Software development:** tables and code blocks with syntax highlighting | **IT service management:** e.g. incident postmortem |
| ![Template gallery, category IT service management](docs/screenshots/vorlagen.png) | ![Administration with system metrics](docs/screenshots/administration.png) |
| **More than 75 templates** in 12 categories | **Administration:** overview with CPU, memory, disk space and more |

All content in the screenshots is sample data.

---

## Contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Templates](#templates)
- [Installation](#installation)
- [Configuration](#configuration)
- [Accounts and sign-in](#accounts-and-sign-in)
- [Permissions on boards](#permissions-on-boards)
- [Administration](#administration)
- [Accessibility](#accessibility)
- [Languages](#languages)
- [Virus protection for uploads](#virus-protection-for-uploads)
- [Versions and upgrades](#versions-and-upgrades)
- [Logging](#logging)
- [Security](#security)
- [Data storage and privacy](#data-storage-and-privacy)
- [Architecture](#architecture)
- [License](#license)

---

## Features

### Canvas and navigation
- Infinite canvas with zoom from 1 % to 800 %
- Pan with the space bar, hand tool, middle mouse button or trackpad; pinch zoom on touch devices
- Minimap, “Show all”, fixed zoom levels
- Dot grid, snap to grid, smart guides when moving
- Light and dark theme; the view is remembered per board

### Content
| Element | Options |
|---------|---------|
| **Sticky notes** | 16 colors, automatic font size, optionally with the author's name |
| **Text** | Font size, color, bold, italic, alignment, background |
| **Shapes** | More than 60 shapes in seven groups: basic shapes, flowchart (document, multiple documents, manual input, display, etc.), UML (class with compartments, actor, package, component, node, start/end, fork, signals), BPMN (events, gateways), network & data center (router, switch, firewall, load balancer, access point, internet, server, server rack, storage system, PC, smartphone), software & IT, container platform (pod, deployment, service, ingress, node, ConfigMap, secret, volume) – all custom drawings, with fill, border, line style and text |
| **Connectors** | straight, angled or curved; attach at any point of the outline (or automatically); dragging the line curves it, bend points can be inserted, moved and removed; movable label; 9 line ends (arrow, diamond, circle, crow's foot, etc.), line style |
| **Quick connect** | Click or drag the dots on a selected element to create connected elements |
| **Freehand** | Pen, highlighter, eraser |
| **Frames** | Areas or slides with formats (16:9, 4:3, A4, square, smartphone); the content moves along when the frame is moved |
| **Cards** | Tasks with description, assignee, due date, status, priority, story points, ticket number, labels and color |
| **Code blocks** | Source code with syntax highlighting for 13 languages, line numbers, light or dark scheme, copy button |
| **Diagram from text** | Enter flowcharts and sequence diagrams in Mermaid syntax, with live preview; the result is normal, editable shapes and connectors |
| **Tables** | Select cells and ranges; per cell bold, italic, underline, strikethrough, alignment, font size, text and cell color; insert and delete rows/columns anywhere; drag column widths and row heights; keyboard control like a spreadsheet |
| **Mind maps** | Select a node, then **Tab** for a child node and **Enter** for a sibling node |
| **Images** | by upload, drag & drop or from the clipboard; large images are scaled down automatically |
| **Stickers** | Emojis as freely placeable elements |
| **Links** | Attach a URL to elements; a link icon opens it |
| **Comments** | Threads anywhere, @mentions with suggestion list and notification, “Done” status, assign as a task (with due date), comment overview with the “Assigned to me” filter |

Pasting multi-line text into the board automatically creates one sticky note per line.

### Editing
- Multi-select with a selection rectangle or Shift-click
- **Resize:**
  - Side handles change only the width or height, also for flat elements such as Gantt bars.
  - Shift keeps the aspect ratio, Alt resizes from the center.
  - The size is displayed while dragging.
- **Snapping:**
  - to edges, centers and table lines of other elements
  - to equal width/height and to equal spacing (with distance markers)
  - to the grid (10–50 px selectable)
  - Shift moves only horizontally or vertically.
- **Exact values:** enter X, Y, width and height, also for several elements at once.
- **Multi-selection:**
  - Align (left, center, right, top, bottom), distribute evenly, line up seamlessly or with a fixed gap,
    arrange as a grid.
  - Same width, height or size; copy and apply size; align to grid.
- **Smart duplicate:** Ctrl+D repeats the most recently used offset.
- Cluster sticky notes by color
- Group, lock, layers (front and back), duplicate (also by Alt-dragging); a second click in a group selects a single
  element for editing
- Copy and paste, also between boards
- Undo and redo, context menu, search (Ctrl+F)
- Extensive keyboard shortcuts (overview with `?`)

### Real-time collaboration
- Changes appear immediately for all participants
- **Live cursors with names:**
  - The selection of others is marked in color and labeled with their name; anyone who is currently typing is shown as
    “✎ Name is writing …”.
  - People outside your own view appear as an arrow at the edge of the screen; a click jumps to them.
  - Absent people (other tab) are grayed out; everyone's views are shown as frames in the minimap.
  - Other people's mouse pointers can be hidden in the settings.
- **Cursor chat:** Press `/` to show a short message right at your own mouse pointer, without creating a comment
- Participant list with “Follow” (follow a person's view), “Bring everyone to me” and “Everyone follows me”
- **Private mode:** Everyone collects privately at first – new content is seen only by whoever created it, until it is
  revealed together. The server does not hand out the content to anyone else beforehand.
- Flying reactions (emojis) and laser pointer
- Automatic reconnection; unsent changes are not lost
- **Save status** in the header: “Saved” only once all your own changes have arrived in the database; otherwise
  “Saving …”, “Offline – n pending” or “Saving delayed”. As long as changes are stuck offline, the browser asks before
  the page is closed.
- **Loading indicator:** When a board is opened, a loading indicator appears after a short time, after a few seconds
  with a hint about a possible proxy. The home page shows placeholders, longer requests a progress bar.
- **No conflicts when editing together:** If several people change the same element at the same moment, everyone ends up with the same result. Changes to different properties (say, colour and text) are both kept; for the same property, the last change to reach the server wins.
- **Also works in restrictive networks:** No WebSockets are needed. Real-time transmission runs over Server-Sent Events
  (plain HTTP). If these are blocked too or buffered by a proxy, vibeboard switches to long polling after four seconds
  at the latest and remembers this in the browser for seven days – the next board then opens without waiting. With
  `?transport=sse` or `?transport=poll` the method can be forced.

  *Why can it take a while behind a forward proxy?* Server-Sent Events are an HTTP response that never ends. Some
  proxies (and virus scanners in proxies) hold back responses until they are complete or a buffer is full – in that
  case nothing arrives at the board at first. vibeboard therefore sends 2 KB of padding at the start (enough for many
  proxies) and detects a hanging stream by a missing start message.

### Teamwork
- **Notifications:** Bell on the home page and in the board for @mentions, replies and assigned comments – live and, if
  desired, by email (at most one per board every ten minutes, can be switched off in the profile).
- **Activity history:** who created, changed, deleted or commented what and when – summarized, with a jump to the
  element. On opening, a notice shows the changes by others since your last visit and marks them on the canvas.
- **“Comment” role** between view and edit – for business units, customers or reviews.
- **Teams and folders:** Share boards with a whole team (edit, comment or view), personal folders and folders in the
  team. New members are **invited** by email address and must accept the invitation (home page or bell); team admins
  see open invitations and can withdraw them.
- **Invitation without an account:** Boards and teams can also be shared with addresses that are not yet registered.
  After a confirmation prompt an invitation email is sent; after registering via the link, the board is shared or the
  person is in the team.
- **Guest links:** People without an account view or comment on a single board – time-limited, can be blocked at any
  time, switched off by default.
- **Record walkthroughs:** View, mouse pointer and laser pointer, with audio if desired; others play the walkthrough
  and can navigate on their own while doing so.
- **Reactions:** Emojis directly on sticky notes, cards & co. – with count and names, also for viewers (right-click).
- **Tags and filters:** Tag sticky notes, cards and shapes; the filter fades out everything else (by tag, color,
  person, reactions, action items) – only in your own view.
- **File attachments:** Place PDF, Word, Excel, PowerPoint, OpenDocument, text, CSV and JSON files on the board; PDFs
  with a preview of the first page and a viewer (pdf.js), all with virus scan and as a download.
- **Chat integration (webhooks):** Notifications to your own chat (Microsoft Teams, Slack, Matrix or JSON), team
  channels for new team boards and retro summaries. Switched off by default, with protection against calls into the
  internal network.

### Facilitation
- **Facilitation rights:** Lock editing for participants, reserve timer/vote/estimation round/private mode for
  facilitators, lock individual elements (e.g. template backgrounds) for participants. Further facilitators can be
  added via the avatar menu. The server enforces all locks.
- **Timer** for all participants, with pause, extension and signal tone
- **Votes** with an adjustable number of votes per person; the votes stay hidden until the end, after which there is a results list
- **Estimation round** with hidden cards for a card: Fibonacci, T-shirt or hours deck; the values stay hidden until
  revealed. Afterwards average, median and range appear, and the result can be applied as story points.
- **Presentation mode**: Frames become slides (full screen, arrow and space keys, surroundings hidden)
- **Hidden areas:** Facilitators cover a frame; participants see only a cover until it is revealed. The server does
  not hand out the content beforehand.

### Retrospectives
- **Guided flow** (🔁 button): Check-in → Look back → Collect → Reveal → Group → Vote → Discuss → Action items →
  Wrap-up. At each step vibeboard sets up the matching tools (hidden, optionally anonymous collecting, timer, vote on
  topics, discussion, polls).
- **Topic groups:** Select contributions → “Create topic group”; voting is then done on topics.
- **Discussion mode:** Topics in the order of the votes, the current one is highlighted for everyone, a timer per topic
  and the prompt “Keep discussing? 👍 ✋ 👎”.
- **Anonymous contributions:** Without names even after the reveal – none is stored.
- **Quick polls:** Mood meter, Fist of Five, ROTI, team health check, custom question – anonymous, with a trend across
  the retro series.
- **Action items with follow-up:** Contribution → “Record as action item” (person, due date) – appears under “My
  tasks”. “Create next retro” carries over the structure; there the look back shows the open action items from the last
  retro to tick off or carry over.
- **Summary** as Markdown, PDF, by email to those involved or to the team channel.
- **Wheel of fortune and speaking order** – everyone sees the same result.

### Project work
- **Task panel** per board:
  - All cards as a list, grouped by status, with story point totals.
  - Filters “Open”, “Assigned to me”, “Overdue”; a click jumps to the card.
- **My tasks** on the home page: all cards assigned to me from all my boards, sorted by due date.
- **Version history:**
  - Save snapshots, automatic versions every 30 minutes during editing.
  - Restore earlier snapshots (the current one is saved first) or open them as a copy.
- **Import cards** from CSV, Excel, Jira or Azure DevOps:
  - Columns such as Summary, Assignee, Status, Due Date, Story Points, Priority, Labels are recognized.
  - Optionally the cards are arranged as Kanban columns by status.
- **Direct links** to individual elements: `/board/<id>#el=<elementId>`

### Reviews and work items
- **Review documents on the board:** Put all pages of a PDF on the board as a frame, then comment and draw on them. Office files work with the optional converter.
- **Approvals:** Submit frames and files to reviewers. Approving needs only the comment role, changes invalidate an approval, and the status shows on the element.
- **Kanban and timeline:** Other views of the same cards, usable without a mouse.
- **Jira and Azure DevOps:** Cards and tickets stay in sync in both directions.
- **Automatic layout and swimlanes:** Arrange connected elements or a mind map with one click.
- **Charts from tables:** Bar, line and pie charts that follow the table.
- **Images and sketches:** Crop images, pen pressure, turn sketches into clean shapes.

More: [docs/integrations.md](docs/integrations.md).

### Export and import
- PNG (whole board or selection) and SVG
- PowerPoint: one slide per frame, with editable text and shapes
- Import from draw.io and PowerPoint
- PDF with one frame per page (via the browser's print dialog)
- JSON as a backup; import into the board or as a new board
- Cards from CSV/tables, diagrams from text (see above)

### Overview
- Navigation on the left: “+ New board”, Home, My tasks, all/own/shared boards, own folders, teams
  (with folders as a filter); only the selected view appears on the right
- Home: collapsible template bar, notice about due tasks, recently edited boards
- Own and shared boards with thumbnails
- Search, sorting, sharing, renaming, duplicating, deleting, leaving a board
- **Trash:** Deleted boards can be restored for 30 days (adjustable), then they are deleted permanently.
- New board directly from a template – also from **your own templates** (save a board or selection as a personal or
  team template)
- **Installable app (PWA):** can be used in its own window via “Install app” (account menu) in the browser
- “My tasks” across all boards (cards and assigned comments)
- Bell with notifications

---

## Templates

| Category | Templates |
|-----------|----------|
| Brainstorming | Brainstorming, Mind map, Six perspectives, Crazy 8s, Pros & cons |
| Meetings & retros | Start · Stop · Continue, Mad · Sad · Glad, 4L, Sailboat, Starfish, DAKI, Timeline retro, Hot-air balloon, Speedcar, Open topics round, Team radar, Daily stand-up, Check-in / Icebreaker |
| Agile & projects | Kanban, Eisenhower matrix, Impact/effort matrix, Project canvas, Product roadmap, Timeline, Gantt chart, User story map, Weekly planner |
| Strategy | SWOT analysis, Stakeholder map, Business Model Canvas¹, Lean Canvas¹, OKR planning, Decision matrix |
| Design & UX | Customer journey map, Empathy map, User persona, Moodboard, Wireframe |
| Software development | Sprint planning, Development Kanban with WIP limits, Definition of Ready & Done, Architecture (C4 context), ER diagram, Event Storming, Bug triage, Tech debt matrix, Release planning, API design, Architecture decision (ADR) |
| UML | Class diagram, Use case diagram, Activity diagram, State diagram, Component diagram, Deployment diagram, Sequence diagram |
| Project management | Project kick-off, Risk matrix, RAID log, Project status, Milestone plan, RACI matrix, Cross-team planning, Lessons learned |
| IT service management | Incident postmortem, Major incident command center, Problem analysis (Is / Is not), Change request & CAB, Service blueprint, SIPOC, Value stream analysis, Service catalog, On-call handover, Runbook, SLA / service review, Process model (BPMN): Incident |
| IT infrastructure | Network diagram, Rack layout, Container platform (cluster) |
| Diagrams | Flowchart, Org chart, Ishikawa (fishbone), 5 Whys method |

¹ Adaptation of a work under CC BY-SA 3.0, see [License](#license).

---

## Installation

### With Docker (recommended)

```bash
git clone https://github.com/laserrapt0r/vibeboard.git
cd vibeboard
cp .env.example .env            # set POSTGRES_PASSWORD to a long, random password
docker compose up -d --build    # starts PostgreSQL, ClamAV and vibeboard
```

After that, vibeboard is available at http://localhost:3000. The port is set by `PORT` in the `.env`.

Here is how to continue:
1. On the first visit the registration opens. **The first account automatically becomes administrator.**
2. Under **Administration → Mail server** enter the SMTP access. Only then can further people register, because every
   registration needs an email confirmation.
3. Under **Administration → General** enter the public address if vibeboard is reachable via a domain name.
4. Recommended: set up two-factor sign-in in the profile under “Security & devices”.

Alternatively, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and optionally `ADMIN_NAME` in the `.env` create the administrator on
startup (you sign in with the email address).

ClamAV needs about 1.5 GB of memory. On the first start it downloads the virus signatures for a few minutes; until then,
uploads are rejected with a notice.

Useful commands:

```bash
docker compose logs -f app                                        # log
docker compose down                                               # stop (data is kept)
docker compose exec db pg_dump -U vibeboard vibeboard > backup.sql  # back up the database
docker compose --profile mailtest up -d                           # additionally a test mail server (Mailpit)
```

With the `mailtest` profile, enter the SMTP server `mailpit`, port `1025`, encryption “none” in the administration. All
emails then appear at http://localhost:8025.

### Without Docker

Requirements: Node.js ≥ 20, PostgreSQL ≥ 13, ClamAV (`clamd`) for uploads and `pg_dump` for backups before upgrades.

```bash
npm ci
DATABASE_URL=postgres://benutzer:kennwort@localhost:5432/vibeboard \
CLAMAV_HOST=127.0.0.1 BACKUP_DIR=/var/backups/vibeboard node server.js
```

The tables are created and migrated automatically on startup.

---

### On Kubernetes

Use the [Helm chart](deploy/helm/README.md) or the manifests in [deploy/kubernetes](deploy/kubernetes/README.md). The app must run with exactly one replica.

## Configuration

Environment variables (with Docker in the `.env`):

| Variable | Default | Meaning |
|----------|----------|-----------|
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `POSTGRES_PASSWORD` | – (required) | Database password in the Docker setup |
| `POSTGRES_DB`, `POSTGRES_USER` | `vibeboard` | Database name and user in the Docker setup |
| `DATABASE_URL` | `postgres://vibeboard:vibeboard@localhost:5432/vibeboard` | Database connection without Docker (alternatively `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`) |
| `PUBLIC_URL` | – | Public address for links in emails, e.g. `https://board.example.de` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | – | Creates this administrator during initial setup – only if there is no active administrator yet and no account with that address (`ADMIN_USERNAME` is still accepted as the name) |
| `TRUST_PROXY` | `0` | Reverse proxy in front: `1` (one proxy), `2` … (several in a row) or a list of proxy addresses/networks, e.g. `127.0.0.1, 172.16.0.0/12`. Then evaluates `X-Forwarded-For` and `X-Forwarded-Proto` – see “Real IP addresses” |
| `CLAMAV_HOST`, `CLAMAV_PORT` | `clamav`, `3310` (Docker) | clamd service for the virus scan; empty = no scanner |
| `OFFICE_CONVERTER_URL` | – | Gotenberg service for Office files, see [integrations](docs/integrations.md) |
| `KRB5_KTNAME` | `/etc/krb5.keytab` | Keytab for Kerberos, see [sign-in](docs/authentication.md) |
| `BACKUP_DIR` | `/backups` (Docker) | Directory for backups before database upgrades; empty = no backup |
| `BACKUP_KEEP` | `10` | Number of backups kept |
| `BACKUP_BEFORE_UPGRADE` | `1` | `0` skips the backup (not recommended) |
| `ALLOW_DOWNGRADE` | `0` | `1` allows an older version to start on a newer database (not recommended) |
| `LOG_LEVEL` | `info` | Log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent`; can be changed at runtime in the administration |
| `LOG_FORMAT` | `text` | `text` (readable) or `json` (one JSON line per entry, e.g. for Loki, Elasticsearch, Graylog) |
| `DATA_DIR` | `./data` | Folder with JSON boards of an earlier file-based version for a one-time import |

You make all further settings in the administration.

---

## Accounts and sign-in

- **Sign in with the email address.** The name is only a display name: it may contain spaces, does not have to be
  unique and can be changed in the profile at any time. Older accounts without an email address can temporarily sign in
  with their name (only if it is unique) and are asked on the home page to add an address.
- **Registration** with name, email address and password.
  - The account only becomes active once the **confirmation link** from the email has been opened (valid for 48 hours).
  - The confirmation email can be requested again on the sign-in page.
  - Accounts that were never confirmed are removed automatically after 14 days.
- **Disposable email addresses** are blocked: a list of around 10,000 known providers, subdomains included.
  Additionally, the admin can block their own domains or allow only certain domains, e.g. the company domain.
- **Registration mode:**
  - *open*: After the email confirmation the account is active.
  - *with approval*: After the confirmation an admin activates the account. Admins are informed by email.
  - *closed*: Only admins create accounts or invite by email.
- **Password rules** according to NIST SP 800-63B:
  - Minimum length 12 characters (adjustable)
  - Rejected are the 10,000 most common passwords, known words with appended digits, keyboard sequences,
    repetitions and passwords that contain the name or email address.
  - Optionally also a check against “Have I Been Pwned” (k-anonymity).
  - A strength indicator helps with the choice. Forced special characters are deliberately not required.
- **Two-factor sign-in (TOTP):**
  - Set up via QR code with any common authenticator app
  - 10 recovery codes for emergencies
  - Can be made mandatory for administrators
- **Forgot password** via an email link (valid for one hour).
- **Profile:**
  - Display name and color
  - Email address; a new address is only adopted after confirmation, the old one receives a notice
  - Change password; other devices are signed out in the process
- **Security & devices:** Overview of all signed-in devices with last activity. Individual or all other devices can be
  signed out.
- **Notifications** by email for security-relevant changes: password changed, email address changed,
  two-factor sign-in turned on or off, registration attempt with an address that is already in use.

### External sign-in

Besides local accounts, vibeboard can use **Keycloak**, **SAML**, **LDAP/Active Directory** and **Kerberos single sign-on**, and accounts can be managed through **SCIM**. All are optional and configured under *Administration → Sign-in*; LDAP is preset for Active Directory. Several methods can be active at once, and local administrators always keep an emergency access. Setup: [docs/authentication.md](docs/authentication.md).

## Permissions on boards

- Boards belong to the person who created them. The owner can
  - invite people as *editors*, *commenters* or *viewers*, optionally with an invitation email. Invitations go to the
    **exact email address** or from the list of people you are in a team with. A search across all accounts is
    deliberately not offered – nobody can use it to query the users of the installation. If there is no account for the
    address, vibeboard offers an invitation email after a confirmation prompt (valid for 30 days; only if registration
    is open and a mail server is set up).
  - share the link with all signed-in users for *viewing*, *commenting* or *editing*,
  - assign the board to a **team** – all members then receive the chosen role,
  - create **guest links** for people without an account (only if an admin has switched on guest access),
  - manage members, rename the board and delete it.
- **Viewers** see the board live and can vote, estimate, send reactions, and use cursor chat and the laser pointer.
  The version history is visible only to editors.
- **Commenters** may additionally comment, assign and resolve comments, and record walkthroughs.
- If a role applies from several sources (membership, team, link), the highest one counts. Permission changes take
  effect immediately.
- **Guests** see only the board of their link – no home page, no other boards, no profile or team features. When the
  link expires or is blocked, their accesses are deleted; their contributions are kept with their names.
- **Administrators** have access to all boards.

## Administration

At `/admin`, for administrators only:

- **Overview:**
  - Users, share with two-factor sign-in, unconfirmed accounts
  - failed sign-ins in the last 24 hours
  - Boards, active connections, database size
  - Notices about pending approvals and missing settings
  - **System metrics**, updated every 5 seconds, with a history of the last 10 minutes:
    - CPU load of vibeboard and of the host, system load
    - Memory of vibeboard and of the container or host
    - Response time of the event loop
    - free disk space for the application and backups
    - Database connections and cache hit rate
    - Real-time connections, uptime, Node.js version
    - Tiles with bottlenecks are highlighted in red.
- **User management:**
  - Search and filters (pending, unconfirmed, deactivated, admins, without two-factor)
  - Create users, preferably by invitation email so that the person sets their own password
  - edit, activate, deactivate, grant admin rights
  - Resend the confirmation email or confirm the email manually
  - Create a password link, reset two-factor, end all sessions
  - delete, either transferring or deleting the boards as well; the last administrator is protected
- **Boards:** all boards with owner, members and sharing; change owner, delete
- **General:** Instance name, public address, registration mode
- **Security:** Minimum password length, check against “Have I Been Pwned”, disposable addresses, blocked or
  allowed domains, mandatory two-factor for admins
- **Collaboration:** Emails for mentions, guest access (off by default) and its maximum validity, who may create
  teams, allow recordings and their maximum duration, file attachments and maximum file size, retention in the trash,
  webhooks (off by default) and whether internal webhook targets are allowed
- **Mail server:** SMTP host, port, encryption (STARTTLS, SSL/TLS, none), sign-in, sender,
  certificate check; test email also before saving
- **Legal:** Edit and publish the legal notice and privacy policy (see below)
- **Log:** Security log of the last 12 months with search and filter. It contains
  - sign-ins and failed attempts,
  - password, email and two-factor changes,
  - admin actions with IP address.

### Legal notice and privacy policy

- Under **Administration → Legal** both texts are maintained and published. The editor supports simple formatting
  (headings, paragraphs, lists, bold, italic, links) and shows a live preview.
- **Templates** to insert:
  - a legal notice according to § 5 DDG
  - a privacy policy tailored to vibeboard's actual data processing (account, board content, session cookie,
    security log, emails, optionally Pwned Passwords, data subject rights)

  Placeholders are in [square brackets]. The templates are not a substitute for legal advice.
- The pages `/impressum` and `/datenschutz` are reachable **without signing in**.
- They are linked on the sign-in and registration page, in the board overview, in the settings menu of the boards
  and in the administration.
- Empty texts are not published; their links then disappear automatically.
- The texts are displayed without HTML. Entered markup appears as plain text, links are allowed only with http(s),
  mailto and tel.

---

## Accessibility

vibeboard aims for WCAG 2.2 AA outside the canvas, in the light and dark themes: full keyboard use of dialogs and menus, visible focus, skip links, screen reader announcements and reduced motion. On a board, the *Element list* offers the content as text; a chosen element can be moved with the arrow keys. Free drawing and arranging on the canvas remain visual. Automated checks with axe-core pass, but a test with real screen readers is still open.

## Languages

The interface, templates, error messages and emails are available in English, German, Spanish and French.

- The language follows the browser settings (first supported language); otherwise English applies. There is no
  separate selection in the application.
- Emails are sent in the recipient's most recently used language; invitations to addresses without an account in the
  language of the inviting person.
- Templates are created in the language of the person who inserts them; board content is not translated.
- The templates for the legal notice and privacy policy are in German because they refer to German law. The
  operator is responsible for these texts and enters them under Administration → Legal themselves.
- The dictionaries are in `public/i18n/`; `npm run check:i18n` checks them. The source language in the code is German.
  The requirements documents under `docs/anforderungen/` are in German.

## Virus protection for uploads

- **What is checked:** Every uploaded file, before it is stored or distributed to others:
  - Images via upload, drag & drop or clipboard
  - Images in imported boards
  - Thumbnails
- **How it is checked:**
  - With ClamAV via the clamd protocol. In the Docker setup ClamAV runs as its own service and updates its
    signatures on its own several times a day (`freshclam`).
  - In addition, the file content must match the stated image type (PNG, JPEG, GIF, WebP, SVG).
- **On a detection:**
  - The file is not stored and is removed again from the uploading person; they see a message with the
    name of the detection.
  - The event is recorded in the security log.
- **Without a scanner:**
  - If no scanner is set up or it is not reachable, uploads are rejected by default. Both can be set in the
    administration under “Security”.
- **Log:** Every check result is in the application log (`[uploads]`, with result, file type, size,
  short hash, duration and user ID – never the content). Detections, rejected file types and files accepted unchecked
  during a scanner outage are additionally in the security log.
- **In the administration:** Status and signature state are in the overview, along with blocked and unchecked
  accepted uploads of the last 30 days. If the signatures are older than three days, a warning appears.

## Versions and upgrades

- **Version numbers:** vibeboard follows [Semantic Versioning](https://semver.org/). The version is in
  `package.json`, all changes in the [CHANGELOG](CHANGELOG.md).
- **Automatic upgrade on startup:** When a new version is started, it updates the database itself –
  even across several versions:
  1. A database lock prevents parallel upgrades by several instances.
  2. If migrations are pending, a **backup** with `pg_dump` is created first (Docker: volume `backups`, the
     last 10 are kept). If it fails, the database stays unchanged and startup is aborted.
  3. The migrations run one after the other, each in its own transaction; an error is rolled back
     completely.
  4. Version, predecessor and backup are recorded in the version history (Administration → Overview).
- **Downgrade protection:** An older version does not start on a database that has already been used by a newer one.
- **Open boards** receive the notice “Reload” after an update.
- **Update in the Docker setup:** `git pull && docker compose up -d --build`.
- **Restoring a backup:**
  `docker compose exec -T db pg_restore -U vibeboard -d vibeboard --clean < sicherung.dump`
  (beforehand `docker compose stop app`).

---

## Logging

- **Levels** according to the usual scheme:

  | Level | Content |
  |---|---|
  | `fatal` | Errors that end operation (e.g. startup failed) |
  | `error` | Errors someone should fix (e.g. sending email, saving, unexpected server errors with stack trace) |
  | `warn` | Anomalies without failure (e.g. upgrade without backup, rejected uploads, slow requests over 2 s) |
  | `info` | important processes (startup, upgrades, changed log level) – **default** |
  | `debug` | additionally every request (method, path, status, duration) and rejected requests |
  | `trace` | everything |

- **Setting:**
  - Via `LOG_LEVEL`, or in the administration under “General → Logging”.
  - The setting in the administration applies immediately and is kept across restarts.
- **Format:**
  - `LOG_FORMAT=text` produces readable lines with timestamp (UTC), level, component and fields.
  - `LOG_FORMAT=json` writes one JSON line per entry, for log collection systems.
  - Errors and warnings go to stderr, everything else to stdout.
  - View in the Docker setup: `docker compose logs -f app`.
- **Request ID:**
  - Every request receives an ID. It is in the header `X-Request-Id` and in all log entries of that request.
  - On server errors the browser also receives the ID, so that an error can be found again in the log.
  - An upstream proxy can supply its own ID.
- **Data minimization:**
  - Passwords, tokens, cookies and keys are redacted automatically.
  - IP addresses, email addresses, query parameters and board content are not logged.
  - Security-relevant events are kept separately in the security log of the administration.

## Security

**Accounts**
- Passwords: scrypt with N=2¹⁷, r=8, p=1 (OWASP recommendation) and salt; constant-time comparison, also for
  unknown user names. Older hashes are renewed automatically at the next login.
- At most two hash computations at the same time, so that mass sign-in attempts cannot overload the server.
- Rate limits for sign-in, registration, two-factor codes, “Forgot password” and confirmation emails.
- TOTP codes cannot be reused; recovery codes are stored only as hashes.
- Protection against account enumeration:
  - “Forgot password” and “Resend confirmation email” always respond the same way.
  - A registration with an email address that is already in use looks from the outside like a normal registration.
    The owner of the address is informed by email instead.
- One-time links (confirmation, reset, invitation) are random (256 bits), time-limited and usable only once.
  Only their hash is in the database.

**Sessions**
- The session cookie is `HttpOnly`, `SameSite=Lax` and, under HTTPS, `Secure` with the `__Host-` prefix. Only a
  SHA-256 hash of the token is in the database.
- Sessions expire after 30 days or after 14 days without activity.
- Password change, deactivation and sign-out also end open live connections.

**Web**
- Strict Content Security Policy: only own scripts, no inline scripts, no third-party sources, no embedding in
  frames.
- Further headers: HSTS (under HTTPS), `X-Frame-Options: DENY`, `X-Content-Type-Options`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Referrer-Policy`, `Permissions-Policy`
  (microphone only for the site itself, for walkthroughs with audio; no camera, no location).
- CSRF protection: Modifying API calls need the header `X-Vibeboard: 1`.
- Permissions are checked on the server, for the REST API and the real-time channel – including comment, facilitation
  and team permissions. Guest access is rejected by every interface that does not explicitly allow it.
- Board elements are checked on the server and when rendering (color whitelist, numbers enforced, images only
  embedded). This way no markup or script can be injected.
- Links in emails are built only from the configured public address or from addresses of this machine. A
  forged `Host` header cannot redirect them.
- Timeouts against slow connections (Slowloris), size limits for requests.

**Operation**
- The application's Docker container runs as a normal user with a read-only file system, without Linux capabilities
  and with `no-new-privileges`.
- Without a database password set, docker-compose does not start.
- For operation on the internet, a reverse proxy with HTTPS belongs in front (e.g. Caddy, nginx, Traefik). Then set
  `TRUST_PROXY=1` and `PUBLIC_URL`.

### Real IP addresses in the log

If the log shows the same private address such as `172.20.0.1` for all requests, vibeboard is not seeing the users'
address but that of the Docker network (gateway). This happens when

- a **reverse proxy on the host** (nginx, Caddy, Apache) forwards to `localhost:3000` – Docker then passes the
  connection on through its helper process `docker-proxy`, or
- users access via **IPv6** or from the server itself – this also goes through `docker-proxy`.

Remedy:

1. **With a reverse proxy (recommended):** The proxy must set the header `X-Forwarded-For` (Caddy and Traefik do this
   on their own, with nginx `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` and
   `proxy_set_header X-Forwarded-Proto $scheme;`). Then set `TRUST_PROXY=1` in the `.env`.
   Important: The application's port must then be reachable **only by the proxy**, otherwise callers could set the
   header themselves and fake an address. To do this, set `PORT=127.0.0.1:3000` in the `.env` –
   docker-compose then publishes the port only on the host itself.
2. **Without a reverse proxy:** For IPv4 access from outside, vibeboard sees the real address if Docker does not use
   the `docker-proxy`: enter `{ "userland-proxy": false }` in `/etc/docker/daemon.json` and restart Docker.
   For IPv6 the Docker network must support IPv6, otherwise only the reverse proxy remains.

The administration (overview) shows a notice if your own request arrives with a Docker gateway address or with
`X-Forwarded-For` but without `TRUST_PROXY`.

## Data storage and privacy

All data is stored in your own PostgreSQL database:

| Table | Content |
|---------|--------|
| `users` | Accounts with role, status, confirmation time, password hash, two-factor key, hashed recovery codes |
| `sessions` | Sign-in sessions (token hash, device, IP address, last activity) |
| `tokens` | One-time links for confirmation, invitation and password reset (only as a hash) |
| `audit_log` | Security log, kept for 12 months |
| `settings` | Instance settings, including SMTP access |
| `boards`, `board_members`, `board_visits` | Boards, sharing, recently opened boards (for “since your last visit”) |
| `elements` | One record per board element; images are embedded scaled down |
| `board_versions` | Saved snapshots of boards |
| `notifications` | Notifications (mention, reply, assignment), kept for 90 days |
| `board_activity` | Activity history, summarized, 90 days or at most 2000 entries per board |
| `guest_links` | Guest links (only as a hash) with role and expiry; guest accesses are accounts with the role `guest` |
| `teams`, `team_members`, `folders`, `folder_boards` | Teams, memberships, folders |
| `board_recordings` | Recorded walkthroughs with time track and optional audio track |
| `team_invitations`, `pending_invites` | Open invitations to teams or to addresses without an account (address, role, inviting person; at most 30 days) |
| `board_files` | File attachments (content, name, type, size, PDF preview); removed after 7 days without a reference |
| `board_polls` | Results of quick polls (only the count per answer, no individual votes) |
| `user_templates` | Own and team templates |
| `webhooks` | Chat integrations (address, format, events, last status) |

- Outgoing connections exist only to the configured mail server and, if enabled, to the Pwned Passwords API and
  to the webhooks set up by users.
- In the browser, vibeboard stores only view settings (zoom, dark theme, tool options) in `localStorage`;
  the service worker of the installable app keeps the interface and scripts for offline use (no board data).
- The repository contains no user data: `data/`, `.env` and database files are excluded in `.gitignore`.

---

## Dependency updates

Dependabot watches npm packages, GitHub Actions and the Docker base image. Security updates arrive at once; other updates wait seven days, so that a compromised release can be discovered first. Patch and minor updates are merged automatically once all checks pass; major updates need a review. Updates reach your server only with your next `git pull` and rebuild. Pull the other images with `docker compose pull`.

## Requirements and contributing

- [docs/anforderungen](docs/anforderungen/README.md) describes all features as requirements with permanent IDs
  and acceptance criteria (the requirements documents are in German).
- [CONTRIBUTING.md](CONTRIBUTING.md) defines what belongs to every new feature:
  - Add the requirement
  - Increase the version
  - Update the CHANGELOG
  - Migration plus upgrade test

---

## Architecture

```
server.js              HTTP-Server, Seiten-Routing, Sicherheits-Header, CSRF-Schutz, Timeouts
lib/
  db.js                PostgreSQL-Pool, Schema-Migrationen
  auth.js              Kennwort-Hashes, Sessions, Einmal-Tokens, Zwei-Faktor-Tickets, Rate-Limits
  password.js          Kennwortrichtlinie (Länge, Listen, Muster, optional HIBP)
  email.js             E-Mail-Prüfung, Wegwerf-Domains, Sperr-/Erlaubnislisten
  totp.js              Zeitbasierte Einmalcodes (RFC 6238), Wiederherstellungscodes
  audit.js             Sicherheitsprotokoll
  version.js           Versionsverwaltung, automatisches Upgrade, Sicherung, Downgrade-Schutz
  virusscan.js         ClamAV-Anbindung (clamd), Dateityp-Prüfung
  uploads.js           Prüfrichtlinie für hochgeladene Dateien
  boards.js            Zugriffsrechte, Board-Cache, verzögertes Speichern, Echtzeit-Räume, Long-Polling,
                       privater Modus, Schätzrunden, Versionen, Moderation
  comments.js          Kommentar-Operationen (Autorschaft, Erwähnungen, Zuweisung)
  notify.js            Benachrichtigungen (Glocke, live, E-Mail)
  activity.js          Aktivitätsverlauf (zusammengefasst)
  guests.js            Gastlinks und Gastzugänge
  teams.js             Teams und Ordner
  recordings.js        Aufgezeichnete Rundgänge
  sanitize.js          Prüfung von Board-Elementen
  settings.js          Einstellungen der Instanz
  mail.js              E-Mail-Versand
  setup.js             Admin aus Umgebungsvariablen, Import alter Boards, Aufräumen
  routes/              REST-API: auth.js, boards.js, collab.js, admin.js, legal.js
  data/                Liste der Wegwerf-Domains und häufigen Kennwörter
scripts/test-upgrade.js  Upgrade-Test für Datenbank-Migrationen (npm run test:upgrade)
docs/anforderungen/      Anforderungsdokumente
public/
  auth.html            Anmelden, Registrieren, Bestätigen, Kennwort  → js/auth.js
  legal.html           Impressum, Datenschutzerklärung (öffentlich)  → js/legal.js, js/markdown.js
  index.html           Board-Übersicht                               → js/dashboard.js, js/notifications.js
  guest.html           Beitritt per Gastlink                         → js/guest.js
  board.html           Board-Editor                                  → js/main.js (core, ui, collab, render, sync, …)
                       teamwork.js (privater Modus, Schätzrunde), planning.js (Aufgaben, Versionen, CSV-Import),
                       moderation.js, activity.js, recording.js, notifications.js (Arbeiten im Team),
                       diagram-parse.js / diagram-text.js (Diagramm aus Text), highlight.js (Code-Blöcke),
                       templates.js / templates-tech.js / templates-diagrams.js / template-kit.js (Vorlagen)
  admin.html           Administration                                → js/admin.js
```

**Real-time:**
- Each client receives changes via Server-Sent Events (`/api/boards/:id/events`) and sends its own changes
  bundled via POST.
- If no greeting arrives over the stream within 8 seconds, the client uses long polling
  (`/api/boards/:id/poll`). For testing this can be forced with `?transport=poll`.
- The server keeps active boards in memory, distributes changes immediately and writes them to the
  database in batches.
- If two people change the same element at the same time, the last change wins. Tables are reconciled
  cell by cell, comments via their own operations (the server adds author and time).

---

## License

vibeboard is licensed under the [MIT License](LICENSE).

Exceptions and third-party content, details in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md):

- **Business Model Canvas**: Adaptation of the “Business Model Canvas” by Strategyzer AG (strategyzer.com), licensed under
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **Lean Canvas**: Adaptation of the “Lean Canvas” by Ash Maurya (leanstack.com), based on the Business Model Canvas,
  licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- **Icons**: partly from or after [Lucide](https://lucide.dev) (ISC) and [Feather](https://feathericons.com) (MIT).
- **Disposable domains**: [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) (CC0).
- **Common passwords**: [SecLists](https://github.com/danielmiessler/SecLists) (MIT).

Product and method names mentioned (e.g. Jira, Azure DevOps, Excel, Microsoft Teams, Slack, Mattermost, Rocket.Chat,
Matrix, Kubernetes, Mermaid, UML, BPMN) belong to their respective owners and serve only as description; this does not
imply any connection or endorsement. vibeboard is an independent open-source project with no connection to Vibe, Inc. or
its products. There is no warranty; see [LICENSE](LICENSE).
