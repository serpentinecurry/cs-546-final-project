import { dbConnection, closeConnection } from "../config/mongoConnection.js";
import {userData, courseData} from "../data/index.js"
import { users } from "../config/mongoCollections.js";

const db = await dbConnection();
await db.dropDatabase();

const usersCollection = await users();

const user1 = await userData.createUser(
    "System", "Admin", "69", "other", "admin@scholorio.com", "Admin@911", "admin", "1990-01-01" 
)
await usersCollection.updateOne({ email: "admin@scholorio.com" }, { $set: { accessStatus: "approved" } });

const user2 = await userData.createUser(
    "Sairithik", "Komuravelly", "21", "male", "skomurav@stevens.edu", "Password@123", "student", "2003-06-18", "Computer Science"
)
await usersCollection.updateOne({ email: "skomurav@stevens.edu" }, { $set: { accessStatus: "approved" } })

const user3 = await userData.createUser(
    "Patrick", "Hill", "59", "male", "phill@stevens.edu", "Password@123", "professor", "2003-04-30"
)
await usersCollection.updateOne({ email: "phill@stevens.edu" }, { $set: { accessStatus: "approved" } });


const user4 = await userData.createUser(
    "Archiit", "Rajanala", "20", "male", "arajanal@stevens.edu", "Hash@123", "student", "2003-07-18", "Computer Science"
)

const professor = await usersCollection.findOne({ email: "phill@stevens.edu" });


const course1 = await courseData.createCourse(
    "CS-546", "Web Development", professor._id.toString()
)

const course2 = await courseData.createCourse(
    "CS-545", "Database Systems", professor._id.toString()
)




console.log("Done seeding database");

await closeConnection();