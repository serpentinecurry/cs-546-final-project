import { dbConnection, closeConnection } from "../config/mongoConnection.js";
import { userData, courseData } from "../data/index.js"
import lectureData from "../data/lectures.js";
import { users, courses } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";

const db = await dbConnection();
await db.dropDatabase();

const usersCollection = await users();
const coursesCollection = await courses();

const user1 = await userData.createUser(
    "Anik", "Doshi", "male", "admin@scholorio.com", "Admin@911", "admin", "1990-01-01"
)
await usersCollection.updateOne({ email: "admin@scholorio.com" }, { $set: { accessStatus: "approved" } });

const user2 = await userData.createUser(
    "Sairithik", "Komuravelly", "male", "skomurav@stevens.edu", "Password@123", "student", "2003-06-18", "Computer Science"
)
await usersCollection.updateOne({ email: "skomurav@stevens.edu" }, { $set: { accessStatus: "approved" } })

const user3 = await userData.createUser(
    "Patrick", "Hill", "male", "phill@stevens.edu", "Password@123", "professor", "2003-04-30"
)
await usersCollection.updateOne({ email: "phill@stevens.edu" }, { $set: { accessStatus: "approved" } });


const user4 = await userData.createUser(
    "Archiit", "Rajanala", "male", "arajanal@stevens.edu", "Hash@123", "student", "2003-07-18", "Computer Science"
)

const professor = await usersCollection.findOne({ email: "phill@stevens.edu" });


const course1 = await courseData.createCourse(
    "Web Development", "CS-546", professor._id.toString()
)

const course2 = await courseData.createCourse(
    "Database Systems", "CS-545", professor._id.toString()
)


const allCourses = await courseData.getAllCourses();
const webDevCourse = allCourses.find(course => course.courseCode === "CS-546");
const dbCourse = allCourses.find(course => course.courseCode === "CS-545");

if (!webDevCourse || !dbCourse) {
  throw "Failed to find created courses";
}

const webDevCourseId = webDevCourse._id.toString();
const dbCourseId = dbCourse._id.toString();


const lecture1 = await lectureData.createLecture(
    webDevCourseId,
    "Learn AJAX",
    "2025-04-15",
    "Covering Async functions in javascript",
    "https://drive.google.com/slides/ajax-intro"
  );

  const lecture2 = await lectureData.createLecture(
    webDevCourseId,
    "DOM Manipulation",
    "2025-04-08",
    "Learning to manipulate the Document Object Model with JavaScript",
    "https://drive.google.com/slides/dom-basics"
  );

// Adding students with pending enrollment requests
const pendingStudent1 = await userData.createUser(
  "John", "Doe", "male", "jdoe@stevens.edu", "Password@123", "student", "2002-09-15", "Computer Science"
);
await usersCollection.updateOne({ email: "jdoe@stevens.edu" }, { $set: { accessStatus: "approved" } });

const pendingStudent2 = await userData.createUser(
  "Jane", "Smith", "female", "jsmith@stevens.edu", "Password@123", "student", "2001-05-22", "Computer Science"
);
await usersCollection.updateOne({ email: "jsmith@stevens.edu" }, { $set: { accessStatus: "approved" } });

const pendingStudent3 = await userData.createUser(
  "Michael", "Johnson", "male", "mjohnson@stevens.edu", "Password@123", "student", "2003-11-08", "Computer Engineering"
);
await usersCollection.updateOne({ email: "mjohnson@stevens.edu" }, { $set: { accessStatus: "approved" } });

// Get student IDs
const student1 = await usersCollection.findOne({ email: "jdoe@stevens.edu" });
const student2 = await usersCollection.findOne({ email: "jsmith@stevens.edu" });
const student3 = await usersCollection.findOne({ email: "mjohnson@stevens.edu" });

// Add pending enrollment requests to both student and course documents
await usersCollection.updateOne(
  { _id: student1._id },
  { 
    $push: { 
      studentEnrollments: {
        courseId: new ObjectId(webDevCourseId),
        status: "pending",
        requestedAt: new Date()
      }
    } 
  }
);
await coursesCollection.updateOne(
  { _id: new ObjectId(webDevCourseId) },
  {
    $push: {
      studentEnrollments: {
        studentId: student1._id,
        status: "pending",
        requestedAt: new Date()
      }
    }
  }
);

await usersCollection.updateOne(
  { _id: student2._id },
  { $push: { studentEnrollments: { courseId: new ObjectId(webDevCourseId), status: "pending", requestedAt: new Date() } } }
);
await coursesCollection.updateOne(
  { _id: new ObjectId(webDevCourseId) },
  { $push: { studentEnrollments: { studentId: student2._id, status: "pending", requestedAt: new Date() } } }
);

await usersCollection.updateOne(
  { _id: student3._id },
  { $push: { studentEnrollments: { courseId: new ObjectId(webDevCourseId), status: "pending", requestedAt: new Date() } } }
);
await coursesCollection.updateOne(
  { _id: new ObjectId(webDevCourseId) },
  { $push: { studentEnrollments: { studentId: student3._id, status: "pending", requestedAt: new Date() } } }
);

await usersCollection.updateOne(
  { _id: student3._id },
  { $push: { studentEnrollments: { courseId: new ObjectId(dbCourseId), status: "pending", requestedAt: new Date() } } }
);
await coursesCollection.updateOne(
  { _id: new ObjectId(dbCourseId) },
  { $push: { studentEnrollments: { studentId: student3._id, status: "pending", requestedAt: new Date() } } }
);

console.log("Done seeding database with pending enrollment requests");
console.log("Done seeding database");  

await closeConnection();