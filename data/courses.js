import {ObjectId} from "mongodb";
import {stringValidate} from "../validation.js";
import {users, courses} from "../config/mongoCollections.js";

const createCourse = async (courseName, courseCode, professorId) => {
    courseName = stringValidate(courseName);
    courseCode = stringValidate(courseCode);
    professorId = stringValidate(professorId);
    if (!ObjectId.isValid(professorId)) throw "Invalid professor ID.";
    const coursesCollection = await courses();
    const existingCourse = await coursesCollection.findOne({
        courseCode: {$regex: `^${courseCode}$`, $options: "i"},
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
        studentEnrollments: [],
    };
    const insertInfo = await coursesCollection.insertOne(newCourse);
    if (!insertInfo.acknowledged) throw "Could not create course.";
    return {isCourseCreated: true};
};

const getAllCourses = async () => {
    const coursesCollection = await courses();
    const usersCollection = await users();

    const allCourses = await coursesCollection.find({}).toArray();

    for (const course of allCourses) {
        if (course.professorId) {
            const professor = await usersCollection.findOne({_id: new ObjectId(course.professorId)});
            if (professor) {
                course.professor = {
                    firstName: professor.firstName,
                    lastName: professor.lastName,
                };
            }
        }
    }

    return allCourses;
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
    return {course, professor};
};

const updateCourseProfessor = async (courseId, newProfessorId) => {
    courseId = stringValidate(courseId);
    newProfessorId = stringValidate(newProfessorId);
    if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";
    if (!ObjectId.isValid(newProfessorId)) throw "Invalid professor ID.";

    const coursesCollection = await courses();
    const updateInfo = await coursesCollection.updateOne(
        {_id: new ObjectId(courseId)},
        {$set: {professorId: new ObjectId(newProfessorId)}}
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

  const activeRequests = course.studentEnrollments?.filter(
    (req) => req.status === "active"
  ) || [];

  const studentIds = activeRequests.map((req) => new ObjectId(req.studentId));

  const enrolledStudents = await usersCollection.find({
    _id: { $in: studentIds },
    user_role: "student",
  }).toArray();

  return enrolledStudents;
};


const NumOfStudentsInCourse = async (courseId) => {
  const students = await getEnrolledStudents(courseId);
  return students.length;
};


const requestEnrollment = async (courseId, studentId) => {
    courseId = stringValidate(courseId);
    studentId = stringValidate(studentId);
    if (!ObjectId.isValid(courseId) || !ObjectId.isValid(studentId)) throw "Invalid IDs.";

    const coursesCollection = await courses();

    const course = await coursesCollection.findOne({_id: new ObjectId(courseId)});
    if (!course) throw "Course not found.";

    // Block if already active or pending
    const alreadyRequested = course.studentEnrollments?.some(
        (r) =>
            r.studentId.toString() === studentId &&
            (r.status === "pending" || r.status === "active")
    );
    if (alreadyRequested) throw "⚠️ You have already requested enrollment for this course.";

    // If the status is inactive, reactivate it
    const inactiveRequestIndex = course.studentEnrollments?.findIndex(
        (r) =>
            r.studentId.toString() === studentId &&
            r.status === "inactive"
    );

    if (inactiveRequestIndex !== -1) {
        const updateInfo = await coursesCollection.updateOne(
            {
                _id: new ObjectId(courseId),
                [`studentEnrollments.${inactiveRequestIndex}.studentId`]: new ObjectId(studentId),
            },
            {
                $set: {
                    [`studentEnrollments.${inactiveRequestIndex}.status`]: "pending",
                },
            }
        );

        if (updateInfo.modifiedCount === 0) throw "Failed to re-request enrollment.";
        return {enrollmentReRequested: true};
    }

    // New request
    const updateInfo = await coursesCollection.updateOne(
        {_id: new ObjectId(courseId)},
        {
            $push: {
                studentEnrollments: {
                    studentId: new ObjectId(studentId),
                    status: "pending",
                },
            },
        }
    );

    if (updateInfo.modifiedCount === 0) throw "Failed to request enrollment.";

    return {enrollmentRequested: true};
};


const getAllCoursesForStudent = async (studentId) => {
    const coursesCollection = await courses();
    const usersCollection = await users();

    const allCourses = await coursesCollection.find({}).toArray();

    for (const course of allCourses) {
        // attach professor info
        if (course.professorId) {
            const professor = await usersCollection.findOne({_id: new ObjectId(course.professorId)});
            if (professor) {
                course.professor = {
                    firstName: professor.firstName,
                    lastName: professor.lastName,
                };
            }
        }

        // active enrollment count
        course.activeCount = course.studentEnrollments?.filter(
            (r) => r.status === "active"
        ).length || 0;

        // max limit (not yet defined, so use placeholder for now)
        course.maxLimit = course.maxEnrollment || "N/A";

        course.isCourseFull =
            course.maxEnrollment && course.activeCount >= course.maxEnrollment;

        // whether this student has already applied
        course.alreadyApplied = course.studentEnrollments?.some(
            (r) =>
                r.studentId?.toString() === studentId &&
                (r.status === "pending" || r.status === "active")
        );

    }

    return allCourses;
};

const getStudentEnrolledCourses = async (studentId) => {
    studentId = stringValidate(studentId);
    if (!ObjectId.isValid(studentId)) throw "Invalid student ID.";

    const coursesCollection = await courses();
    const usersCollection = await users();

    const enrolledCourses = await coursesCollection
        .find({
            studentEnrollments: {
                $elemMatch: {
                    studentId: new ObjectId(studentId),
                    status: "active",
                },
            },
        })
        .toArray();

    for (const course of enrolledCourses) {
        if (course.professorId) {
            const professor = await usersCollection.findOne({_id: new ObjectId(course.professorId)});
            if (professor) {
                course.professor = {
                    firstName: professor.firstName,
                    lastName: professor.lastName,
                };
            }
        }
    }

    return enrolledCourses;
};

const updateCourseInfo = async(courseId, newName, newCode) => {
  if (!ObjectId.isValid(courseId)) throw "Invalid course ID";
  newName = stringValidate(newName);
  newCode = stringValidate(newCode);

  const courseCollection = await courses();
  const updateResult = await courseCollection.updateOne(
    { _id: new ObjectId(courseId) },
    { $set: { courseName: newName, courseCode: newCode } }
  );

  if (updateResult.modifiedCount === 0) throw "No changes made to course info.";
}

export default {
    createCourse,
    getAllCourses,
    getAllCoursesForStudent,
    getCourseById,
    updateCourseProfessor,
    deleteCourse,
    getEnrolledStudents,
    NumOfStudentsInCourse,
    requestEnrollment,
    getStudentEnrolledCourses,
    updateCourseInfo
};
