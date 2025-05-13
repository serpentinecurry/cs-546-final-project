import { ObjectId } from "mongodb";
import { users, courses, lectures } from "../config/mongoCollections.js";

const checkEnrollment = (course, studentId) => {
  let studentEnrollments = course.studentEnrollments;
  let enrollment;

  for (let x of studentEnrollments) {
    if (x.studentId.toString() === studentId) {
      enrollment = x;
      break;
    }
  }

  return enrollment.status === "active";
};

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
    })
    .toArray();

  // array of all the students' lectures
  let studentLectures = [];
  const lectureCollection = await lectures();

  for (let course of studentCourses) {
    if (checkEnrollment(course, studentId)) {
      let courseId = course._id;

      let courseLectures = await lectureCollection
        .find({ courseId: courseId })
        .toArray();
      for (let lecture of courseLectures) {
        lecture.courseCode = course.courseCode;
      }

      studentLectures = studentLectures.concat(courseLectures);
    }
  }

  return lecturesToEventObjects(studentLectures);
};

const lecturesToEventObjects = (lectures) => {
  let events = [];

  for (let l of lectures) {
    const eventObject = {};
    eventObject.id = l.courseCode + "-" + l.lectureDate;
    eventObject.title = l.courseCode + " - " + l.lectureTitle;
    eventObject.backgroundColor = " #d00000 ";
    eventObject.borderColor = " #d00000 ";

    let date = l.lectureDate.split("-");

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

const getOfficeHours = async (studentId) => {
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

  let officeHours = [];

  for (let course of studentCourses) {
    if (checkEnrollment(course, studentId)) {
      let professorOfficeHours = course.professorOfficeHours;
      const professor = await userCollection.findOne({
        _id: course.professorId,
      });

      for (let item of professorOfficeHours) {
        item.name = professor.firstName + " " + professor.lastName;
        item.color = " #0168dc ";
      }

      let taOfficeHours = course.taOfficeHours;

      for (let item of taOfficeHours) {
        const ta = await userCollection.findOne({
          _id: item.taId,
        });

        item.name = ta.firstName + " " + ta.lastName;
        item.color = " #53b656 ";
      }

      officeHours = officeHours.concat(
        course.professorOfficeHours,
        course.taOfficeHours
      );
    }
  }

  return officeHoursToEventObjects(officeHours);
};

const officeHoursToEventObjects = (officeHours) => {
  let events = [];
  let weekDays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  for (let oh of officeHours) {
    const eventObject = {};

    eventObject.title = `${oh.name}'s Office Hours in ${oh.location}`;
    eventObject.daysOfWeek = [weekDays.indexOf(oh.day)];
    eventObject.startTime = oh.startTime;
    eventObject.endTime = oh.endTime;
    eventObject.backgroundColor = oh.color;
    eventObject.borderColor = oh.color;

    events.push(JSON.stringify(eventObject));
  }

  return events;
};

export default { getStudentLectures, getOfficeHours };
