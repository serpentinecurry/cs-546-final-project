// clearAllCalendars.js
import calendar from '../config/googleCalendar.js';

const CALENDAR_IDS = {
  students: 'd2fc995ebc8237bb959c6980d17022b15d9f6c0cd6620e88da4e42224fdc9fef@group.calendar.google.com',
  tas: '8c3907f93d3279d47682ca103a347d6332de1b7bebaab1d1f4c8ad1f6bbf6c88@group.calendar.google.com',
  professors: '23ce92a59e931bf9c5fa07217060a421ed503fa1f3083157e1fae5d5d9d32162@group.calendar.google.com',
};

// Fetch and delete events concurrently
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

  // Parallel deletion
  await Promise.allSettled(
    allEvents.map(event =>
      calendar.events
        .delete({
          calendarId,
          eventId: event.id,
        })
        .then(() => {
          console.log(`🗑️ Deleted: ${event.summary || event.id}`);
        })
        .catch(err => {
          console.error(`⚠️ Failed to delete ${event.id}: ${err.message}`);
        })
    )
  );

  console.log(`✅ Cleared all events from ${calendarId}`);
}

export async function clearAllCalendars() {
  const calendarList = [
    { name: 'students', id: CALENDAR_IDS.students },
    { name: 'TAs', id: CALENDAR_IDS.tas },
    { name: 'professors', id: CALENDAR_IDS.professors },
  ];

  console.log('🚀 Starting calendar clearance...');

  await Promise.all(calendarList.map(cal => clearCalendar(cal.id)));

  console.log('🎉 All calendars cleared successfully.');
}
