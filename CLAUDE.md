# Accountability App — Project Notes

React + Vite app in `client/`, Firebase Auth + Firestore, deployed on Firebase Hosting.

## Deployment (IMPORTANT — never tell the user to deploy manually)

`.github/workflows/deploy.yml` **auto-deploys on every push to the active feature
branch** (`on: push: branches: [claude/...]`). One push runs the whole pipeline:
builds the client, writes `functions/.env` from GitHub Secrets, deploys Hosting AND
`firebase deploy --only functions`. So:
- Pushing code = the live site AND Cloud Functions update automatically. No Cloud
  Shell, no `firebase deploy`, no terminal steps for the user. ALWAYS check
  `.github/workflows/` before giving deploy instructions.
- Frontend env vars (`VITE_*`) and functions secrets (`ZOHO_EMAIL`,
  `ZOHO_APP_PASSWORD`, etc.) live in **GitHub repo Secrets**, injected at build time —
  not in any committed `.env`. New env vars must be added there to take effect.
- Email is sent server-side from `functions/index.js` via nodemailer + Zoho SMTP
  (welcome emails + `sendRequestEmails` for peer/feedback/approval requests +
  `careerMilestoneReminders`, a daily `onSchedule` cron emailing career-plan milestone
  reminders 5 days before due / on lapse, deduped via `careerPlan.reminders` flags +
  `weeklyAccountabilityReport`, a Friday 17:00 America/Chicago `onSchedule` cron emailing
  every approved user a motivational weekly report (points earned, tool-coverage %, praise
  for tools used, nudges for tools not used, rotating quote) built by `buildWeeklyReport`;
  `sendMyWeeklyReport` is an `onCall` that emails the caller their own report on demand —
  wired to the "📧 Email My Weekly Report" button on the Scores page for testing).
  `@emailjs/browser` is in package.json but unused — prefer the existing Zoho path.
  NOTE: scheduled functions need Cloud Scheduler + Pub/Sub APIs enabled on first deploy.
- **Firestore rules do NOT auto-deploy.** The CI service account lacks
  `firebaserules.*` permission, so `firebase deploy --only ...,firestore:rules`
  FAILS (403) and takes the whole deploy step down with it. Keep the workflow at
  `--only functions`. When `firestore.rules` changes, the user must publish it
  manually: Firebase Console → Firestore Database → Rules → paste → Publish.
  (To auto-deploy later, grant the service account the Firebase Rules Admin role.)

## Cross-user Firestore writes (peer assessments, SMART approvals)

Features where user A writes to user B's `users/{uid}` doc (Skills peer assessment,
SMART goal approval, cross-user `logPointEvent`) need BOTH `get` AND `update` on the
`users/{userId}` rule to allow it — the save reads B's doc before writing. Current
rule allows self OR master-admin OR admin OR `sameCompany(userId)`. A "Save failed —
check permissions" toast almost always means a rule is missing `sameCompany` on `get`
or `update`. `sameCompany` compares non-null `companyId` of requester and target.

Primary data store is the `users/{uid}` document; most features persist arrays on it
(`pointEvents`, `smartGoals`, `eqHistory`, `urgencyRecords`, `scoreHistory`,
`toolSessions`, …). **Tool-usage tracking:** `Layout.jsx` appends each tool visit
(10s+) to `users/{uid}.toolSessions` (capped 400) on navigate-away — this is the single
source of truth read by scoring (breadth/frequency/depth) AND the weekly report. It used
to write to a separate `toolSessions` *collection* that nothing read, which left the
score and report showing 0 usage; do NOT reintroduce that split. The weekly report also
unions in tools inferred from `pointEvents` labels (`toolKeyFromLabel`) so point-earning
activity counts even for the last un-recorded visit.
Most users are on **mobile** — always verify UI works on a narrow phone screen.

## Action-item grid pattern (Action / Owner-Responsible / Deadline)

When a template needs a list of action items, use the editable grid pattern, NOT a
free-text box: a CSS-grid header row + data rows of `{ action, owner/responsible, deadline }`,
with a `type="date"` input for the deadline (native calendar picker) and a "+ Add Row"
button. State is an array of row objects with `updateRow/addRow/removeRow` helpers; filter
out empty rows on save; when loading old records, fall back to one empty row and keep any
legacy free-text value for display only. Reference: `ActionItemsEditor` in
`client/src/pages/Coaching.jsx` and Kaizen Phase-3 "Follow-Up Owners" in `Lean.jsx`
(`followUpActions[]`). Apply this whenever the user asks for an action/owner/deadline grid.

## Scrollable panel pattern (IMPORTANT — hard-won fix)

When making a scrollable list/feed inside a card, all three rules are required or the
scrollbar silently fails (content compresses instead of scrolling, rows become unreadable):

1. Put `maxHeight` + `overflowY: 'scroll'` **directly on the element that holds the rows**,
   not on an outer wrapper — a wrapper with no height constraint means overflow never triggers.
2. If that element is `display: flex; flexDirection: column`, every child row needs
   `flexShrink: 0`. Flex items shrink to fit by default, so instead of overflowing (and
   scrolling), rows squash themselves into the maxHeight and no scrollbar appears.
3. Mobile browsers hide native scrollbars inside divs. Force a persistent visible one with
   explicit webkit styles rendered in a `<style>` tag next to the component:

   ```jsx
   <style>{`
     .my-scroll::-webkit-scrollbar { width: 8px; -webkit-appearance: none; }
     .my-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 8px; }
     .my-scroll::-webkit-scrollbar-thumb { background: #64748b; border-radius: 8px; border: 1px solid #e2e8f0; }
   `}</style>
   <div className="my-scroll" style={{ maxHeight: 400, overflowY: 'scroll', scrollbarWidth: 'thin', scrollbarColor: '#64748b #e2e8f0' }}>
   ```

   (`scrollbarWidth`/`scrollbarColor` inline styles cover Firefox.)

Reference implementation: `DailyMovementFeed` + `DayRow` in `client/src/pages/Scores.jsx`.

## Deadline status color convention (APP-WIDE — always use this)

Any due-date/deadline UI across the whole app must use the same three-tier color code,
driven by `getDateStatus(dateStr)` in `client/src/components/DateStatus.jsx` (the single
source of truth — do NOT hardcode thresholds elsewhere):

- **RED — Past Due** (`level:'overdue'`, `#dc2626` / bg `#fee2e2`): deadline already passed.
- **YELLOW — Due Soon** (`level:'warning'`, `#b45309` / bg `#fef9c3`): due within **2 weeks**
  (`diffDays <= 14`).
- **GREEN — On Track** (`level:'ontrack'`, `#15803d` / bg `#dcfce7`): more than 2 weeks out.

A completed item, or one with no due date, counts as **On Track (green)**. When a page needs
count summaries, build three windows (On Track / Due Soon / Past Due) tallied via
`getDateStatus(t.dueDate).level` (see the accountability windows in `pages/Training.jsx` for the
reference implementation). Reuse `<DateStatus date=… />` for inline per-item badges. This must be
applied consistently to every deadline-bearing feature (trainings, SMART goals, LOB, actions, etc.).

## Scoring system (`client/src/utils/scoring.js`)

- `logPointEvent(uid, { points, toolLabel, reason })` appends to `users/{uid}.pointEvents`
  (max 200), enforcing `DAILY_POINTS_CAP = 25`. Returns `{ awarded, capReached, todayTotal }`.
  Always call `calculateScore(uid)` after a successful award.
- `pointEvents` is the single source of truth for time-windowed points (SMART, urgency,
  feedback, mindfulness, actions closed). Pages gate "once per day/window" awards by
  checking existing events for that `toolLabel` before calling `logPointEvent`.
- **Declaration-order trap in `calculateScore`:** `allEvents` and the date-string constants
  (`today`, `thirtyDaysAgoStr`, `sevenDaysAgoStr`, `sixMonthsAgoStr`) are declared in one
  block that must stay ABOVE every score variable that reads them. `const` doesn't hoist —
  reordering causes a runtime ReferenceError that silently zeroes the score. Add new
  event-based scores below that block, and add each new score to BOTH the `total` sum and
  the `breakdown` object, plus a matching row in `BREAKDOWN_CONFIG` in
  `client/src/pages/Scores.jsx`.

## Point rules already implemented

- SMART Goals (max 15): +1 pt per goal created with all 5 fields ≥5 words AND a future
  due date (max 5 per 180 days); +2 pts per leader-approved completion (no decay).
  Leaders approve via `pending_approval` status; approval writes to the owner's doc.
- EQ (max 5): +3 assessment + +2 dev plan (4+ actions across 2 weakest areas), 90-day window.
- DISC (max 5): valid 90 days.
- Urgency (max 4/day, 20 rolling week): individual survey +1, individual reflection
  (20+ words) +1, team survey +1, team reflection (20+ words, separate question pool) +1.
- Skills (max 3, rolling 30 days): self-assessment save +1, peer survey requested +1,
  peer survey received +1. Request stored as `users/{uid}.skillsPeerRequest`
  ({toUid, toName, status}); the assessor marks it completed and awards the assessee's
  "received" point cross-user (same pattern as SMART approvals).
- Lean 5S (max 5, rolling 7 days): +5 pts for a 5S audit describing 3+ areas of
  opportunity (≥4 words each), once per 7 days. `Lean 5S Audit` event; points expire
  after a week (scoring checks `date >= sevenDaysAgoStr`), so the leader must re-audit
  weekly to keep them. Areas stored on the `fiveSAudits` record as `opportunities[]`.
- Waste Walk (max 5, rolling 7 days): +1 pt per DISTINCT waste category logged in the
  last 7 days, capped at 5. Score computed live in `calculateScore` from
  `data.wasteLogs` (distinct `type` where `date >= sevenDaysAgoStr`); a display-only
  `Waste Walk Log` pointEvent is written when a new category is logged that week (not
  summed by scoring — no double count). Waste tab has a Pareto chart (`WasteParetoChart`)
  auto-built from the tally + an 80/20 lesson, per-card "+ Log this waste" → modal,
  weekly progress reminder, and a scrollable log history.
- Fishbone Diagram (part of Problem Solving, 5 pts/week): the +5 pts only awards when
  at least 4 of the 6 cause categories (People, Process, Materials, Machine,
  Environment, Measurement) each have ≥1 filled-in cause (`fishboneCategoriesFilled`
  in `pages/ProblemSolving.jsx`). Saving with fewer categories filled is always
  allowed — it just skips the point award and tells the user how many more
  categories are needed. Live "X/6 categories" badge shown above the save button.
- Mentoring (max 10, rolling 60 days — session points expire after 60 days; log new
  sessions to regain them): +5 pts per session logged in its totality — date,
  progress review, challenge, and action item all filled (`isCompleteMentoringSession`
  in scoring.js). `Mentoring Session Logged` event. Session list moved to a sidebar
  next to the 5-section template (two-column `flexWrap:'wrap'` layout — mirrors the
  Lean.jsx 5S checklist + audit-history sidebar pattern) using the scrollable-panel
  pattern above.
- Career Development (max 10): 10 pts for a 100%-complete `careerPlan` (all 11 narrative
  questions ≥20 words + committed coach + timeline + per-pillar resources/timeline).
  Computed live in `calculateScore` from `data.careerPlan` (NOT a pointEvent — it decays
  by time). `completedAt` anchors milestone windows; missing progress notes decay the
  points: −2 if `checkIns.d30.note` empty after 30 days, −3 more at 90 (`d90`), −2 more
  at 180 (`m6`), and lose ALL remaining if `m12` empty after 365 days (10→8→5→3→0).
  Filling a note restores that milestone's points. Section 1 is read-only from
  `skillsMatrix` (same 3 pillars); user fills Sections 2–5.
