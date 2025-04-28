import { dbConnection, closeConnection } from "../config/mongoConnection.js";
import {userData} from "../data/index.js"
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

console.log("Done seeding database");

await closeConnection();