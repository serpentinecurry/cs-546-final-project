import calendar from "../config/googleCalendar.js";
import {ObjectId} from "mongodb";
import {courses, users} from "../config/mongoCollections.js";

const CALENDAR_IDS = {
    students:
        "d2fc995ebc8237bb959c6980d17022b15d9f6c0cd6620e88da4e42224fdc9fef@group.calendar.google.com",
    tas: "8c3907f93d3279d47682ca103a347d6332de1b7bebaab1d1f4c8ad1f6bbf6c88@group.calendar.google.com",
    professors:
        "23ce92a59e931bf9c5fa07217060a421ed503fa1f3083157e1fae5d5d9d32162@group.calendar.google.com",
};

export async function addLectureToCalendars(lecture) {
    const calendarEventIds = {
        professors: {},
        tas: {},
        students: {},
    };

    const event = {
        summary: `${lecture.courseCode} - ${lecture.lectureTitle}`,
        description: `Lecture for ${lecture.courseCode}`,
        visibility: "default", // Optional but helpful
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

    const userCollection = await users();
    const courseCollection = await courses();

    const courseDoc = await courseCollection.findOne({
        _id: new ObjectId(lecture.courseId),
    });

    if (!courseDoc) {
        console.error("❌ Course not found while syncing lecture.");
        return calendarEventIds;
    }

    // 🔹 Sync to professor
    try {
        const professor = await userCollection.findOne({
            _id: courseDoc.professorId,
        });

        if (professor?.calendarId) {
            const res = await calendar.events.insert({
                calendarId: professor.calendarId,
                requestBody: event,
            });
            calendarEventIds.professors[professor._id.toString()] = res.data.id;
        } else {
            console.warn(`⚠️ No calendarId for professor: ${professor?.email}`);
        }
    } catch (e) {
        console.error("❌ Error syncing lecture to professor:", e.message);
    }

    // 🔹 Sync to TAs
    if (Array.isArray(courseDoc.taIds)) {
        for (const taId of courseDoc.taIds) {
            try {
                const ta = await userCollection.findOne({_id: new ObjectId(taId)});
                if (ta?.calendarId) {
                    console.log(`📌 Syncing to TA: ${ta.email}`);
                    const res = await calendar.events.insert({
                        calendarId: ta.calendarId,
                        requestBody: event,
                    });
                    calendarEventIds.tas[ta._id.toString()] = res.data.id;
                } else {
                    console.warn(`⚠️ No calendarId for TA: ${ta?.email}`);
                }
            } catch (e) {
                console.error(`❌ Error syncing to TA ${taId}:`, e.message);
            }
        }
    }

    // 🔹 Sync to enrolled students
    if (Array.isArray(courseDoc.studentEnrollments)) {
        for (const req of courseDoc.studentEnrollments) {
            if (req.status === "active") {
                try {
                    const student = await userCollection.findOne({
                        _id: new ObjectId(req.studentId),
                    });

                    if (student) {
                        if (student.calendarId) {
                            const res = await calendar.events.insert({
                                calendarId: student.calendarId,
                                requestBody: event,
                            });
                            calendarEventIds.students[student._id.toString()] = res.data.id;
                        } else {
                            console.warn(`⚠️ Student ${student.email} has no calendarId.`);
                        }
                    } else {
                        console.warn(`⚠️ Student not found with ID: ${req.studentId}`);
                    }
                } catch (e) {
                    console.error(
                        `❌ Error syncing to student ${req.studentId}:`, e.errors?.[0]?.message || e.message
                    );
                }
            } else {
                console.log(`⛔ Skipping student with status: ${req.status}`);
            }
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
                                             calendarId,
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
        visibility: "default",
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
            calendarId,
            requestBody: event,
        });
        return {eventId: response.data.id};
    } catch (err) {
        console.error(`❌ Failed to add office hour to ${calendarId}:`, err.message);
        return null;
    }
}


export async function deleteOfficeHourEvent(calendarId, eventId) {
    try {
        await calendar.events.delete({
            calendarId,
            eventId,
        });
    } catch (err) {
        console.error(`⚠️ Failed to delete event from ${calendarId}:`, err.message);
    }
}


export async function updateLectureEvent(calendarType, eventId, updatedData, calendarId = null) {
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
        const targetCalendarId = calendarId || CALENDAR_IDS[calendarType];

        await calendar.events.update({
            calendarId: targetCalendarId,
            eventId,
            requestBody: event,
        });

        console.log(`✅ Updated event for ${calendarType} in calendar ${targetCalendarId}`);
    } catch (err) {
        console.error(
            `❌ Failed to update event in ${calendarType} calendar:`,
            err.message
        );
    }
}

export async function createPersonalCalendar(email, role) {
    const calendarObj = {
        summary: `Scholario - ${role} - ${email}`,
        timeZone: "America/New_York",
    };

    try {
        // Step 1: Create a calendar
        const res = await calendar.calendars.insert({
            requestBody: calendarObj,
        });

        const calendarId = res.data.id;

        // Step 2: Share with user
        await calendar.acl.insert({
            calendarId,
            requestBody: {
                role: "reader", // or "writer" if they need to edit
                scope: {
                    type: "default",
                    value: email,
                },
            },
        });

        return calendarId;
    } catch (err) {
        console.error(`❌ Failed to create/share calendar for ${email}:`, err.message);
        return null;
    }
}



