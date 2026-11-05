# WorkPulse — Daily Work Tracker & Productivity Hub

A production-ready Single Page Application (SPA) designed for engineers, creators, and teams to log daily work frictionlessly, roll over unfinished tasks, synchronize with Google Sheets, and leverage Gemini AI to transform daily logs into tailored status updates (WhatsApp, Slack/Teams, Executive memos).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following key decisions were confirmed during the initial consultation:
> - **Default Visual Theme:** Set to **Minimalist** (Notion-inspired calm layout, serene whites and soft grays, distraction-free typography) with 1-click runtime switching to Modern SaaS, Compact (Linear-style table), and Matrix Cyberpunk.
> - **Gemini AI Configuration:** Users configure their Gemini API key directly in the Settings modal with secure client-side storage in `localStorage` and fallback to standard templates if a key is not entered. A dedicated server proxy route `/api/gemini/generate` will also support seamless execution with `gemini-3.8-flash`.
> - **Seed Data Preset:** Preloaded initially with real-world **Software Engineering** workflow entries (GitHub PR reviews, bugfixes, sprint tasks, architecture RFCs, and tags).

---

## 1. Overview & Core Concept

- **What It Does**: WorkPulse is a high-velocity daily work logger, task backlog, and reporting console. It automates timestamping, tracks project attribution, captures proof-of-work screenshots (stored as compressed base64), and offers automated task rollover from prior days.
- **Target Audience**: Software engineers, tech leads, remote consultants, and agile teams who need an effortless way to keep superiors, clients, and team members informed.
- **Key Value**: Eliminates end-of-day reporting dread by converting unstructured work logs into formatted Slack standups, executive bullet memos, or WhatsApp messages with one click.

---

## 2. User Experience & Visual Design

### 4 Dynamic Themes (Switchable on the fly in Settings / Top Bar)
1. **Minimalist (Active Default)**:
   - *Aesthetic*: Notion-inspired clean surfaces, subtle neutral gray boundaries (`#F7F7F5`, `#ECECEE`, text `#37352F`), generous white space, and understated typography.
   - *Typography*: Clean sans (`Plus Jakarta Sans` / `DM Sans`), unboxed metadata separated by middots (`·`).
2. **Modern SaaS**:
   - *Aesthetic*: Slate/zinc glassmorphism, rounded containers (`rounded-2xl`), subtle hairline borders, ambient glow accents, and smooth dark/light toggles.
3. **Compact**:
   - *Aesthetic*: Linear and Jira power-user inspired high-density table view. Minimized cell padding ($32\text{px}$–$36\text{px}$ row height), vertical dividers, and monospace tabular alignment for rapid scanning.
4. **Matrix Cyberpunk**:
   - *Aesthetic*: Deep OLED black canvas (`#090D09`), high-contrast phosphor green (`#00FF66`), scanline grid motifs, and monospace typography (`font-mono`).

### Key User Flows
- **Instant Quick-Logging**: Pressing `Ctrl + Enter` (or `Cmd + Enter`) instantly logs work from the main input. Optional collapsible drawer for duration (hours/mins), focus rating (1–5 flames), tags (`#bugfix`, `#meeting`), and attachments.
- **Planned Tasks & Rollover**: Quick to-do list at the top. Checking a planned item off converts it into a logged entry. Unchecked items from yesterday automatically show a badge: `"Rolled over from Yesterday"`.
- **AI Standup Hub**: Select any logs from today or the week, select recipient format (WhatsApp, Slack Standup, Executive Memo), choose tone (`Casual`, `Corporate`, `Bullet-only`, `Client-facing`), and generate instantly. One-click copy with toast feedback or direct `"Open in WhatsApp Web"`.
- **Google Sheets Sync**: Enter Google Apps Script Web App URL in Settings, test connection, and sync logs bi-directionally. Includes full Apps Script copy-paste code generator with deployment instructions.
- **Visual Analytics**: Interactive responsive charts (Project time distribution, 7-day completion velocity, and status ratios) plus Markdown & Print/PDF export.
- **5:00 PM Gentle Reminder**: Non-intrusive banner appears after 5:00 PM local time if zero logs have been recorded today.

---

## 3. Key Product Decisions & Trade-Offs

- **Theme Engine Architecture**:
  - *Decision*: Implemented via data-attributes (`data-theme="minimalist" | "modern" | "compact" | "matrix"`) on the root container with targeted CSS variables and Tailwind variant classes.
  - *Why*: Allows switching themes with zero page reload, maintaining all input state and draft logs in memory.
- **Google Sheets Integration Strategy**:
  - *Decision*: Google Apps Script Web App endpoint (`doPost` / `doGet`) handling JSON payloads.
  - *Why*: Requires zero server secrets or complex OAuth screens for personal spreadsheets; users paste a provided 30-line script into their Sheet's Extensions > Apps Script and get full cloud synchronization.
  - *Fallback*: Full offline/mock mode with reactive local storage persistence so the app is 100% functional out of the box.
- **Gemini AI Integration (`gemini-3.8-flash`)**:
  - *Decision*: Server-side proxy endpoint `/api/gemini/generate` powered by `@google/genai` with fallback to direct client-side fetch if user enters a custom API key.
  - *Why*: Complies with server-side SDK guidelines while respecting the user's preference to input their own key in Settings if desired.

---

## 4. Technical Architecture & Data Strategy

### System Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WorkPulse SPA (React 19)                       │
├────────────────────────────────────────────────────────────────────────┤
│  Top Bar: [Brand Wordmark] · [Feed | Backlog | Analytics | AI Hub]     │
│           · [Theme Switcher] · [Settings Modal Trigger]                │
├────────────────────────────────────┬───────────────────────────────────┤
│           Left Column              │           Right Column            │
│  ┌──────────────────────────────┐  │  ┌─────────────────────────────┐  │
│  │ 1. Daily Work Logger Form    │  │  │ 3. Smart Task Backlog       │  │
│  │  - Project selector & +New   │  │  │  - Add to-dos               │  │
│  │  - Rich description text area│  │  │  - Auto-rollover indicators │  │
│  │  - Status & tag chips        │  │  │  - 1-click convert to log   │  │
│  │  - Proof upload & PR links   │  │  └─────────────────────────────┘  │
│  │  - Expandable duration/focus │  │  ┌─────────────────────────────┐  │
│  └──────────────────────────────┘  │  │ 4. AI Standup & Comms Hub   │  │
│  ┌──────────────────────────────┐  │  │  - Target (WhatsApp/Slack)  │  │
│  │ 2. Timeline & Log Feed       │  │  │  - Gemini generation        │  │
│  │  - Date/Project/Tag filters  │  │  │  - Copy & WhatsApp Web link │  │
│  │  - Search (Cmd+K modal)      │  │  └─────────────────────────────┘  │
│  │  - Lightbox proof modal      │  │  ┌─────────────────────────────┐  │
│  │  - Edit / Duplicate / Delete │  │  │ 5. Analytics & Export Strip │  │
│  └──────────────────────────────┘  │  │  - Project & Output Charts  │  │
│                                    │  │  - Markdown & Print / PDF   │  │
│                                    │  └─────────────────────────────┘  │
└────────────────────────────────────┴───────────────────────────────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│  Local Persistence (Storage) │          │  External Cloud Connectors   │
│   - Draft auto-save buffer   │          │   - Google Apps Script URL   │
│   - Work logs & backlog tasks│          │   - Gemini AI Service        │
│   - Custom themes & projects │          │     (/api/gemini/generate)   │
└──────────────────────────────┘          └──────────────────────────────┘
```

### Core Entities & Data Schema
- **WorkLog**: `{ id, date, time, projectId, projectName, description, status: 'completed'|'in_progress'|'blocked', tags: string[], linkUrl?: string, imageBase64?: string, durationMinutes?: number, energyRating?: number, createdAt: string }`
- **BacklogTask**: `{ id, title, projectId, dueDate, completed: boolean, originalDate: string, isRolledOver: boolean, stage: 'planned'|'in_progress'|'paused'|'blocked'|'done', elapsedSeconds: number, isRunning: boolean, blockReason?: string, isSynthesized?: boolean, synthesizedAt?: string }`
- **Project**: `{ id, name, color, isArchived: boolean }`
- **AppSettings**: `{ theme: 'minimalist'|'modern'|'compact'|'matrix', googleScriptUrl: string, geminiApiKey: string, defaultTone: string, lastDismissedReminderDate?: string }`

---

## 5. Task Preservation & EOD Synthesis Engine
- **Zero Deletion / Archival Policy**: Pushing synthesized logs to Google Sheets never removes or alters the lifecycle stage (`in_progress`, `paused`, `blocked`, `done`, `planned`) of tasks.
- **Visual Logged Indicators**: Tasks with `isSynthesized === true` display a `[✓ Logged to Sheet]` indicator across all 4 themes (Minimalist, Modern SaaS, Compact, Matrix TUI) and relaxed opacity.
- **Subsequent Synthesis Deduplication**: Synthesized tasks are automatically excluded from subsequent full-workspace EOD draft generations unless explicitly selected via custom checkboxes.

