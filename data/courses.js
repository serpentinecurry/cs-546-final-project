import { courses, users } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import { stringValidate } from "../validation.js";

const createCourse = async (courseName, courseCode, professorId) => {
  courseName = stringValidate(courseName);
  courseCode = stringValidate(courseCode);
  professorId = stringValidate(professorId);
  if (!ObjectId.isValid(professorId)) throw "Invalid professor ID.";
  const coursesCollection = await courses();
  const existingCourse = await coursesCollection.findOne({
    courseCode: { $regex: `^${courseCode}$`, $options: "i" },
  });
  if (existingCourse)
    throw "Course code already exists. Please choose a different code.";
  const newCourse = {
    courseName,
    courseCode,
    professorId: new ObjectId(professorId),
    meetingDays: [],
    meetingTime: "",
    professorOfficeHours: [],
    taOfficeHours: [],
    studentEnrollmentRequests: [],
  };
  const insertInfo = await coursesCollection.insertOne(newCourse);
  if (!insertInfo.acknowledged) throw "Could not create course.";
  return { isCourseCreated: true };
};

const getAllCourses = async () => {
  const coursesCollection = await courses();
  return await coursesCollection.find({}).toArray();
};

const getCourseById = async (courseId) => {
  courseId = stringValidate(courseId);
  if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";

  const coursesCollection = await courses();
  const usersCollection = await users();
  const course = await coursesCollection.findOne({
    _id: new ObjectId(courseId),
  });
  const professor = await usersCollection.findOne({_id: course.professorId})
  if (!course) throw "Course not found.";
  return {course,professor};
};

const updateCourseProfessor = async (courseId, newProfessorId) => {
  courseId = stringValidate(courseId);
  newProfessorId = stringValidate(newProfessorId);
  if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";
  if (!ObjectId.isValid(newProfessorId)) throw "Invalid professor ID.";

  const coursesCollection = await courses();
  const updateInfo = await coursesCollection.updateOne(
    { _id: new ObjectId(courseId) },
    { $set: { professorId: new ObjectId(newProfessorId) } }
  );

  if (updateInfo.modifiedCount === 0) throw "Failed to update professor.";
};

const deleteCourse = async (courseId) => {
  courseId = stringValidate(courseId);
  if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";

  const coursesCollection = await courses();
  const deleteInfo = await coursesCollection.deleteOne({
    _id: new ObjectId(courseId),
  });

  if (deleteInfo.deletedCount === 0) throw "Failed to delete course.";
};





const getEnrolledStudents = async (courseId) => {
  courseId = stringValidate(courseId);
  if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";

  const coursesCollection = await courses();
  const usersCollection = await users();

  const course = await coursesCollection.findOne({ _id: new ObjectId(courseId) });
  if (!course) throw "Course not found.";

  const approvedRequests = course.studentEnrollmentRequests?.filter(
    (req) => req.status === "approved"
  ) || [];

  const studentIds = approvedRequests.map((req) => new ObjectId(req.studentId));

  const enrolledStudents = await usersCollection.find({
    rold: "student",
    enrolledCourses: new ObjectId(courseId),
  }).toArray();

  return enrolledStudents;
};

const NumOfStudentsInCourse = async (courseId) => {
  
  return this.getEntolledStudents(courseId).length
};


export default {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourseProfessor,
  deleteCourse,
  getEnrolledStudents,
  NumOfStudentsInCourse
};
