import { users } from "../config/mongoCollections.js";
import bcrypt from "bcrypt";
import {
  stringValidate,
  azAZLenValidate,
  validateEmail,
  passwordValidate,
  isValidDateString,
} from "../validation.js";
const SALT_ROUNDS = 10;

const createUser = async (
  firstName,
  lastName,
  age,
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
  age = parseInt(age);
  if (!Number.isInteger(age) || age <= 0)
    throw "Age must be a positive integer";
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
  };
  if (role === "student") {
    newUser.major = major;
    newUser.enrolledCourses = [];
    newUser.absenceRequests = [];
    newUser.lectureNotes = [];
  }
  if (role === "ta") {
    newUser.taForCourses = [];
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
  if (!user) throw "Either the emailId or password is invalid";
  if (user.accessStatus !== "approved")
    throw "Your account is not approved yet. Please wait for admin approval.";
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw "Either the emailId or password is invalid";
  const {
    firstName,
    lastName,
    age,
    gender,
    email: storedEmail,
    role,
    dateOfBirth,
    accessStatus,
    userCreatedAt,
  } = user;
  return {
    firstName,
    lastName,
    age,
    gender,
    email: storedEmail,
    role,
    dateOfBirth,
    accessStatus,
    userCreatedAt,
  };
};

export default { createUser, login };
