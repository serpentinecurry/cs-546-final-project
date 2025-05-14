// data/officeHours.js

import {ObjectId} from "mongodb";
import {courses, users} from "../config/mongoCollections.js";
import {
    addOfficeHourEvent,
    deleteOfficeHourEvent,
} from ".././services/calendarSync.js";

export const addTAOfficeHour = async ({
                                          courseId,
                                          userId,
                                          day,
                                          startTime,
                                          endTime,
                                          location,
                                          notes,
                                      }) => {
    if (!ObjectId.isValid(courseId)) throw "Invalid course ID";
    if (!day || !startTime || !endTime || !location)
        throw "All fields except notes are required.";

    const courseCollection = await courses();
    const userCollection = await users();
    const courseObjectId = new ObjectId(courseId);
    const taObjectId = new ObjectId(userId);

    const user = await userCollection.findOne({_id: taObjectId});
    if (
        !user ||
        !user.taForCourses?.some(
            (id) => id.toString() === courseObjectId.toString()
        )
    ) {
        throw "You are Not Authorized to Modify Office Hours for this Course.";
    }

    const courseDoc = await courseCollection.findOne({_id: courseObjectId});
    if (!courseDoc) throw "Course not found";

    const name = `${user.firstName} ${user.lastName}`;
    const eventIds = {
        students: {},
        tas: {},
        professors: {},
    };

    // Sync to professor
    const professor = await userCollection.findOne({_id: courseDoc.professorId});
    if (professor?.calendarId) {
        const res = await addOfficeHourEvent({
            name,
            day,
            startTime,
            endTime,
            location,
            calendarId: professor.calendarId,
        });
        if (res?.eventId) {
            eventIds.professors[professor._id.toString()] = res.eventId;
        }
    }

    // Sync to all TAs
    for (const taId of courseDoc.taIds || []) {
        const ta = await userCollection.findOne({_id: new ObjectId(taId)});
        if (ta?.calendarId) {
            const res = await addOfficeHourEvent({
                name,
                day,
                startTime,
                endTime,
                location,
                calendarId: ta.calendarId,
            });
            if (res?.eventId) {
                eventIds.tas[ta._id.toString()] = res.eventId;
            }
        }
    }

    // Sync to all enrolled students
    for (const enrollment of courseDoc.studentEnrollments || []) {
        if (enrollment.status !== "active") continue;
        const student = await userCollection.findOne({
            _id: new ObjectId(enrollment.studentId),
        });
        if (student?.calendarId) {
            const res = await addOfficeHourEvent({
                name,
                day,
                startTime,
                endTime,
                location,
                calendarId: student.calendarId,
            });
            if (res?.eventId) {
                eventIds.students[student._id.toString()] = res.eventId;
            }
        }
    }

    const newOfficeHour = {
        _id: new ObjectId(),
        taId: taObjectId,
        day: day.trim(),
        startTime,
        endTime,
        location: location.trim(),
        notes: notes?.trim() || "",
        googleCalendarEventIds: eventIds,
    };

    const updateResult = await courseCollection.updateOne(
        {_id: courseObjectId},
        {$push: {taOfficeHours: newOfficeHour}}
    );

    if (updateResult.modifiedCount === 0) {
        throw "Failed to add office hour.";
    }

    return true;
};


export const deleteTAOfficeHour = async ({
                                             courseId,
                                             officeHourId,
                                             userId,
                                         }) => {
    if (!ObjectId.isValid(courseId) || !ObjectId.isValid(officeHourId)) {
        throw "Invalid course or office hour ID.";
    }

    const courseCollection = await courses();
    const userCollection = await users();

    const courseObjectId = new ObjectId(courseId);
    const officeHourObjectId = new ObjectId(officeHourId);
    const taObjectId = new ObjectId(userId);

    const user = await userCollection.findOne({_id: taObjectId});
    if (
        !user ||
        !user.taForCourses?.some(
            (id) => id.toString() === courseObjectId.toString()
        )
    ) {
        throw "You are Not Authorized to Modify Office Hours for this Course";
    }

    const course = await courseCollection.findOne({_id: courseObjectId});
    if (!course) throw "Course not found.";

    const targetHour = course.taOfficeHours.find(
        (oh) =>
            oh?._id?.toString() === officeHourId &&
            oh?.taId?.toString() === userId
    );

    if (!targetHour) throw "No Matching Office Hour Found.";

    // 🔄 Delete from individual calendars
    if (targetHour.googleCalendarEventIds) {
        for (const [calendarType, eventsObj] of Object.entries(
            targetHour.googleCalendarEventIds
        )) {
            for (const [userId, eventId] of Object.entries(eventsObj)) {
                try {
                    const user = await userCollection.findOne({_id: new ObjectId(userId)});
                    if (user?.calendarId && eventId) {
                        await deleteOfficeHourEvent(user.calendarId, eventId);
                    }
                } catch (e) {
                    console.warn(`⚠️ Failed to delete ${calendarType} event for ${userId}: ${e.message}`);
                }
            }
        }
    }

    const updateResult = await courseCollection.updateOne(
        {_id: courseObjectId},
        {
            $pull: {
                taOfficeHours: {
                    _id: officeHourObjectId,
                    taId: taObjectId,
                },
            },
        }
    );

    if (updateResult.modifiedCount === 0) {
        throw "No Matching Office Hour was found to delete.";
    }

    return true;
};
