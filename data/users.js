import { users, changeRequests, courses, lectures } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import { sendChangeApprovalEmail } from "../utils/mailer.js";
import {
  stringValidate,
  azAZLenValidate,
  validateEmail,
  passwordValidate,
  isValidDateString,
  calculateAge,
} from "../validation.js";
import {addLectureToCalendars, addOfficeHourEvent, createPersonalCalendar} from "../services/calendarSync.js"; // adjust path

const SALT_ROUNDS = 10;

const createUser = async (
  firstName,
  lastName,
  gender,
  email,
  password,
  role,
  dateOfBirth,
  major
) => {
  firstName = stringValidate(firstName);
  azAZLenValidate(firstName, 2, 20);

  lastName = stringValidate(lastName);
  azAZLenValidate(lastName, 2, 20);

  let age = calculateAge(dateOfBirth);
  if (age < 15) throw "Minimum age is 15 to Signup!";

  if (!["male", "female", "other"].includes(gender)) throw "Invalid gender";
  email = validateEmail(email);

  passwordValidate(password);
  if (!["student", "professor", "admin", "ta"].includes(role))
    throw "Invalid user role";

  if (!isValidDateString(dateOfBirth)) {
    throw "Invalid date of birth";
  }
  if (
    role === "student" &&
    (!major || typeof major !== "string" || major.trim().length === 0)
  )
    throw "Student must have a major";

  const usersCollection = await users();
  const existing = await usersCollection.findOne({
    email: { $regex: `^${email}$`, $options: "i" },
  });
  if (existing) throw "Email already exists";
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const calendarId = await createPersonalCalendar(email, role);

  const newUser = {
    firstName,
    lastName,
    age,
    gender,
    email: email.toLowerCase(),
    password: hashedPassword,
    role,
    dateOfBirth,
    accessStatus: "Pending",
    userCreatedAt: new Date(),
    calendarId: calendarId || null
  };
  if (role === "student") {
    newUser.major = major;
    newUser.absenceRequests = [];
    newUser.lectureNotes = [];
  }
  if (role === "ta") {
    newUser.taForCourses = [];
    newUser.major = major;
    newUser.absenceRequests = [];
    newUser.lectureNotes = [];
  }
  if (role === "professor") {
    if (major.trim() !== "") throw "Major field is only for Students!";
  }
  const insertResult = await usersCollection.insertOne(newUser);
  if (!insertResult.acknowledged) throw "Failed to create user";
  return { registrationCompleted: true };
};

const login = async (email, password) => {
  email = validateEmail(email);
  passwordValidate(password);
  const usersCollection = await users();
  const user = await usersCollection.findOne({
    email: { $regex: `^${email}$`, $options: "i" },
  });
  if (!user) throw "Either the Email-ID or the password is invalid";
  if (user.accessStatus !== "approved")
    throw "Your account is not approved yet. Please wait for admin approval.";
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw "Either the Email-ID or the password is invalid";
  const {
    _id,
    firstName,
    lastName,
    age,
    gender,
    email: storedEmail,
    role,
    major,
    dateOfBirth,
    accessStatus,
    userCreatedAt,
  } = user;
  return {
    _id,
    firstName,
    lastName,
    age,
    gender,
    email: storedEmail,
    role,
    major,
    dateOfBirth,
    accessStatus,
    userCreatedAt,
  };
};

const createRequest = async (userId, field, newValue) => {
  userId = stringValidate(userId);
  if (!ObjectId.isValid(userId)) throw "Invalid userId";
  if (!["major", "email"].includes(field)) throw "Invalid field to change";

  const requestCollection = await changeRequests();
  const userCollection = await users();

  const user = await userCollection.findOne({ _id: new ObjectId(userId) });
  if (!user) throw "User not found";

  const existing = await requestCollection.findOne({
    userId: new ObjectId(userId),
    field,
    status: "pending",
  });
  if (existing)
    throw `You already have a pending request to change your ${field}`;

  const newRequest = {
    userId: new ObjectId(userId),
    field,
    oldValue: user[field],
    newValue,
    status: "pending",
    requestedAt: new Date(),
    reviewedAt: null,
    adminNote: "",
  };
  const insertResult = await requestCollection.insertOne(newRequest);
  if (!insertResult.acknowledged) throw "Failed to submit change request";

  return { requestSuccessfull: true };
};

const approveRequest = async (requestId) => {
  requestId = stringValidate(requestId);
  if (!ObjectId.isValid(requestId)) throw "Invalid request ID";

  const requestCollection = await changeRequests();
  const userCollection = await users();

  const req = await requestCollection.findOne({ _id: new ObjectId(requestId) });
  if (!req) throw "Change request not found";
  if (req.status !== "pending") throw "Request already resolved";

  const courseUpdateResult = await userCollection.updateOne(
    { _id: new ObjectId(req.userId) },
    { $set: { [req.field]: req.newValue } }
  );

  if (!courseUpdateResult.modifiedCount) throw "Failed to update user data";

  await requestCollection.updateOne(
    { _id: new ObjectId(requestId) },
    { $set: { status: "approved", reviewedAt: new Date() } }
  );

  const user = await userCollection.findOne({ _id: req.userId });
  if (user && user.email) {
    const fullName = `${user.firstName} ${user.lastName}`;
    await sendChangeApprovalEmail(
      user.email,
      fullName,
      req.field,
      req.newValue
    );
  }
  return true;
};

const rejectRequest = async (requestId, adminNote = "") => {
  requestId = stringValidate(requestId);
  if (!ObjectId.isValid(requestId)) throw "Invalid request ID";

  const requestCollection = await changeRequests();

  const req = await requestCollection.findOne({ _id: new ObjectId(requestId) });
  if (!req) throw "Change request not found";
  if (req.status !== "pending") throw "Request already resolved";

  await requestCollection.updateOne(
    { _id: new ObjectId(requestId) },
    { $set: { status: "rejected", reviewedAt: new Date(), adminNote } }
  );

  return true;
};

const getPendingEnrollmentRequests = async (courseId) => {
  courseId = stringValidate(courseId);
  if (!ObjectId.isValid(courseId)) throw "Invalid courseId";

  const usersCollection = await users();
  const courseCollection = await courses();

  const course = await courseCollection.findOne({
    _id: new ObjectId(courseId),
  });
  if (!course) throw "Course not found";

  if (!course.studentEnrollments || course.studentEnrollments.length === 0) {
    return [];
  }

  const pendingStudentIds = course.studentEnrollments
    .filter((enrollment) => enrollment.status === "pending")
    .map((enrollment) => enrollment.studentId);

  if (pendingStudentIds.length === 0) {
    return [];
  }

  const pendingStudents = await usersCollection
    .find({ _id: { $in: pendingStudentIds } })
    .toArray();

  console.log(`Found ${pendingStudents.length} matching student records`);
  return pendingStudents;
};

const approveEnrollmentRequest = async (studentId, courseId) => {
  if (!studentId) throw "Student ID is required";
  if (!courseId) throw "Course ID is required";

  studentId = stringValidate(studentId);
  courseId = stringValidate(courseId);

  if (!ObjectId.isValid(studentId)) throw "Invalid studentId";
  if (!ObjectId.isValid(courseId)) throw "Invalid courseId";

  const courseCollection = await courses();
  const lectureCollection = await lectures();

  // 1. Approve the student's enrollment status
  const courseUpdateResult = await courseCollection.updateOne(
    {
      _id: new ObjectId(courseId),
      "studentEnrollments.studentId": new ObjectId(studentId),
    },
    {
      $set: { "studentEnrollments.$.status": "active" },
    }
  );

  if (courseUpdateResult.modifiedCount === 0) {
    throw "Failed to approve enrollment request";
  }

  // 2. Sync all existing lectures of this course to the student's calendar
  const courseLectures = await lectureCollection
    .find({ courseId: new ObjectId(courseId) })
    .toArray();

  for (const lecture of courseLectures) {
    try {
      // Add courseCode to lecture object if not present
      if (!lecture.courseCode) {
        const courseDoc = await courseCollection.findOne({
          _id: new ObjectId(courseId),
        });
        lecture.courseCode = courseDoc.courseCode;
      }

      await addLectureToCalendars(lecture);
    } catch (e) {
      console.warn(
        `⚠️ Failed to sync lecture ${lecture.lectureTitle} to student ${studentId}`,
        e.message
      );
    }
  }

  return { enrollmentApproved: true };
};


const rejectEnrollmentRequest = async (studentId, courseId) => {
  studentId = stringValidate(studentId);
  courseId = stringValidate(courseId);

  if (!ObjectId.isValid(studentId)) throw "Invalid studentId";
  if (!ObjectId.isValid(courseId)) throw "Invalid courseId";

  const courseCollection = await courses();

  const courseUpdateResult = await courseCollection.updateOne(
    {
      _id: new ObjectId(courseId),
      "studentEnrollments.studentId": new ObjectId(studentId),
    },
    {
      $set: { "studentEnrollments.$.status": "rejected" },
    }
  );

  if (courseUpdateResult.modifiedCount === 0)
    throw "Failed to reject enrollment request";

  return { enrollmentRejected: true };
};

const getUserByEmail = async (email) => {
  email = validateEmail(email);
  const usersCollection = await users();
  const user = await usersCollection.findOne({
    email: { $regex: `^${email}$`, $options: "i" },
  });
  if (!user) throw "User not found";
  return user;
};

const addLectureNotes = async (studentId, lectureId, courseId, notes) => {
  studentId = stringValidate(studentId);
  courseId = stringValidate(courseId);
  lectureId = stringValidate(lectureId);
  notes = stringValidate(notes);

  if (!ObjectId.isValid(studentId)) throw "Invalid studentId";
  if (!ObjectId.isValid(courseId)) throw "Invalid courseId";
  if (!ObjectId.isValid(lectureId)) throw "Invalid lectureId";

  const userCollection = await users();
  const user = await userCollection.findOne({
    _id: new ObjectId(studentId),
  });

  let lectureNotes = user.lectureNotes;
  let now = new Date();

  let indexToRemove = lectureNotes.findIndex((obj) => {
    return obj.lectureId.toString() === lectureId;
  });

  const notesObject =
    indexToRemove !== -1
      ? lectureNotes.at(indexToRemove)
      : {
          lectureId: new ObjectId(lectureId),
          courseId: new ObjectId(courseId),
          createdAt: now.toString(),
        };

  notesObject.noteContent = notes;
  notesObject.updatedAt = now.toString();

  if (indexToRemove === -1) {
    lectureNotes.push(notesObject);
  } else {
    lectureNotes.splice(indexToRemove, notesObject);
  }

  const updateInfo = await userCollection.findOneAndUpdate(
    { _id: new ObjectId(studentId) },
    { $set: { lectureNotes: lectureNotes } },
    { returnDocument: "after" }
  );

  if (!updateInfo) throw `Update unsuccessful`;

  return { updateSuccessful: true };
};

const getLectureNotes = async (studentId, lectureId) => {
  studentId = stringValidate(studentId);
  lectureId = stringValidate(lectureId);

  if (!ObjectId.isValid(studentId)) throw "Invalid studentId";
  if (!ObjectId.isValid(lectureId)) throw "Invalid lectureId";

  const userCollection = await users();
  const user = await userCollection.findOne({
    _id: new ObjectId(studentId),
  });

  let lectureNotes = user.lectureNotes;

  let indexToRemove = lectureNotes.findIndex((obj) => {
    return obj.lectureId.toString() === lectureId;
  });

  if (indexToRemove === -1) {
    return "";
  } else {
    return lectureNotes[indexToRemove].noteContent;
  }
};

export default {
  createUser,
  login,
  createRequest,
  approveRequest,
  rejectRequest,
  getPendingEnrollmentRequests,
  approveEnrollmentRequest,
  rejectEnrollmentRequest,
  getUserByEmail,
  addLectureNotes,
  getLectureNotes,
};
