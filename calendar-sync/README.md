# Calendar Busy Block Sync

Keeps free/busy times in sync across multiple Google Calendar accounts by creating "Busy" placeholder events on each calendar from events on the others.

## Problem

When you use multiple Google Calendar accounts (work, personal, side projects), a meeting on one calendar doesn't block time on the others. Someone looking at your OpenWacca calendar has no idea you're busy on your BlueSky calendar.

## Solution

A Google Apps Script that runs every 10 minutes and creates "Busy" events on each calendar for every real event found on the other calendars. Each calendar shows its own events plus "Busy" blocks representing commitments from the other accounts.

## Calendars

| Name      | Account                        |
|-----------|--------------------------------|
| BlueSky   | kris@blueskysoftware.io        |
| OpenWacca | kris.sparks@openwacca.com      |
| Personal  | kbs5280@gmail.com              |
| Aleysian  | kris@aleysian.com              |

## Setup

1. Open [Google Apps Script](https://script.google.com) signed in as **kris@blueskysoftware.io**
2. Create a new project and paste the contents of `sync.js`
3. Share each of the 3 other calendars with kris@blueskysoftware.io (write access)
4. In the BlueSky Google Calendar, **uncheck/hide the 3 shared calendars** from the left sidebar — busy blocks replace the overlays
5. Run `syncCalendars` manually to verify
6. Run `createTrigger` to enable automatic sync every 10 minutes

## Functions

| Function              | Purpose                                                  |
|-----------------------|----------------------------------------------------------|
| `syncCalendars`       | Main sync — creates and removes busy blocks as needed    |
| `diagnose`            | Logs all events on all calendars for debugging           |
| `removeAllBusyBlocks` | Deletes all script-created busy blocks (clean slate)     |
| `createTrigger`       | Sets up the 10-minute automatic trigger                  |

## Important Notes

- All-day events are skipped (only timed events are synced)
- The script deduplicates — overlapping events at the same time produce one busy block, not multiple
- Run `removeAllBusyBlocks` before making major changes to the script
- The sync window is 30 days ahead (configurable via `SYNC_DAYS_AHEAD`)
- BlueSky calendar shows detailed titles like `Busy: Team Standup (OpenWacca)` — the other 3 calendars just show `Busy`
- Add `showDetails: true` to any calendar in the config to enable detailed titles on it
