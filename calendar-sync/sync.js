// ============================================================
// CALENDAR BUSY BLOCK SYNC
// ============================================================
// Runs under: kris@blueskysoftware.io (master account)
// All other calendars must be shared with write access to master.
//
// IMPORTANT: On the master Google Calendar, hide/uncheck the
// 3 shared calendars from the sidebar — busy blocks replace them.
// ============================================================

const CALENDARS = [
  { name: 'BlueSky',   id: 'kris@blueskysoftware.io', showDetails: true },
  { name: 'OpenWacca', id: 'kris.sparks@openwacca.com' },
  { name: 'Personal',  id: 'kbs5280@gmail.com' },
  { name: 'Aleysian',  id: 'kris@aleysian.com' },
];

// How many days ahead to sync
const SYNC_DAYS_AHEAD = 30;

// Tag to identify busy blocks created by this script
const BUSY_TAG = 'Busy';

/**
 * Main sync function — set this on a time-based trigger.
 */
function syncCalendars() {
  const now = new Date();
  const future = new Date(now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000);

  // Step 1: Gather all real events from all calendars
  const allEvents = {};
  CALENDARS.forEach(cal => {
    const calendar = CalendarApp.getCalendarById(cal.id);
    if (!calendar) {
      Logger.log('⚠️ Cannot access calendar: ' + cal.name + ' (' + cal.id + ')');
      return;
    }
    const events = calendar.getEvents(now, future);
    allEvents[cal.id] = events.filter(e => !e.getTitle().startsWith(BUSY_TAG));
  });

  // Step 2: For each calendar, sync busy blocks from all other calendars
  CALENDARS.forEach(targetCal => {
    const targetCalendar = CalendarApp.getCalendarById(targetCal.id);
    if (!targetCalendar) return;

    // Get existing busy blocks on this calendar (created by this script)
    const existingBusyBlocks = targetCalendar.getEvents(now, future)
      .filter(e => e.getTitle().startsWith(BUSY_TAG));

    // Build a map of existing busy blocks for quick lookup
    const existingMap = {};
    existingBusyBlocks.forEach(e => {
      const key = e.getTitle() + '|' + e.getStartTime().getTime() + '|' + e.getEndTime().getTime();
      existingMap[key] = e;
    });

    // Determine which busy blocks SHOULD exist on this calendar
    const neededMap = {};
    CALENDARS.forEach(sourceCal => {
      if (sourceCal.id === targetCal.id) return; // skip self

      const sourceEvents = allEvents[sourceCal.id] || [];
      sourceEvents.forEach(event => {
        // Skip all-day events (optional — remove this line to include them)
        if (event.isAllDayEvent()) return;

        // BlueSky gets detailed titles; other calendars just get "Busy"
        const title = targetCal.showDetails
          ? BUSY_TAG + ': ' + event.getTitle() + ' (' + sourceCal.name + ')'
          : BUSY_TAG;
        const start = event.getStartTime();
        const end = event.getEndTime();
        const key = title + '|' + start.getTime() + '|' + end.getTime();
        neededMap[key] = { title, start, end };
      });
    });

    // Create missing busy blocks
    let created = 0;
    for (const key in neededMap) {
      if (!existingMap[key]) {
        const block = neededMap[key];
        targetCalendar.createEvent(block.title, block.start, block.end);
        created++;
      }
    }

    // Delete stale busy blocks (event was moved or deleted)
    let deleted = 0;
    for (const key in existingMap) {
      if (!neededMap[key]) {
        existingMap[key].deleteEvent();
        deleted++;
      }
    }

    Logger.log(targetCal.name + ': +' + created + ' created, -' + deleted + ' removed');
  });

  Logger.log('✅ Sync complete at ' + now.toISOString());
}

/**
 * Diagnostic: shows what titles the script sees on each calendar.
 * Run this manually to debug filtering issues.
 */
function diagnose() {
  const now = new Date();
  const future = new Date(now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000);

  CALENDARS.forEach(cal => {
    const calendar = CalendarApp.getCalendarById(cal.id);
    if (!calendar) return;

    const events = calendar.getEvents(now, future);
    Logger.log('--- ' + cal.name + ' (' + events.length + ' events) ---');
    events.forEach(e => {
      const title = e.getTitle();
      const isBusy = title.startsWith(BUSY_TAG);
      Logger.log('  "' + title + '" | startsWith Busy: ' + isBusy + ' | ' + e.getStartTime());
    });
  });
}

/**
 * One-time cleanup: removes ALL busy blocks created by this script.
 * Run this manually if you want to start fresh.
 */
function removeAllBusyBlocks() {
  const now = new Date();
  const future = new Date(now.getTime() + SYNC_DAYS_AHEAD * 24 * 60 * 60 * 1000);

  CALENDARS.forEach(cal => {
    const calendar = CalendarApp.getCalendarById(cal.id);
    if (!calendar) return;

    const events = calendar.getEvents(now, future)
      .filter(e => e.getTitle().startsWith(BUSY_TAG));

    events.forEach(e => e.deleteEvent());
    Logger.log('Removed ' + events.length + ' busy blocks from ' + cal.name);
  });
}

/**
 * Run this once to set up the automatic trigger.
 * Default: every 10 minutes. Change the interval below if needed.
 */
function createTrigger() {
  // Remove any existing triggers for this function first
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncCalendars') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncCalendars')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('✅ Trigger created: syncCalendars will run every 10 minutes');
}
