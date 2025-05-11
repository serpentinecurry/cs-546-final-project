import { ObjectId } from "mongodb";
import { users, courses, lectures } from "../config/mongoCollections.js";

// function that returns an array of all lectures for a given student
const getStudentLectures = async (studentId) => {
  const userCollection = await users();
  const student = await userCollection.findOne({
    _id: new ObjectId(studentId),
  });

  if (!student) throw `Student with ID ${studentId} not found`;

  const courseCollection = await courses();
  // get courses that the student is in
  const studentCourses = await courseCollection
    .find({
      "studentEnrollments.studentId": new ObjectId(studentId),
      "studentEnrollments.status": "active",
    })
    .toArray();

  // array of all the students' lectures
  let studentLectures = [];
  const lectureCollection = await lectures();

  for (let course of studentCourses) {
    let courseId = course._id;

    let courseLectures = await lectureCollection
      .find({ courseId: courseId })
      .toArray();
    for (let lecture of courseLectures) {
      lecture.courseCode = course.courseCode;
    }

    studentLectures = studentLectures.concat(courseLectures);
  }

  return lecturesToEventObjects(studentLectures);
};

const lecturesToEventObjects = async (lectures) => {
  let events = [];

  for (let l of lectures) {
    const eventObject = {};
    // event id: "coursecode-date" (e.g. CS-546-2025-04-15)
    eventObject.id = l.courseCode + "-" + l.lectureDate;
    // CS-546 - Learn AJAX
    eventObject.title = l.courseCode + " - " + l.lectureTitle;

    // get individual parts of the date
    let date = l.lectureDate.split("-");

    // get start and end time
    let startTime = l.lectureStartTime.split(":");
    let endTime = l.lectureEndTime.split(":");

    const start = new Date(
      date[0],
      date[1] - 1,
      date[2],
      startTime[0],
      startTime[1]
    );
    const end = new Date(date[0], date[1] - 1, date[2], endTime[0], endTime[1]);

    eventObject.start = start;
    eventObject.end = end;

    events.push(JSON.stringify(eventObject));
  }

  return events;
};

export default { getStudentLectures };
