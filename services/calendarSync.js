import calendar from "../config/googleCalendar.js";

const CALENDAR_IDS = {
    students: '32441fb311afd8b4c5b380b8fca5ac7e088189005ac256c6ea6048427945eb95@group.calendar.google.com',
    tas: '42dc4e533a259e5839a61aefbb0a9a1ad014f39e6e051599c23c2c21d692eee6@group.calendar.google.com',
    professors: '47ac4064ced0f5104ebdb9b3303dc24f724938a4d76a323b9e95244fefa0bfab@group.calendar.google.com',
};

export async function addLectureToCalendars(lecture) {
    const event = {
        summary: `${lecture.courseCode} - ${lecture.lectureTitle}`,
        description: `Lecture for ${lecture.courseCode}`,
        start: {
            dateTime: new Date(`${lecture.lectureDate}T${lecture.lectureStartTime}:00`).toISOString(),
            timeZone: 'America/New_York',
        },
        end: {
            dateTime: new Date(`${lecture.lectureDate}T${lecture.lectureEndTime}:00`).toISOString(),
            timeZone: 'America/New_York',
        },
    };

    for (const [role, calendarId] of Object.entries(CALENDAR_IDS)) {
        try {
            await calendar.events.insert({
                calendarId,
                requestBody: event,
            });
            console.log(`✅ Synced lecture to ${role} calendar`);
        } catch (err) {
            console.error(`❌ Failed to sync lecture to ${role} calendar (${calendarId}):`, err.message);
        }
    }
}


export async function addOfficeHourEvent({
                                             name,
                                             day,
                                             startTime,
                                             endTime,
                                             location,
                                             calendarType,
                                         }) {
    const weekdayMap = {
        Sunday: 'SU',
        Monday: 'MO',
        Tuesday: 'TU',
        Wednesday: 'WE',
        Thursday: 'TH',
        Friday: 'FR',
        Saturday: 'SA',
    };

    const event = {
        summary: `${name}'s Office Hours`,
        location,
        description: 'Weekly office hours',
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${weekdayMap[day]}`],
        start: {
            dateTime: `2025-01-01T${startTime}:00`,
            timeZone: 'America/New_York',
        },
        end: {
            dateTime: `2025-01-01T${endTime}:00`,
            timeZone: 'America/New_York',
        },
    };

    try {
        const response = await calendar.events.insert({
            calendarId: CALENDAR_IDS[calendarType],
            requestBody: event,
        });
        console.log(`✅ Synced office hour to ${calendarType} calendar`);
        return {eventId: response.data.id}; // ✅ return event ID
    } catch (err) {
        console.error(`❌ Failed to sync office hour to ${calendarType}`, err.message);
        return null;
    }
}


export async function deleteOfficeHourEvent(calendarType, eventId) {
    try {
        await calendar.events.delete({
            calendarId: CALENDAR_IDS[calendarType],
            eventId: eventId,
        });
        console.log(`🗑️ Deleted office hour from ${calendarType} calendar`);
    } catch (err) {
        console.error(`⚠️ Failed to delete event from ${calendarType}:`, err.message);
    }
}


export async function syncAllOfficeHoursForCourse(courseDoc, userCollection) {
    // Sync professor office hours
    const professor = await userCollection.findOne({_id: courseDoc.professorId});
    for (const oh of courseDoc.professorOfficeHours || []) {
        await addOfficeHourEvent({
            name: `${professor.firstName} ${professor.lastName}`,
            day: oh.day,
            startTime: oh.startTime,
            endTime: oh.endTime,
            location: oh.location,
            calendarType: 'students'
        });

        await addOfficeHourEvent({
            name: `${professor.firstName} ${professor.lastName}`,
            day: oh.day,
            startTime: oh.startTime,
            endTime: oh.endTime,
            location: oh.location,
            calendarType: 'professors'
        });

        await addOfficeHourEvent({
            name: `${professor.firstName} ${professor.lastName}`,
            day: oh.day,
            startTime: oh.startTime,
            endTime: oh.endTime,
            location: oh.location,
            calendarType: 'tas'
        });
    }

    // Sync TA office hours
    for (const oh of courseDoc.taOfficeHours || []) {
        const ta = await userCollection.findOne({_id: oh.taId});
        const name = `${ta.firstName} ${ta.lastName}`;

        await addOfficeHourEvent({
            name,
            day: oh.day,
            startTime: oh.startTime,
            endTime: oh.endTime,
            location: oh.location,
            calendarType: 'students'
        });

        await addOfficeHourEvent({
            name,
            day: oh.day,
            startTime: oh.startTime,
            endTime: oh.endTime,
            location: oh.location,
            calendarType: 'tas'
        });

        await addOfficeHourEvent({
            name,
            day: oh.day,
            startTime: oh.startTime,
            endTime: oh.endTime,
            location: oh.location,
            calendarType: 'professors'
        });
    }
}


export const subscribeLinks = {
    students: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(CALENDAR_IDS.students)}`,
    tas: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(CALENDAR_IDS.tas)}`,
    professors: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(CALENDAR_IDS.professors)}`
};

