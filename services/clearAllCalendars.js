// clearAllCalendars.js
import calendar from '../config/googleCalendar.js';

const CALENDAR_IDS = {
  students: 'd2fc995ebc8237bb959c6980d17022b15d9f6c0cd6620e88da4e42224fdc9fef@group.calendar.google.com',
  tas: '8c3907f93d3279d47682ca103a347d6332de1b7bebaab1d1f4c8ad1f6bbf6c88@group.calendar.google.com',
  professors: '23ce92a59e931bf9c5fa07217060a421ed503fa1f3083157e1fae5d5d9d32162@group.calendar.google.com',
};

const CONCURRENCY_LIMIT = 20; // 10 deletions at a time

// Run async tasks in batches with concurrency limit
async function limitedMap(items, limit, asyncFn) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => asyncFn(item));
    results.push(p);

    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.allSettled(results);
}

async function clearCalendar(calendarId) {
  let allEvents = [];
  let pageToken;

  try {
    do {
      const res = await calendar.events.list({
        calendarId,
        maxResults: 2500,
        pageToken,
      });

      const items = res.data.items || [];
      allEvents = allEvents.concat(items);
      pageToken = res.data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    console.error(`❌ Error fetching events for ${calendarId}: ${err.message}`);
    return;
  }

  console.log(`🔍 Found ${allEvents.length} events in ${calendarId}`);

  await limitedMap(
    allEvents,
    CONCURRENCY_LIMIT,
    async (event) => {
      try {
        await calendar.events.delete({
          calendarId,
          eventId: event.id,
        });
        console.log(`🗑️ Deleted: ${event.summary || event.id}`);
      } catch (error) {
        console.error(`⚠️ Failed to delete ${event.id}: ${error.message}`);
      }
    }
  );

  console.log(`✅ Cleared all events from ${calendarId}`);
}

export async function clearAllCalendars() {
  const calendars = Object.values(CALENDAR_IDS);
  console.log('🚀 Starting calendar clearance...');
  for (const calendarId of calendars) {
    await clearCalendar(calendarId);
  }
  console.log('🎉 All calendars cleared successfully.');
}
