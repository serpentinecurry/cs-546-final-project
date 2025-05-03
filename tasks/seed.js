import { dbConnection, closeConnection } from "../config/mongoConnection.js";
import {userData, courseData} from "../data/index.js"
import  lectureData  from "../data/lectures.js";
import { users } from "../config/mongoCollections.js";

const db = await dbConnection();
await db.dropDatabase();

const usersCollection = await users();

const user1 = await userData.createUser(
    "System", "Admin", "other", "admin@scholorio.com", "Admin@911", "admin", "1990-01-01" 
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
    "Archiit", "Rajanala", "20", "male", "arajanal@stevens.edu", "Hash@123", "student", "2003-07-18", "Computer Science"
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



console.log("Done seeding database");  

await closeConnection();