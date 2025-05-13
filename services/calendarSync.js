import calendar from "../config/googleCalendar.js";
import { ObjectId } from "mongodb";
import { courses, users } from "../config/mongoCollections.js";

const CALENDAR_IDS = {
  students:
    "d2fc995ebc8237bb959c6980d17022b15d9f6c0cd6620e88da4e42224fdc9fef@group.calendar.google.com",
  tas: "8c3907f93d3279d47682ca103a347d6332de1b7bebaab1d1f4c8ad1f6bbf6c88@group.calendar.google.com",
  professors:
    "23ce92a59e931bf9c5fa07217060a421ed503fa1f3083157e1fae5d5d9d32162@group.calendar.google.com",
};

export async function addLectureToCalendars(lecture) {
  const calendarEventIds = {};

  const event = {
    summary: `${lecture.courseCode} - ${lecture.lectureTitle}`,
    description: `Lecture for ${lecture.courseCode}`,
    start: {
      dateTime: new Date(
        `${lecture.lectureDate}T${lecture.lectureStartTime}:00`
      ).toISOString(),
      timeZone: "America/New_York",
    },
    end: {
      dateTime: new Date(
        `${lecture.lectureDate}T${lecture.lectureEndTime}:00`
      ).toISOString(),
      timeZone: "America/New_York",
    },
  };

  for (const [role, calendarId] of Object.entries(CALENDAR_IDS)) {
    try {
      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
      });
      calendarEventIds[role] = response.data.id;
    } catch (err) {
      console.error(
        `❌ Failed to sync lecture to ${role} calendar:`,
        err.message
      );
    }
  }

  return calendarEventIds;
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
    Sunday: "SU",
    Monday: "MO",
    Tuesday: "TU",
    Wednesday: "WE",
    Thursday: "TH",
    Friday: "FR",
    Saturday: "SA",
  };

  const event = {
    summary: `${name}'s Office Hours`,
    location,
    description: "Weekly office hours",
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${weekdayMap[day]}`],
    start: {
      dateTime: `2025-01-01T${startTime}:00`,
      timeZone: "America/New_York",
    },
    end: {
      dateTime: `2025-01-01T${endTime}:00`,
      timeZone: "America/New_York",
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId: CALENDAR_IDS[calendarType],
      requestBody: event,
    });
    return { eventId: response.data.id }; // ✅ return event ID
  } catch (err) {
    console.error(
      `❌ Failed to sync office hour to ${calendarType}`,
      err.message
    );
    return null;
  }
}

export async function deleteOfficeHourEvent(calendarType, eventId) {
  try {
    await calendar.events.delete({
      calendarId: CALENDAR_IDS[calendarType],
      eventId: eventId,
    });
  } catch (err) {
    console.error(
      `⚠️ Failed to delete event from ${calendarType}:`,
      err.message
    );
  }
}

export async function updateLectureEvent(calendarType, eventId, updatedData) {
  const event = {
    summary: `${updatedData.courseCode} - ${updatedData.lectureTitle}`,
    description: `Lecture for ${updatedData.courseCode}`,
    start: {
      dateTime: new Date(
        `${updatedData.lectureDate}T${updatedData.lectureStartTime}:00`
      ).toISOString(),
      timeZone: "America/New_York",
    },
    end: {
      dateTime: new Date(
        `${updatedData.lectureDate}T${updatedData.lectureEndTime}:00`
      ).toISOString(),
      timeZone: "America/New_York",
    },
  };

  try {
    await calendar.events.update({
      calendarId: CALENDAR_IDS[calendarType],
      eventId,
      requestBody: event,
    });
  } catch (err) {
    console.error(
      `❌ Failed to update event in ${calendarType} calendar:`,
      err.message
    );
  }
}

export async function syncAllOfficeHoursForCourse(courseId) {
  const courseCollection = await courses();
  const userCollection = await users();

  const courseDoc = await courseCollection.findOne({
    _id: new ObjectId(courseId),
  });
  if (!courseDoc) throw new Error("Course not found for syncing office hours");

  const professor = await userCollection.findOne({
    _id: courseDoc.professorId,
  });
  if (!professor) throw new Error("Professor not found");

  let updatedOfficeHours = [];

  for (const oh of courseDoc.professorOfficeHours || []) {
    if (oh.calendarEventIds && Object.keys(oh.calendarEventIds).length > 0) {
      updatedOfficeHours.push(oh);
      continue;
    }

    const name = `${professor.firstName} ${professor.lastName}`;
    const calendarEventIds = {};
    let failed = false;

    for (const calendarType of ["students", "tas", "professors"]) {
      const result = await addOfficeHourEvent({
        name,
        day: oh.day,
        startTime: oh.startTime,
        endTime: oh.endTime,
        location: oh.location,
        calendarType,
      });

      if (!result?.eventId) {
        console.error(
          `❌ Failed to create event for ${calendarType}. Skipping this office hour.`
        );
        failed = true;
        break;
      }
      calendarEventIds[calendarType] = result.eventId;
    }

    if (failed) {
      updatedOfficeHours.push(oh);
      continue;
    }

    updatedOfficeHours.push({
      ...oh,
      calendarEventIds,
    });
  }

  await courseCollection.updateOne(
    { _id: new ObjectId(courseId) },
    {
      $set: {
        professorOfficeHours: updatedOfficeHours,
      },
    }
  );
}

export const subscribeLinks = {
  students: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
    CALENDAR_IDS.students
  )}`,
  tas: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
    CALENDAR_IDS.tas
  )}`,
  professors: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(
    CALENDAR_IDS.professors
  )}`,
};

export { CALENDAR_IDS };
