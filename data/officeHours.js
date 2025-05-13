// data/officeHours.js

import { ObjectId } from "mongodb";
import { courses, users } from "../config/mongoCollections.js";
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

  const user = await userCollection.findOne({ _id: taObjectId });
  if (
    !user ||
    !user.taForCourses?.some(
      (id) => id.toString() === courseObjectId.toString()
    )
  ) {
    throw "You are Not Authorized to Modify Office Hours for this Course.";
  }

  const name = `${user.firstName} ${user.lastName}`;
  const eventIds = {};
  for (const calendarType of ["students", "tas", "professors"]) {
    const result = await addOfficeHourEvent({
      name,
      day,
      startTime,
      endTime,
      location,
      calendarType,
    });
    if (result?.eventId) {
      eventIds[calendarType] = result.eventId;
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
    { _id: courseObjectId },
    { $push: { taOfficeHours: newOfficeHour } }
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
  const taObjectId = new ObjectId(userId);
  const officeHourObjectId = new ObjectId(officeHourId);

  const user = await userCollection.findOne({ _id: taObjectId });
  if (
    !user ||
    !user.taForCourses?.some(
      (id) => id.toString() === courseObjectId.toString()
    )
  ) {
    throw "You are Not Authorized to Modify Office Hours for this Course";
  }

  const course = await courseCollection.findOne({ _id: courseObjectId });
  if (!course) throw "Course not found.";

  const targetHour = course.taOfficeHours.find((oh) => {
    if (!oh?._id || !oh?.taId) return false;
    return oh._id.toString() === officeHourId && oh.taId.toString() === userId;
  });

  if (!targetHour) throw "No Matching Office Hour Found.";

  if (targetHour.googleCalendarEventIds) {
    for (const [calendarType, eventId] of Object.entries(
      targetHour.googleCalendarEventIds
    )) {
      await deleteOfficeHourEvent(calendarType, eventId);
    }
  }

  const updateResult = await courseCollection.updateOne(
    { _id: courseObjectId },
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
