import { lectures, courses } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import { stringValidate } from "../validation.js";
import {
  addLectureToCalendars,
  updateLectureEvent,
} from "../services/calendarSync.js";

let createLecture = async (
  courseId,
  lectureTitle,
  lectureDate,
  lectureStartTime,
  lectureEndTime,
  description,
  materialsLink
) => {
  if (
    !courseId ||
    !lectureTitle ||
    !lectureDate ||
    !lectureStartTime ||
    !lectureEndTime ||
    !description ||
    !materialsLink
  ) {
    throw "All fields are required.";
  }

  courseId = stringValidate(courseId);
  lectureTitle = stringValidate(lectureTitle);
  lectureDate = stringValidate(lectureDate);
  lectureStartTime = stringValidate(lectureStartTime);
  lectureEndTime = stringValidate(lectureEndTime);
  description = stringValidate(description);
  materialsLink = stringValidate(materialsLink);

  if (!ObjectId.isValid(courseId)) {
    throw "Invalid Course ID.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(lectureDate)) {
    throw "Lecture Date must be in YYYY-MM-DD format.";
  }

  if (lectureDate < new Date().toISOString().split("T")[0]) {
    throw "Lecture Date must either be today or in the future.";
  }

  if (!/^\d{2}:\d{2}$/.test(lectureStartTime)) {
    throw "Lecture Start time must be in HH:MM format.";
  }

  const startDateTime = new Date(`${lectureDate}T${lectureStartTime}:00`);
  let endDateTime = new Date(`${lectureDate}T${lectureEndTime}:00`);

  if (endDateTime <= startDateTime) {
    endDateTime.setDate(endDateTime.getDate() + 1);
  }

  if (startDateTime >= endDateTime) {
    throw new Error("Lecture Start time must be before Lecture End time.");
  }

  if (!/^\d{2}:\d{2}$/.test(lectureEndTime)) {
    throw "Lecture End time must be in HH:MM format.";
  }

  const courseCollection = await courses();
  const courseDoc = await courseCollection.findOne({
    _id: new ObjectId(courseId),
  });

  if (!courseDoc) {
    throw "Course ID does not exist.";
  }

  const professorId = courseDoc.professorId?.toString();
  if (!ObjectId.isValid(professorId)) {
    throw "Invalid Professor ID in course.";
  }

  const lectureCollection = await lectures();

  const existingTitle = await lectureCollection.findOne({
    courseId: new ObjectId(courseId),
    lectureTitle: { $regex: `^${lectureTitle}$`, $options: "i" },
  });

  if (existingTitle) {
    throw "Lecture title already exists for this course. Please choose a different title.";
  }

  const existingConflict = await lectureCollection.findOne({
    courseId: new ObjectId(courseId),
    lectureDate,
    lectureStartTime,
    lectureEndTime: { $gte: lectureStartTime },
  });

  if (existingConflict) {
    throw `A lecture already exists for ${lectureDate} at ${lectureStartTime} till ${lectureEndTime}. Please pick a different time.`;
  }

  const newLecture = {
    courseId: new ObjectId(courseId),
    professorId: new ObjectId(professorId),
    lectureTitle,
    lectureDate,
    lectureStartTime,
    lectureEndTime,
    description,
    materialsLink,
    ratings: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const insertion = await lectureCollection.insertOne(newLecture);
  if (!insertion.acknowledged) {
    throw "Could not create lecture.";
  }

  newLecture._id = insertion.insertedId;
  newLecture.courseCode = courseDoc.courseCode;

  try {
    const calendarEventIds = await addLectureToCalendars(newLecture);
    await lectureCollection.updateOne(
      { _id: insertion.insertedId },
      { $set: { calendarEventIds } }
    );
    newLecture.calendarEventIds = calendarEventIds;
  } catch (err) {
    console.error("⚠️ Lecture created but calendar sync failed:", err.message);
  }

  return {
    isLectureCreated: true,
    lectureId: insertion.insertedId.toString(),
  };
};

const updateLecture = async (lectureId, updates) => {
  lectureId = stringValidate(lectureId);
  const lectureCollection = await lectures();
  const courseCollection = await courses();

  const oldLecture = await lectureCollection.findOne({
    _id: new ObjectId(lectureId),
  });
  if (!oldLecture) throw "Lecture not found";

  if (updates.lectureTitle)
    updates.lectureTitle = stringValidate(updates.lectureTitle);
  if (updates.lectureDate)
    updates.lectureDate = stringValidate(updates.lectureDate);
  if (updates.lectureStartTime)
    updates.lectureStartTime = stringValidate(updates.lectureStartTime);
  if (updates.lectureEndTime)
    updates.lectureEndTime = stringValidate(updates.lectureEndTime);
  if (updates.description)
    updates.description = stringValidate(updates.description);
  if (updates.materialsLink)
    updates.materialsLink = stringValidate(updates.materialsLink);

  updates.updatedAt = new Date();

  const updateInfo = await lectureCollection.updateOne(
    { _id: new ObjectId(lectureId) },
    { $set: updates }
  );

  const courseDoc = await courseCollection.findOne({
    _id: oldLecture.courseId,
  });
  if (!courseDoc) throw "Course not found";

  if (oldLecture.calendarEventIds) {
    const updatedData = {
      ...oldLecture,
      ...updates,
      courseCode: courseDoc.courseCode,
    };

    for (const [calendarType, eventId] of Object.entries(
      oldLecture.calendarEventIds
    )) {
      if (eventId) {
        await updateLectureEvent(calendarType, eventId, updatedData);
      }
    }
  }

  return updateInfo;
};

let insertRating = async (lectureId, studentId, rating) => {
  lectureId = stringValidate(lectureId);
  studentId = stringValidate(studentId);
  rating = parseInt(rating);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    throw "Rating must be a number between 1 and 5 and in increments of 0.5.";
  }
  if (!ObjectId.isValid(lectureId)) {
    throw "Invalid lecture ID.";
  }
  if (!ObjectId.isValid(studentId)) {
    throw "Invalid student ID.";
  }
  const lectureCollection = await lectures();
  const lecture = await lectureCollection.updateOne(
    {
      _id: new ObjectId(lectureId),
      ratings: { $not: { $elemMatch: { studentId: new ObjectId(studentId) } } },
    },
    {
      $push: {
        ratings: {
          studentId: new ObjectId(studentId),
          rating: rating,
        },
      },
    }
  );

  return { isRatingAdded: true };
};

const getLectureById = async (lectureId) => {
  if (!lectureId) throw "Lecture ID is required";
  if (typeof lectureId !== "string") throw "Lecture ID must be a string";
  lectureId = lectureId.trim();
  if (lectureId.length === 0) throw "Lecture ID cannot be empty";

  try {
    const lecturesCollection = await lectures();
    const objectId = new ObjectId(lectureId);
    const lecture = await lecturesCollection.findOne({ _id: objectId });

    if (!lecture) throw "Lecture not found";

    lecture._id = lecture._id.toString();

    return lecture;
  } catch (e) {
    if (e.message === "Lecture not found") throw e;
    if (e instanceof ObjectId.TypeError) throw "Invalid lecture ID format";
    throw `Error retrieving lecture: ${e.message}`;
  }
};

const getAverageRating = async (lectureId) => {
  if (!lectureId) throw "Lecture ID is required";

  const lectureCollection = await lectures();
  const lecture = await lectureCollection.findOne({
    _id: new ObjectId(lectureId),
  });

  if (!lecture) throw "Lecture not found";

  if (!lecture || !lecture.ratings || lecture.ratings.length === 0) {
    return "No ratings yet";
  }

  const sum = lecture.ratings.reduce(
    (total, rating) => total + rating.rating,
    0
  );
  return (sum / lecture.ratings.length).toFixed(1);
};

const validateAttendanceData = async (attendanceData, studentIds) => {
  if (!attendanceData) {
    throw "No attendance data submitted. Please select attendance status for all students.";
  }

  if (Array.isArray(studentIds) && studentIds.length > 0) {
    for (const studentId of studentIds) {
      if (
        !attendanceData[studentId] ||
        !["present", "absent", "excused"].includes(attendanceData[studentId])
      ) {
        throw `Missing or invalid attendance status for student ${studentId}. Please select a status for all students.`;
      }
    }
  }

  return true;
};

export default {
  createLecture,
  updateLecture,
  insertRating,
  getLectureById,
  getAverageRating,
  validateAttendanceData,
};
