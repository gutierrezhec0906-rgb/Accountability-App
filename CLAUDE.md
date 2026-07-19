# Accountability App — Project Notes

React + Vite app in `client/`, Firebase Auth + Firestore, deployed on Firebase Hosting.
Primary data store is the `users/{uid}` document; most features persist arrays on it
(`pointEvents`, `smartGoals`, `eqHistory`, `urgencyRecords`, `scoreHistory`, …).
Most users are on **mobile** — always verify UI works on a narrow phone screen.

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
