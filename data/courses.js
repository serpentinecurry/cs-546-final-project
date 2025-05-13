import {ObjectId} from "mongodb";
import {
    stringValidate,
    isStartBeforeEnd,
    isValid24Hour,
} from "../validation.js";
import {users, courses} from "../config/mongoCollections.js";
import {addOfficeHourEvent, deleteOfficeHourEvent} from "../services/calendarSync.js";


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
        throw "Course Code already exists. Please enter a different Course Code.";
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
            const professor = await usersCollection.findOne({
                _id: new ObjectId(course.professorId),
            });
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
    if (!ObjectId.isValid(courseId)) throw "Invalid Course ID.";

    const coursesCollection = await courses();
    const usersCollection = await users();
    const course = await coursesCollection.findOne({
        _id: new ObjectId(courseId),
    });
    const professor = await usersCollection.findOne({_id: course.professorId});
    if (!course) throw "Course not found.";
    return {course, professor};
};

const updateCourseProfessor = async (courseId, newProfessorId) => {
    courseId = stringValidate(courseId);
    newProfessorId = stringValidate(newProfessorId);
    if (!ObjectId.isValid(courseId)) throw "Invalid Course ID.";
    if (!ObjectId.isValid(newProfessorId)) throw "Invalid Professor ID.";

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

    const course = await coursesCollection.findOne({
        _id: new ObjectId(courseId),
    });
    if (!course) throw "Course not found.";

    const activeRequests =
        course.studentEnrollments?.filter((req) => req.status === "active") || [];

    const studentIds = activeRequests.map((req) => new ObjectId(req.studentId));

    const enrolledStudents = await usersCollection
        .find({
            _id: {$in: studentIds},
            user_role: "student",
        })
        .toArray();

    return enrolledStudents;
};

const NumOfStudentsInCourse = async (courseId) => {
    const students = await getEnrolledStudents(courseId);
    return students.length;
};

const requestEnrollment = async (courseId, studentId) => {
    courseId = stringValidate(courseId);
    studentId = stringValidate(studentId);

    if (!ObjectId.isValid(courseId) || !ObjectId.isValid(studentId)) {
        throw "Invalid course or student ID.";
    }

    const coursesCollection = await courses();
    const targetCourse = await coursesCollection.findOne({
        _id: new ObjectId(courseId),
    });

    if (!targetCourse) throw "Course not found.";

    const studentActiveCourses = await coursesCollection
        .find({
            studentEnrollments: {
                $elemMatch: {
                    studentId: new ObjectId(studentId),
                    status: "active",
                },
            },
        })
        .toArray();

    for (const enrolledCourse of studentActiveCourses) {
        for (const enrolledDay of enrolledCourse.courseMeetingDays || []) {
            for (const enrolledTime of enrolledCourse.courseMeetingTime || []) {
                const enrolledStart = parseMilitaryTime(enrolledTime.startTime);
                const enrolledEnd = parseMilitaryTime(enrolledTime.endTime);

                for (const targetDay of targetCourse.courseMeetingDays || []) {
                    if (enrolledDay.day === targetDay.day) {
                        for (const targetTime of targetCourse.courseMeetingTime || []) {
                            const targetStart = parseMilitaryTime(targetTime.startTime);
                            const targetEnd = parseMilitaryTime(targetTime.endTime);

                            if (
                                timesOverlap(enrolledStart, enrolledEnd, targetStart, targetEnd)
                            ) {
                                throw `Schedule conflict: ${enrolledCourse.courseCode} - ${enrolledCourse.courseName} on ${enrolledDay.day} (${enrolledTime.startTime} – ${enrolledTime.endTime})`;
                            }
                        }
                    }
                }
            }
        }
    }

    const alreadyRequested = targetCourse.studentEnrollments?.some(
        (r) =>
            r.studentId.toString() === studentId &&
            (r.status === "pending" || r.status === "active")
    );

    if (alreadyRequested) {
        throw "⚠️ You have already requested enrollment for this course.";
    }

    const inactiveIndex = targetCourse.studentEnrollments?.findIndex(
        (r) => r.studentId.toString() === studentId && r.status === "inactive"
    );

    if (inactiveIndex !== -1) {
        const updateInfo = await coursesCollection.updateOne(
            {
                _id: new ObjectId(courseId),
                [`studentEnrollments.${inactiveIndex}.studentId`]: new ObjectId(
                    studentId
                ),
            },
            {
                $set: {
                    [`studentEnrollments.${inactiveIndex}.status`]: "pending",
                },
            }
        );

        if (updateInfo.modifiedCount === 0) {
            throw "Failed to re-request enrollment.";
        }

        return {enrollmentReRequested: true};
    }

    const updateInfo = await coursesCollection.updateOne(
        {_id: new ObjectId(courseId)},
        {
            $push: {
                studentEnrollments: {
                    studentId: new ObjectId(studentId),
                    status: "pending",
                    appliedAt: new Date(),
                },
            },
        }
    );

    if (updateInfo.modifiedCount === 0) {
        throw "Failed to request enrollment.";
    }

    return {enrollmentRequested: true};
};

// ⏰ Converts "HH:mm" to minutes from midnight
function parseMilitaryTime(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
}

// 📆 Checks if time intervals overlap
function timesOverlap(start1, end1, start2, end2) {
    return Math.max(start1, start2) < Math.min(end1, end2);
}

const getAllCoursesForStudent = async (studentId) => {
    const coursesCollection = await courses();
    const usersCollection = await users();

    const allCourses = await coursesCollection.find({}).toArray();

    for (const course of allCourses) {
        // attach professor info
        if (course.professorId) {
            const professor = await usersCollection.findOne({
                _id: new ObjectId(course.professorId),
            });
            if (professor) {
                course.professor = {
                    firstName: professor.firstName,
                    lastName: professor.lastName,
                };
            }
        }

        course.activeCount =
            course.studentEnrollments?.filter((r) => r.status === "active").length ||
            0;

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
            const professor = await usersCollection.findOne({
                _id: new ObjectId(course.professorId),
            });
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

const updateCourseInfo = async (courseId, newName, newCode) => {
    if (!ObjectId.isValid(courseId)) throw "Invalid course ID";
    newName = stringValidate(newName);
    newCode = stringValidate(newCode);

    const courseCollection = await courses();
    const updateResult = await courseCollection.updateOne(
        {_id: new ObjectId(courseId)},
        {$set: {courseName: newName, courseCode: newCode}}
    );

    if (updateResult.modifiedCount === 0) throw "No changes made to course info.";
};

const addProfessorOfficeHour = async (courseId, officeHourObj) => {
    courseId = stringValidate(courseId);
    if (typeof officeHourObj !== "object") throw "Missing or invalid inputs.";
    let {day, startTime, endTime, location, notes} = officeHourObj;

    let validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    if (!validDays.includes(day))
        throw "Invalid day. Must be a valid Weekday (Monday - Friday) !";

    if (!isValid24Hour(startTime) || !isValid24Hour(endTime))
        throw "Invalid time format. Must be HH:MM (24-hour format).";

    if (!isStartBeforeEnd(startTime, endTime))
        throw "Start time must be earlier than the End time.";

    location = stringValidate(location);
    const courseCollection = await courses();

    const currentCourse = await courseCollection.findOne({
        _id: new ObjectId(courseId),
    });
    if (!currentCourse) throw "Course not found.";
    const professorId = currentCourse.professorId;

    const allCourses = await courseCollection
        .find({professorId: professorId})
        .toArray();

    const allOfficeHoursSameDay = [];

    for (const course of allCourses) {
        for (const oh of course.professorOfficeHours || []) {
            if (oh.day === day) {
                allOfficeHoursSameDay.push({
                    startTime: oh.startTime,
                    endTime: oh.endTime,
                    courseId: course._id,
                });
            }
        }
    }

    const timesOverlap = (startA, endA, startB, endB) => {
        return startA < endB && startB < endA;
    };

    for (const oh of allOfficeHoursSameDay) {
        if (timesOverlap(startTime, endTime, oh.startTime, oh.endTime)) {
            throw `Time conflicts with existing office hours from ${oh.startTime} to ${oh.endTime} on ${day}`;
        }
    }

    const usersCollection = await users();
    const professor = await usersCollection.findOne({_id: professorId});
    if (!professor) throw "Professor not found for calendar sync.";

    const name = `${professor.firstName} ${professor.lastName}`;
    const calendarEventIds = {};

    for (const calendarType of ["students", "tas", "professors"]) {
        const result = await addOfficeHourEvent({
            name,
            day,
            startTime,
            endTime,
            location,
            calendarType,
        });
        if (result?.eventId) {
            calendarEventIds[calendarType] = result.eventId; // ✅ store just the ID
        }
    }

    const updateResult = await courseCollection.updateOne(
        {_id: new ObjectId(courseId)},
        {
            $push: {
                professorOfficeHours: {
                    day,
                    startTime,
                    endTime,
                    location: location.trim(),
                    notes: notes?.toString().trim() || "",
                    calendarEventIds
                },
            },
        }
    );

    if (updateResult.modifiedCount === 0)
        throw "Failed to add office hour. Course may not exist.";

    return {added: true};
};


const deleteProfessorOfficeHour = async (courseId, officeHourObj) => {
    if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";

    const {day, startTime, endTime} = officeHourObj;
    if (!day || !startTime || !endTime) throw "Missing office hour Information.";

    const courseCollection = await courses();
    const course = await courseCollection.findOne({_id: new ObjectId(courseId)});
    if (!course) throw "Course not found.";

    const officeHour = course.professorOfficeHours.find(
        (oh) => oh.day === day && oh.startTime === startTime && oh.endTime === endTime
    );

    if (!officeHour) throw "Office Hour Not Found.";

    if (officeHour.calendarEventIds) {
        for (const [calendarType, eventId] of Object.entries(officeHour.calendarEventIds)) {
            if (eventId) {
                await deleteOfficeHourEvent(calendarType, eventId);
            }
        }
    }

    const updateResult = await courseCollection.updateOne(
        {_id: new ObjectId(courseId)},
        {
            $pull: {
                professorOfficeHours: {
                    day,
                    startTime,
                    endTime,
                },
            },
        }
    );

    if (updateResult.modifiedCount === 0) throw "Failed to delete office hour.";

    return {deleted: true};
};

const getStudentsNoTAs = async (courseId) => {
    courseId = stringValidate(courseId);
    if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";

    const coursesCollection = await courses();
    const usersCollection = await users();

    const course = await coursesCollection.findOne({
        _id: new ObjectId(courseId),
    });
    if (!course) throw "Course not found.";


    const activeEnrollments = course.studentEnrollments.filter(
        enrollment => enrollment.status === "active"
    );


    const studentIds = activeEnrollments.map(
        enrollment => enrollment.studentId
    );


    const enrolledUsers = await usersCollection
        .find({
            _id: {$in: studentIds}
        })
        .toArray();


    const nonTAUsers = enrolledUsers.filter(user => {

        const isTAForThisCourse =
            user.role === "ta" &&
            user.taForCourses &&
            user.taForCourses.some(cid => cid.toString() === courseId);


        const enrollment = course.studentEnrollments.find(
            e => e.studentId.toString() === user._id.toString()
        );
        const hasTARole = enrollment && enrollment.role === "TA";


        return !isTAForThisCourse && !hasTARole;
    });

    return nonTAUsers;
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
    updateCourseInfo,
    addProfessorOfficeHour,
    deleteProfessorOfficeHour,
    getStudentsNoTAs
};
