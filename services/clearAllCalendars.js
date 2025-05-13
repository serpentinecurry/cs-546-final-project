// clearAllCalendars.js
import calendar from '../config/googleCalendar.js';

const CALENDAR_IDS = {
  students: 'd2fc995ebc8237bb959c6980d17022b15d9f6c0cd6620e88da4e42224fdc9fef@group.calendar.google.com',
  tas: '8c3907f93d3279d47682ca103a347d6332de1b7bebaab1d1f4c8ad1f6bbf6c88@group.calendar.google.com',
  professors: '23ce92a59e931bf9c5fa07217060a421ed503fa1f3083157e1fae5d5d9d32162@group.calendar.google.com',
};

async function clearCalendar(calendarId) {
  const events = [];
  let pageToken;

  try {
    do {
      const res = await calendar.events.list({
        calendarId,
        maxResults: 2500,
        pageToken,
      });

      const items = res.data.items || [];
      events.push(...items);
      pageToken = res.data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    console.error(`Error listing events for ${calendarId}: ${err.message}`);
    return;
  }

  for (const event of events) {
    try {
      await calendar.events.delete({
        calendarId,
        eventId: event.id,
      });
      console.log(`🗑️ Deleted: ${event.summary || event.id} from ${calendarId}`);
    } catch (error) {
      console.error(`❌ Failed to delete event ${event.id} in ${calendarId}: ${error.message}`);
    }
  }

  console.log(`✅ Cleared calendar: ${calendarId}`);
}

export async function clearAllCalendars() {
  await clearCalendar(CALENDAR_IDS.students);
  await clearCalendar(CALENDAR_IDS.tas);
  await clearCalendar(CALENDAR_IDS.professors);

  console.log('🎉 All calendars successfully cleared.');
}
