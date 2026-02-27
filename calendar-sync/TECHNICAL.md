# Technical Documentation

## Architecture

The script runs as a Google Apps Script under the master account (kris@blueskysoftware.io). It uses `CalendarApp.getCalendarById()` to access all 4 calendars — the master's own calendar natively, and the other 3 via calendar sharing (write access granted to the master account).

## Sync Algorithm

### Step 1: Gather Real Events

For each calendar, the script reads all events in the sync window (now → 30 days ahead) and filters out any events whose title starts with "Busy". This prevents the script from treating its own busy blocks as real events, which would cause cascading duplicates.

```
allEvents[calendarId] = events.filter(e => !e.getTitle().startsWith('Busy'))
```

### Step 2: Diff and Sync

For each calendar (the "target"), the script:

1. **Reads existing busy blocks** on the target — events starting with "Busy" that were created by prior runs
2. **Builds a needed map** — for every real event on every OTHER calendar (the "sources"), generates a key: `Busy|startTimestamp|endTimestamp`
3. **Creates missing blocks** — keys in the needed map that don't exist in the existing map
4. **Deletes stale blocks** — keys in the existing map that are no longer in the needed map (event was moved, cancelled, or fell outside the sync window)

### Deduplication

The key format `title|startMs|endMs` ensures that if two events on different source calendars happen at exactly the same time, only one busy block is created on the target. This is intentional — the target calendar only needs to know that the time slot is busy, not how many overlapping events cause it.

## Why the Master Must Hide Shared Calendar Overlays

The 3 non-master calendars are shared with the master account so the script can read/write them. By default, Google Calendar displays shared calendars as overlays — meaning the master sees every event on every shared calendar.

Since the script also creates "Busy" blocks on those shared calendars, the master would see both the original event (via the overlay) AND the busy blocks (on the shared calendars). This causes duplicates.

The fix: uncheck the shared calendars from the master's Google Calendar sidebar. The master then sees only its own events plus the "Busy" blocks the script creates on its own calendar from the other 3.

## Trigger

The script uses a time-based trigger that fires every 10 minutes. The `createTrigger` function removes any existing trigger for `syncCalendars` before creating a new one, preventing duplicates.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Event moved to a new time | Old busy block deleted, new one created on next sync |
| Event deleted | Busy block deleted on next sync |
| Overlapping events on different source calendars | Single busy block (deduplicated by time) |
| All-day events | Skipped — only timed events are synced |
| Calendar inaccessible | Logged as warning, skipped |
| Script-created "Busy" events | Filtered out in Step 1 to prevent cascading |

## Detailed Titles

Calendars with `showDetails: true` get descriptive busy block titles instead of just "Busy":

| Calendar | Example title |
|----------|---------------|
| BlueSky (`showDetails: true`) | `Busy: Team Standup (OpenWacca)` |
| OpenWacca | `Busy` |
| Personal | `Busy` |
| Aleysian | `Busy` |

The `startsWith(BUSY_TAG)` filter still works for both formats since all titles begin with "Busy". The detailed format includes the source calendar name in parentheses so you can see which account the event belongs to.

## Configuration

| Constant | Default | Purpose |
|----------|---------|---------|
| `SYNC_DAYS_AHEAD` | `30` | Number of days ahead to sync |
| `BUSY_TAG` | `'Busy'` | Title prefix for script-created events |
| `CALENDARS` | 4 accounts | Array of calendar IDs to sync |
| `showDetails` | `false` | Per-calendar flag — show event name and source instead of just "Busy" |

## Permissions Required

- The master account needs **"Make changes to events"** sharing level on all 3 non-master calendars
- The Apps Script project needs the `https://www.googleapis.com/auth/calendar` scope (granted automatically when you first run the script)
