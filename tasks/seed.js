import { dbConnection, closeConnection } from "../config/mongoConnection.js";
import { userData, courseData, lectureData, attendanceData } from "../data/index.js";
import discussionsData from "../data/discussions.js";
import { users, courses, lectures, discussions, attendance } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";

const db = await dbConnection();
await db.dropDatabase();

const usersCollection = await users();
const coursesCollection = await courses();
const lecturesCollection = await lectures();
const discussionsCollection = await discussions();
const attendanceCollection = await attendance();

// Create admin - pass empty string for major
const adminInfo = await userData.createUser(
    "Anik", "Doshi", "male", "admin@scholorio.com", "Admin@911", "admin", "1990-01-01", ""
);
await usersCollection.updateOne({ email: "admin@scholorio.com" }, { $set: { accessStatus: "approved" } });
const admin = await usersCollection.findOne({ email: "admin@scholorio.com" });

// Create professor - pass empty string for major
const professorInfo = await userData.createUser(
    "Patrick", "Hill", "male", "phill@stevens.edu", "Password@123", "professor", "1980-04-30", ""
);
await usersCollection.updateOne({ email: "phill@stevens.edu" }, { $set: { accessStatus: "approved" } });
const professor = await userData.getUserByEmail("phill@stevens.edu");

// Create students - provide major field
const student1Info = await userData.createUser(
    "John", "Doe", "male", "jdoe@stevens.edu", "Password@123", "student", "2002-09-15", "Computer Science"
);
await usersCollection.updateOne({ email: "jdoe@stevens.edu" }, { $set: { accessStatus: "approved" } });
const student1 = await userData.getUserByEmail("jdoe@stevens.edu");

const student2Info = await userData.createUser(
    "Jane", "Smith", "female", "jsmith@stevens.edu", "Password@123", "student", "2001-05-22", "Computer Science"
);
await usersCollection.updateOne({ email: "jsmith@stevens.edu" }, { $set: { accessStatus: "approved" } });
const student2 = await userData.getUserByEmail("jsmith@stevens.edu");

const student3Info = await userData.createUser(
    "Michael", "Johnson", "male", "mjohnson@stevens.edu", "Password@123", "student", "2003-11-08", "Computer Engineering"
);
await usersCollection.updateOne({ email: "mjohnson@stevens.edu" }, { $set: { accessStatus: "approved" } });
const student3 = await userData.getUserByEmail("mjohnson@stevens.edu");

const taStudentInfo = await userData.createUser(
    "Sairithik", "Komuravelly", "male", "skomurav@stevens.edu", "Password@123", "student", "2003-06-18", "Computer Science"
);
await usersCollection.updateOne({ email: "skomurav@stevens.edu" }, { $set: { accessStatus: "approved" } });
const taStudent = await userData.getUserByEmail("skomurav@stevens.edu");

// Create courses
const webDev = await courseData.createCourse("Web Development", "CS-546", professor._id.toString());
const dbSystems = await courseData.createCourse("Database Systems", "CS-545", professor._id.toString());

// Get course IDs
const allCourses = await courseData.getAllCourses();
const webDevCourse = allCourses.find(course => course.courseCode === "CS-546");
const dbCourse = allCourses.find(course => course.courseCode === "CS-545");
const webDevCourseId = webDevCourse._id.toString();
const dbCourseId = dbCourse._id.toString();

// Add meeting days and times to courses
await coursesCollection.updateOne(
  { _id: new ObjectId(webDevCourseId) },
  { 
    $set: { 
      courseMeetingDays: [
        { day: "Monday" },
        { day: "Wednesday" }
      ],
      courseMeetingTime: [
        { startTime: "10:00", endTime: "11:50" },
        { startTime: "10:00", endTime: "11:50" }
      ]
    } 
  }
);

await coursesCollection.updateOne(
  { _id: new ObjectId(dbCourseId) },
  { 
    $set: { 
      courseMeetingDays: [
        { day: "Tuesday" },
        { day: "Thursday" }
      ],
      courseMeetingTime: [
        { startTime: "14:00", endTime: "15:50" },
        { startTime: "14:00", endTime: "15:50" }
      ]
    } 
  }
);

// Create lectures with all required fields
const lecture1 = await lectureData.createLecture(
    webDevCourseId,
    "Learn AJAX",
    "2025-09-05",
    "10:00",
    "11:50",
    "Learning the fundamentals of AJAX and asynchronous web requests.",
    "https://github.com/stevens-cs546-cs554/CS-546/tree/master/lecture_11"
);

const lecture2 = await lectureData.createLecture(
    webDevCourseId,
    "Basic HTML and CSS",
    "2025-09-12",  // Updated to future date
    "10:00",
    "11:50",
    "Learn how to implement basic HTML and CSS",
    "https://github.com/stevens-cs546-cs554/CS-546/tree/master/lecture_08"
);

const lecture3 = await lectureData.createLecture(
    dbCourseId,
    "SQL Fundamentals",
    "2025-09-07",  // Updated to future date
    "14:00",
    "15:50",
    "Introduction to SQL and basic database queries.",
    "https://drive.google.com/slides/sql-basics"
);

// Set lecture IDs
const lecture1Id = lecture1.lectureId.toString();
const lecture2Id = lecture2.lectureId.toString();
const lecture3Id = lecture3.lectureId.toString();





// Add student enrollments with proper status
// Student 1 - active in Web Dev
await coursesCollection.updateOne(
  { _id: new ObjectId(webDevCourseId) },
  { 
    $push: { 
      studentEnrollments: {
        studentId: student1._id,
        status: "active",
        requestedAt: new Date()
      }
    }
  }
);

// Student 2 - active in Web Dev
await coursesCollection.updateOne(
  { _id: new ObjectId(webDevCourseId) },
  { 
    $push: { 
      studentEnrollments: {
        studentId: student2._id,
        status: "pending", 
        requestedAt: new Date()
      }
    }
  }
);

// Student 3 - active in Web Dev and DB Systems
await coursesCollection.updateOne(
  { _id: new ObjectId(webDevCourseId) },
  { 
    $push: { 
      studentEnrollments: {
        studentId: student3._id,
        status: "pending",
        requestedAt: new Date()
      }
    }
  }
);

await coursesCollection.updateOne(
  { _id: new ObjectId(dbCourseId) },
  { 
    $push: { 
      studentEnrollments: {
        studentId: student3._id,
        status: "active",
        requestedAt: new Date()
      }
    }
  }
);



// Create attendances for students
// Lecture 1 - all students present
await attendanceData.createAttendance(lecture1Id, webDevCourseId, student1._id.toString(), "present");
await attendanceData.createAttendance(lecture1Id, webDevCourseId, student2._id.toString(), "present");
await attendanceData.createAttendance(lecture1Id, webDevCourseId, student3._id.toString(), "present");
await attendanceData.createAttendance(lecture1Id, webDevCourseId, taStudent._id.toString(), "present");


await attendanceData.createAttendance(lecture2Id, webDevCourseId, student1._id.toString(), "present");
await attendanceData.createAttendance(lecture2Id, webDevCourseId, student2._id.toString(), "absent");
await attendanceData.createAttendance(lecture2Id, webDevCourseId, student3._id.toString(), "excused");
await attendanceData.createAttendance(lecture2Id, webDevCourseId, taStudent._id.toString(), "present");


const discussion1 = await discussionsData.createDiscussion(
  lecture1Id,
  webDevCourseId, 
  professor._id.toString(),
  "AJAX Discussion Thread",
  "Use this thread to ask questions about AJAX concepts covered in today's lecture."
);

const discussion2 = await discussionsData.createDiscussion(
  lecture2Id, 
  webDevCourseId,
  professor._id.toString(),
  "DOM Manipulation Questions",
  "If you have any questions about DOM manipulation techniques, post them here."
);

// Add comments to discussions
await discussionsData.addAComment(
  discussion1._id,
  webDevCourseId,
  student1._id.toString(),
  "Can you explain the difference between synchronous and asynchronous requests?",
  false
);

await discussionsData.addAComment(
  discussion1._id,
  webDevCourseId,
  professor._id.toString(),
  "Great question! Synchronous requests block execution until a response is received, while asynchronous requests allow the code to continue execution while waiting for a response.",
  false
);

await discussionsData.addAComment(
  discussion2._id,
  webDevCourseId,
  student2._id.toString(),
  "What's the best way to create dynamic elements that respond to user interactions?",
  false
);

console.log("Database seeded successfully!");
await closeConnection();