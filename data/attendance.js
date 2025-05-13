import { attendance, users, courses, lectures } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb"
import { stringValidate } from "../validation.js";
import courseData from "./courses.js";

// {
//     "_id": "ObjectId",
//     "lectureId": "ObjectId_lecture",
//     "courseId": "ObjectId_course",
//     "studentId": "ObjectId_student",
//     "status": "present",
//     "points": 0,
//     "createdAt": "timestamp"
// }

// uses createAttendance, updateAttendance; it will be adding 1 point for each class missed, for now excused does not add points
let createAttendance = async (lectureId, courseId, studentId, status) => {
  if (!lectureId || !courseId || !studentId || !status) {
    throw "All fields are required.";
  }

  const attendanceCollection = await attendance();
  
  lectureId = stringValidate(lectureId);
  courseId = stringValidate(courseId);
  studentId = stringValidate(studentId);
  status = stringValidate(status);
  if (!ObjectId.isValid(lectureId)) {
    throw "Invalid lecture ID.";
  }
  if (!ObjectId.isValid(courseId)) {
    throw "Invalid course ID.";
  }
  if (!ObjectId.isValid(studentId)) {
    throw "Invalid student ID.";
  }
  if (status !== "present" && status !== "absent" && status !== "excused") {
    throw "Status must be either 'present' or 'absent or excused '.";
  }

  let points = 0;
  if (status === "absent") {
    points = 1;
  }

  const lectObjId = new ObjectId(lectureId);
  const courseObjId = new ObjectId(courseId);
  const studObjId = new ObjectId(studentId);

  const existingRecord = await attendanceCollection.findOne({
    lectureId: lectObjId,
    courseId: courseObjId,
    studentId: studObjId,
  });

  if (existingRecord) {
    const updateInfo = await attendanceCollection.updateOne(
      { _id: existingRecord._id },
      {
        $set: {
          status: status,
          points: points,
          updatedAt: new Date(),
        },
      }
    );
    if (updateInfo.modifiedCount === 0) {
      throw "Could not update attendance record";
    }

    return {
      updated: true,
      attendanceId: existingRecord._id.toString(),
      status: status,
    };
  } else {
    const newAttendance = {
      lectureId: lectObjId,
      courseId: courseObjId,
      studentId: studObjId,
      status: status,
      points: points,
      createdAt: new Date(),
    };

    const insertInfo = await attendanceCollection.insertOne(newAttendance);

    if (!insertInfo.insertedId) {
      throw "Failed to insert attendance record";
    }

    return {
      created: true,
      attendanceId: insertInfo.insertedId.toString(),
      status: status,
    };
  }
};

let updateAttendance = async (attendanceId, updates) => {
  const attendanceCollection = await attendance();
  attendanceId = stringValidate(attendanceId);
  let existingAttendance = await attendanceCollection.findOne({
    _id: new ObjectId(attendanceId),
  });
  if (!existingAttendance) {
    throw "Attendance record not found";
  }

  if (updates.status) {
    updates.status = stringValidate(updates.status);
    if (
      updates.status !== "present" &&
      updates.status !== "absent" &&
      updates.status !== "excused"
    ) {
      throw "Status must be either 'present', 'absent', or 'excused'.";
    }
  }
  if (updates.points) {
    updates.points = parseInt(updates.points);
    if (isNaN(updates.points) || updates.points < 0) {
      throw "Points must be a non-negative number.";
    }
  }
  updates.updatedAt = new Date();
  const updateInfo = await attendancCollection.updateOne(
    { _id: new ObjectId(attendanceId) },
    { $set: updates }
  );
  if (updateInfo.modifiedCount === 0) {
    throw "Could not update attendance record";
  }
  return { isUpdated: true, attendanceId: attendanceId };
};

let averageAttendance = async (courseId) => {
  courseId = stringValidate(courseId);
  if (!ObjectId.isValid(courseId)) {
    throw "Invalid course ID";
  }

  const courseCollection = await courses();
  const course = await courseCollection.findOne({ _id: new ObjectId(courseId) });
  if (!course) {
    throw "Course not found";
  }

  
  const activeStudentIds = course.studentEnrollments
    .filter(enrollment => enrollment.status === "active" && enrollment.role !== "TA")
    .map(enrollment => new ObjectId(enrollment.studentId));

  const attendanceCollection = await attendance();

  const AttendanceTotal = await attendanceCollection
    .find({ 
      courseId: new ObjectId(courseId),
      studentId: { $in: activeStudentIds }
    })
    .toArray();

  const AttendanceCount = AttendanceTotal.filter(
    (record) => record.status === "present"
  ).length;

  const AttendanceCountExcused = AttendanceTotal.filter(
    (record) => record.status === "excused"
  ).length;

  const effectiveTotal = AttendanceTotal.length - AttendanceCountExcused;
  if (effectiveTotal === 0) return 100; 
  return Number(((AttendanceCount / effectiveTotal) * 100).toFixed(2));
};

const getAllPresentStudents = async (courseId) => {
  courseId = stringValidate(courseId);
  if (!ObjectId.isValid(courseId)) {
    throw "Invalid course ID";
  }

  const courseCollection = await courses();
  const course = await courseCollection.findOne({ _id: new ObjectId(courseId) });
  if (!course) {
    throw "Course not found";
  }

  // Filter out TAs and non-active students
  const activeStudentIds = course.studentEnrollments
    .filter(enrollment => enrollment.status === "active" && enrollment.role !== "TA")
    .map(enrollment => new ObjectId(enrollment.studentId));

  const attendanceCollection = await attendance();

  const presentRecords = await attendanceCollection
    .find({ 
      courseId: new ObjectId(courseId), 
      status: "present",
      studentId: { $in: activeStudentIds }
    })
    .toArray();

  return presentRecords;
};

const getAllAbsentStudents = async (courseId) => {
  courseId = stringValidate(courseId);
  if (!ObjectId.isValid(courseId)) {
    throw "Invalid course ID";
  }

  const courseCollection = await courses();
  const course = await courseCollection.findOne({ _id: new ObjectId(courseId) });
  if (!course) {
    throw "Course not found";
  }

  // Filter out TAs and non-active students
  const activeStudentIds = course.studentEnrollments
    .filter(enrollment => enrollment.status === "active" && enrollment.role !== "TA")
    .map(enrollment => new ObjectId(enrollment.studentId));

  const attendanceCollection = await attendance();

  const absentRecords = await attendanceCollection
    .find({ 
      courseId: new ObjectId(courseId), 
      status: "absent",
      studentId: { $in: activeStudentIds }
    })
    .toArray();

  return absentRecords;
};

const getAllExcusedStudents = async (courseId) => {
  courseId = stringValidate(courseId);
  if (!ObjectId.isValid(courseId)) {
    throw "Invalid course ID";
  }

  const courseCollection = await courses();
  const course = await courseCollection.findOne({ _id: new ObjectId(courseId) });
  if (!course) {
    throw "Course not found";
  }

  
  const activeStudentIds = course.studentEnrollments
    .filter(enrollment => enrollment.status === "active" && enrollment.role !== "TA")
    .map(enrollment => new ObjectId(enrollment.studentId));

  const attendanceCollection = await attendance();

  const excusedRecords = await attendanceCollection
    .find({ 
      courseId: new ObjectId(courseId), 
      status: "excused",
      studentId: { $in: activeStudentIds }
    })
    .toArray();

  return excusedRecords;
};

const getLecturePresentStudents = async (lectureId) => {
  lectureId = stringValidate(lectureId);
  if (!ObjectId.isValid(lectureId)) {
    throw "Invalid lecture ID";
  }

  const lectureCollection = await lectures();
  const lecture = await lectureCollection.findOne({ _id: new ObjectId(lectureId) });
  if (!lecture) {
    throw "Lecture not found";
  }

  const courseId = lecture.courseId.toString();
  
  // Get non-TA student IDs using the getStudentsNoTAs function
  const nonTAStudents = await courseData.getStudentsNoTAs(courseId);
  const nonTAStudentIds = nonTAStudents.map(student => new ObjectId(student._id));

  const attendanceCollection = await attendance();
  const presentRecords = await attendanceCollection
    .find({ 
      lectureId: new ObjectId(lectureId), 
      status: "present",
      studentId: { $in: nonTAStudentIds }
    })
    .toArray();

  return presentRecords;
};

const getLectureAbsentStudents = async (lectureId) => {
  lectureId = stringValidate(lectureId);
  if (!ObjectId.isValid(lectureId)) {
    throw "Invalid lecture ID";
  }

  const lectureCollection = await lectures();
  const lecture = await lectureCollection.findOne({ _id: new ObjectId(lectureId) });
  if (!lecture) {
    throw "Lecture not found";
  }

  const courseId = lecture.courseId.toString();
  
  // Get non-TA student IDs using the getStudentsNoTAs function
  const nonTAStudents = await courseData.getStudentsNoTAs(courseId);
  const nonTAStudentIds = nonTAStudents.map(student => new ObjectId(student._id));

  const attendanceCollection = await attendance();
  const absentRecords = await attendanceCollection
    .find({ 
      lectureId: new ObjectId(lectureId), 
      status: "absent",
      studentId: { $in: nonTAStudentIds }
    })
    .toArray();

  return absentRecords;
};

const getLectureExcusedStudents = async (lectureId) => {
  lectureId = stringValidate(lectureId);
  if (!ObjectId.isValid(lectureId)) {
    throw "Invalid lecture ID";
  }

  const lectureCollection = await lectures();
  const lecture = await lectureCollection.findOne({ _id: new ObjectId(lectureId) });
  if (!lecture) {
    throw "Lecture not found";
  }

  const courseId = lecture.courseId.toString();
  
  // Get non-TA student IDs using the getStudentsNoTAs function
  const nonTAStudents = await courseData.getStudentsNoTAs(courseId);
  const nonTAStudentIds = nonTAStudents.map(student => new ObjectId(student._id));

  const attendanceCollection = await attendance();
  const excusedRecords = await attendanceCollection
    .find({ 
      lectureId: new ObjectId(lectureId), 
      status: "excused",
      studentId: { $in: nonTAStudentIds }
    })
    .toArray();

  return excusedRecords;
};


const getTotalAbsencesFromStudent = async (studentId) => {
  studentId = stringValidate(studentId);
  if (!ObjectId.isValid(studentId)) {
    throw "Invalid student ID";
  }

  const attendanceCollection = await attendance();
  const absentRecords = await attendanceCollection
    .find({ 
      studentId: new ObjectId(studentId), 
      status: "absent"
    })
    .toArray();

  return absentRecords.length;
};


export default {
  createAttendance,
  updateAttendance,
  averageAttendance,
  getAllAbsentStudents,
  getAllPresentStudents,
  getAllExcusedStudents,
  getLectureAbsentStudents,
  getLecturePresentStudents,
  getLectureExcusedStudents,
  getTotalAbsencesFromStudent
};

