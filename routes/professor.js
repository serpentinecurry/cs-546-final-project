import { Router } from "express";
import { ObjectId } from "mongodb";
import userData from "../data/users.js";
import courseData from "../data/courses.js";
import attendanceData from "../data/attendance.js";
import lectureData from "../data/lectures.js";
import discussionsData from "../data/discussions.js";
import { createFeedbackSurvey } from "../data/feedback.js";
import {
  attendance,
  courses,
  feedback,
  lectures,
  users,
  discussions,
} from "../config/mongoCollections.js";
import dayjs from "dayjs";
import { stringValidate } from "../validation.js";
import { verifyProfessorOwnsCourse } from "../middleware.js";
import { sendAbsentNotificationEmail } from "../utils/mailer.js";
import {
  subscribeLinks,
  syncAllOfficeHoursForCourse,
} from "../services/calendarSync.js";
import xss from "xss";

const router = Router();

function dayMap(short) {
  const map = {
    M: "Monday",
    T: "Tuesday",
    W: "Wednesday",
    Th: "Thursday",
    F: "Friday",
  };
  return map[short] || short;
}

router.route("/").get(async (req, res) => {
  if (!req.session.user || req.session.user.role !== "professor") {
    return res.status(403).render("error", {
      error: "You must be logged in as professor to see this.",
      title: "Unauthorized Access",
    });
  }

  try {
    const userCollection = await users();
    const professor = await userCollection.findOne({
      _id: new ObjectId(req.session.user._id),
    });

    if (!professor) {
      return res.status(404).render("error", {
        layout: "main",
        error: "Professor not found in the database.",
      });
    }

    const courseCollection = await courses();
    const professorsCourses = await courseCollection
      .find({
        professorId: new ObjectId(req.session.user._id),
      })
      .toArray();

    res.render("professorDashboard/professorDashboard", {
      layout: "main",
      professorName: `${professor.firstName} ${professor.lastName}`,
      courses: professorsCourses,
      title: "Professor Dashboard",
    });
  } catch (error) {
    res.status(500).render("error", {
      layout: "main",
      error: "Internal server error while fetching professor data.",
    });
  }
});

router.route("/course/:id").get(verifyProfessorOwnsCourse, async (req, res) => {
  try {
    return res.redirect(`/professor/course/${req.params.id}/analytics`);
  } catch (error) {
    console.error("Error displaying course:", error);
    return res.status(500).render("error", {
      layout: "main",
      error: "Internal server error while loading course details.",
    });
  }
});

router
  .route("/course/:id/analytics")
  .get(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const courseId = req.params.id;

      const courseCollection = await courses();
      const course = await courseCollection.findOne({
        _id: new ObjectId(courseId),
      });

      if (!course) {
        return res.status(404).render("error", {
          layout: "main",
          error: "Course not found in the database.",
        });
      }

      course._id = course._id.toString();

      let absenceRequests = [];
      try {
        const userCollection = await users();

        const studentsWithRequests = await userCollection
          .find({
            absenceRequests: {
              $elemMatch: {
                courseId: courseId,
              },
            },
          })
          .toArray();

        for (const student of studentsWithRequests) {
          if (Array.isArray(student.absenceRequests)) {
            const courseRequests = student.absenceRequests
              .filter((req) => req.courseId === courseId)
              .map((req, index) => ({
                studentName: `${student.firstName} ${student.lastName}`,
                studentId: student._id.toString(),
                reason: req.reason || "No reason provided",
                proofType: req.proofType || "None",
                proofLink: req.proofDocumentLink || "",
                status: req.status || "pending",
                requestedAt: req.requestedAt || new Date(),
                reviewedAt: req.reviewedAt || null,
                requestIndex: index,
              }));

            absenceRequests.push(...courseRequests);
          }
        }
      } catch (e) {
        console.error("Error fetching absence requests:", e);
      }

      const lecturesCollection = await lectures();
      const courseLectures = await lecturesCollection
        .find({
          courseId: new ObjectId(courseId),
        })
        .toArray();

      for (let lecture of courseLectures) {
        try {
          lecture.averageRating = await lectureData.getAverageRating(
            lecture._id
          );
        } catch (e) {
          lecture.averageRating = "0.00";
        }
      }

      let pendingStudents = [];
      try {
        pendingStudents = await userData.getPendingEnrollmentRequests(courseId);
        pendingStudents = pendingStudents.map((student) => ({
          ...student,
          _id: student._id.toString(),
        }));
      } catch (e) {
        console.error("Error getting pending enrollment requests:", e);
      }

      let enrolledStudents = [];
      let enrolledStudentsCount = 0;

      try {
        const courseCollection = await courses();
        const course = await courseCollection.findOne({
          _id: new ObjectId(courseId),
        });

        const activeEnrollments = course.studentEnrollments
          ? course.studentEnrollments.filter(
              (enrollment) => enrollment.status === "active"
            )
          : [];

        const activeStudentIds = activeEnrollments.map(
          (enrollment) => new ObjectId(enrollment.studentId)
        );

        if (activeStudentIds.length > 0) {
          const usersCollection = await users();
          const studentsData = await usersCollection
            .find({
              _id: { $in: activeStudentIds },
            })
            .toArray();

          for (const student of studentsData) {
            const totalAbsences =
              await attendanceData.getTotalAbsencesFromStudent(
                student._id.toString()
              );
            enrolledStudents.push({
              ...student,
              _id: student._id.toString(),
              totalAbsences,
            });
          }
        }

        enrolledStudentsCount = enrolledStudents.length;
      } catch (e) {
        console.error("Error getting enrolled students:", e);
      }

      const scheduleMap = {};
      if (
        course.courseMeetingDays &&
        course.courseMeetingTime &&
        course.courseMeetingDays.length === course.courseMeetingTime.length
      ) {
        for (let i = 0; i < course.courseMeetingDays.length; i++) {
          const day = course.courseMeetingDays[i].day;
          const time = course.courseMeetingTime[i];
          scheduleMap[day] = {
            startTime: time.startTime,
            endTime: time.endTime,
          };
        }
      }

      const averageAttendance = await attendanceData.averageAttendance(
        courseId
      );

      let totalPresent = 0;
      let totalAbsent = 0;
      let totalExcused = 0;

      try {
        const absentStudents = await attendanceData.getAllAbsentStudents(
          courseId
        );
        const presentStudents = await attendanceData.getAllPresentStudents(
          courseId
        );
        const excusedStudents = await attendanceData.getAllExcusedStudents(
          courseId
        );

        totalPresent = presentStudents.length;
        totalAbsent = absentStudents.length;
        totalExcused = excusedStudents.length;

        const hasAttendanceData =
          totalPresent > 0 || totalAbsent > 0 || totalExcused > 0;

        const feedbackCollection = await feedback();
        const existingSurvey = await feedbackCollection.findOne({
          courseId: new ObjectId(courseId),
        });

        const studentFeedbackResponses = existingSurvey?.studentResponses || [];

        const successMessage = req.session.successMessage || null;
        req.session.successMessage = null;

        res.render("professorDashboard/DataAnalyticsView", {
          layout: "main",
          course: course,
          lectures: courseLectures,
          pendingStudents: pendingStudents || [],
          totalStudents: enrolledStudentsCount,
          totalLectures: courseLectures.length,
          averageAttendance: averageAttendance,
          enrolledStudents: enrolledStudents || [],
          absenceRequests: absenceRequests,
          successMessage,
          totalPresent: totalPresent || 0,
          totalAbsent: totalAbsent || 0,
          totalExcused: totalExcused || 0,
          hasAttendanceData,
          scheduleMap,
          weekdays: ["M", "T", "W", "Th", "F"],
          surveyExists: !!existingSurvey,
          feedbackResponses: studentFeedbackResponses,
        });
      } catch (e) {
        console.error("Error fetching attendance data:", e);
      }
    } catch (error) {
      console.error("Error in course analytics:", error);
      res.status(500).render("error", {
        layout: "main",
        error:
          "Internal server error while loading course analytics: " +
          error.message,
      });
    }
  });

router.post("/course/:courseId/feedback/create", async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const professorId = req.session.user._id;

    await createFeedbackSurvey(courseId, professorId);

    req.session.successMessage =
      "Course survey created and sent out to students!";

    req.session.save(() => {
      res.redirect(`/professor/course/${courseId}/analytics`);
    });
  } catch (e) {
    console.error(e);
    return res.status(500).render("error", {
      error: "Could not create survey. It may already exist.",
    });
  }
});

router.post(
  "/course/:courseId/set-schedule",
  verifyProfessorOwnsCourse,
  async (req, res) => {
    const { courseId } = req.params;
    const { schedule } = req.body;

    if (!schedule || typeof schedule !== "object") {
      return res.status(400).json({ error: "Invalid schedule data" });
    }

    try {
      const meetingDays = [];
      const meetingTimes = [];

      for (const shortDay in schedule) {
        const { startTime, endTime } = schedule[shortDay];

        if (!startTime || !endTime) {
          return res.status(400).json({
            error: `Missing start or end time for ${dayMap(shortDay)}`,
          });
        }

        if (
          !/^\d{2}:\d{2}$/.test(startTime) ||
          !/^\d{2}:\d{2}$/.test(endTime)
        ) {
          return res.status(400).json({
            error: `Invalid time format for ${dayMap(
              shortDay
            )}. Use HH:MM (24-hour).`,
          });
        }

        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;

        if (endMinutes <= startMinutes) {
          return res.status(400).json({
            error: `End time must be after start time for ${dayMap(shortDay)}.`,
          });
        }

        meetingDays.push({ day: dayMap(shortDay) });
        meetingTimes.push({ startTime, endTime });
      }

      const courseCollection = await courses();
      await courseCollection.updateOne(
        { _id: new ObjectId(courseId) },
        {
          $set: {
            courseMeetingDays: meetingDays,
            courseMeetingTime: meetingTimes,
          },
        }
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Error validating or updating schedule:", err);
      res
        .status(500)
        .json({ error: "Internal server error while saving schedule" });
    }
  }
);

router
  .route("/course/:courseId/view-office-hours")
  .get(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      let { courseId } = req.params;
      courseId = stringValidate(courseId);
      if (!ObjectId.isValid(courseId)) throw "Invalid course Id";

      const courseCollection = await courses();
      const course = await courseCollection.findOne({
        _id: new ObjectId(courseId),
      });
      if (!course) throw "Course not found!";

      const userCollection = await users();
      const taOfficeHoursRaw = course.taOfficeHours || [];
      const taOfficeHours = [];

      for (let taHour of taOfficeHoursRaw) {
        const taUser = await userCollection.findOne({ _id: taHour.taId });
        taOfficeHours.push({
          ...taHour,
          taName: taUser
            ? `${taUser.firstName} ${taUser.lastName}`
            : "Unknown TA",
        });
      }

      const professorOfficeHours = course.professorOfficeHours || [];

      const weekdayToIndex = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      };

      const events = [];

      for (const slot of professorOfficeHours) {
        const dayIndex = weekdayToIndex[slot.day];
        if (dayIndex === undefined) continue;

        events.push({
          title: `Prof Office Hour (${slot.location})`,
          daysOfWeek: [dayIndex],
          startTime: slot.startTime,
          endTime: slot.endTime,
          description: slot.notes || "",
          backgroundColor: "#0d6efd",
          borderColor: "#0d6efd",
        });
      }

      for (const slot of taOfficeHours) {
        const dayIndex = weekdayToIndex[slot.day];
        if (dayIndex === undefined) continue;

        events.push({
          title: `TA ${slot.taName} (${slot.location})`,
          daysOfWeek: [dayIndex],
          startTime: slot.startTime,
          endTime: slot.endTime,
          description: slot.notes || "",
          backgroundColor: "#198754",
          borderColor: "#198754",
        });
      }

      let calendarSubscribeUrl = subscribeLinks.students;
      const role = req.session.user.role;
      if (role === "ta") calendarSubscribeUrl = subscribeLinks.tas;
      if (role === "professor")
        calendarSubscribeUrl = subscribeLinks.professors;

      return res.render("professorDashboard/viewOfficeHours", {
        layout: "main",
        courseId: course._id.toString(),
        professorOfficeHours,
        taOfficeHours,
        calendarSubscribeUrl,
        events: events,
      });
    } catch (e) {
      return res.status(500).render("error", {
        error:
          typeof e === "string"
            ? e
            : e.message || "Failed to load office hours.",
      });
    }
  });

router.post(
  "/course/:courseId/delete-office-hour",
  verifyProfessorOwnsCourse,
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { day, startTime, endTime } = req.body;

      await courseData.deleteProfessorOfficeHour(courseId, {
        day: xss(day),
        startTime: xss(startTime),
        endTime: xss(endTime),
      });

      return res.redirect(`/professor/course/${courseId}/view-office-hours`);
    } catch (e) {
      return res.status(400).render("error", {
        error:
          typeof e === "string"
            ? e
            : e.message || "Failed to delete office hour.",
      });
    }
  }
);

router
  .route("/course/:courseId/add-office-hour")
  .get(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      let courseId = req.params.courseId;
      courseId = stringValidate(courseId);
      if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";
      return res.render("professorDashboard/addOfficeHour", {
        courseId,
        layout: "main",
        error: null,
      });
    } catch (error) {
      return res.status(400).render("error", {
        error:
          typeof error === "string"
            ? error
            : error.message || "Error loading office hour form.",
      });
    }
  })
  .post(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      let courseId = req.params.courseId;
      courseId = stringValidate(courseId);
      if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";
      let { day, startTime, endTime, location, notes } = req.body;
      await courseData.addProfessorOfficeHour(courseId, {
        day,
        startTime,
        endTime,
        location,
        notes,
      });

      await syncAllOfficeHoursForCourse(courseId);
      return res.redirect(`/professor/course/${courseId}/view-office-hours`);
    } catch (error) {
      return res.status(400).render("professorDashboard/addOfficeHour", {
        courseId: req.params.courseId,
        layout: "main",
        error:
          typeof error === "string"
            ? error
            : error.message || "Error submitting office hour.",
      });
    }
  });

router
  .route("/course/:id/analytics/manage-tas")
  .get(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const courseId = req.params.id;
      const courseCollection = await courses();
      const course = await courseCollection.findOne({
        _id: new ObjectId(courseId),
      });

      if (!course) throw "Course not found";

      const studentIds = (course.studentEnrollments || [])
        .filter((e) => e.status === "active")
        .map((e) => new ObjectId(e.studentId));

      const usersCollection = await users();
      const students = await usersCollection
        .find({ _id: { $in: studentIds } })
        .toArray();
      students.forEach((student) => {
        student.isTAForThisCourse = (student.taForCourses || []).some(
          (cid) => cid.toString() === course._id.toString()
        );
      });

      return res.render("professorDashboard/manageTAs", {
        layout: "main",
        course,
        students,
      });
    } catch (error) {
      console.error("Error loading TA management:", error);
      res.status(500).render("error", {
        layout: "main",
        error: error.message || "Error loading TA management page.",
      });
    }
  });

router
  .route("/course/:courseId/analytics/manage-tas/promote/:studentId")
  .post(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const { studentId, courseId } = req.params;

      const usersCollection = await users();
      const student = await usersCollection.findOne({
        _id: new ObjectId(studentId),
      });

      if (!student) throw "User not found";

      const updates = {
        $addToSet: { taForCourses: new ObjectId(courseId) },
      };

      if (student.role === "student") {
        updates.$set = { role: "ta" };
      }

      await usersCollection.updateOne(
        { _id: new ObjectId(studentId) },
        updates
      );

      req.session.successMessage = "Student promoted to TA successfully!";
      return res.redirect(`/professor/course/${courseId}/analytics/manage-tas`);
    } catch (error) {
      console.error("Promotion error:", error);
      res.status(400).render("error", {
        layout: "main",
        error: error.message || error,
      });
    }
  });

router.post(
  "/course/:courseId/analytics/manage-tas/demote/:studentId",
  verifyProfessorOwnsCourse,
  async (req, res) => {
    try {
      const { courseId, studentId } = req.params;

      const usersCollection = await users();
      const courseCollection = await courses();
      const user = await usersCollection.findOne({
        _id: new ObjectId(studentId),
      });
      if (!user) throw "User not found";

      await usersCollection.updateOne(
        { _id: new ObjectId(studentId) },
        {
          $pull: { taForCourses: new ObjectId(courseId) },
        }
      );

      await courseCollection.updateOne(
        { _id: new ObjectId(courseId) },
        { $pull: { taOfficeHours: { taId: new ObjectId(studentId) } } }
      );

      await syncAllOfficeHoursForCourse(courseId);

      const updated = await usersCollection.findOne({
        _id: new ObjectId(studentId),
      });
      if (!updated.taForCourses || updated.taForCourses.length === 0) {
        await usersCollection.updateOne(
          { _id: new ObjectId(studentId) },
          { $set: { role: "student" } }
        );
      }

      req.session.successMessage = "TA successfully demoted to student.";
      return res.redirect(`/professor/course/${courseId}/analytics/manage-tas`);
    } catch (error) {
      console.error("Demotion error:", error);
      res.status(400).render("error", {
        layout: "main",
        error: error.message || error,
      });
    }
  }
);

router.route("/lectures/analytics/:id").get(async (req, res) => {
  try {
    const lecturesCollection = await lectures();
    const lecture = await lecturesCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!lecture) {
      return res.status(404).render("error", {
        layout: "main",
        error: "Lecture not found in the database.",
      });
    }
  } catch (error) {
    console.error("Error fetching lecture:", error);
    return res.status(500).render("error", {
      layout: "main",
      error: "Internal server error while fetching lecture data.",
    });
  }

  const lecturesCollection = await lectures();
  const lecture = await lecturesCollection.findOne({
    _id: new ObjectId(req.params.id),
  });

  if (!lecture) {
    return res.status(404).render("error", {
      layout: "main",
      error: "Lecture not found in the database.",
    });
  }

  res.render("professor/lectureAnalytics", {
    layout: "main",
    lecture: lecture,
  });
});

router.get("/dashboard/:courseId", async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const course = await courseData.getCourseById(courseId);
    const pendingStudents = await userData.getPendingEnrollmentRequests(
      courseId
    );

    res.render("professorDashboard/courseView", {
      layout: "main",
      courseId: course._id.toString(),
      courseName: course.courseName,
      courseCode: course.courseCode,
      pendingStudents: pendingStudents,
    });
  } catch (error) {
    console.error("Error loading course dashboard:", error);
    res.status(400).render("error", {
      layout: "main",
      error:
        typeof error === "string"
          ? error
          : error.message || "Error loading course dashboard.",
    });
  }
});

router.post("/enrollment/reject", async (req, res) => {
  try {
    const studentId = stringValidate(req.body.studentId);
    const courseId = stringValidate(req.body.courseId);

    await userData.rejectEnrollmentRequest(studentId, courseId);

    req.session.successMessage = "Enrollment request rejected successfully";
    res.redirect(`/professor/course/${courseId}/analytics`);
  } catch (error) {
    console.error("Error rejecting enrollment:", error);
    res.status(400).render("error", {
      layout: "main",
      error:
        typeof error === "string"
          ? error
          : error.message || "Error rejecting enrollment request.",
    });
  }
});

router.post("/enrollment/approve", async (req, res) => {
  try {
    const studentId = stringValidate(req.body.studentId);
    const courseId = stringValidate(req.body.courseId);

    await userData.approveEnrollmentRequest(studentId, courseId);

    req.session.successMessage = "Enrollment request approved successfully";
    res.redirect(`/professor/course/${courseId}/analytics`);
  } catch (error) {
    console.error("Error approving enrollment:", error);
    res.status(400).render("error", {
      layout: "main",
      error:
        typeof error === "string"
          ? error
          : error.message || "Error approving enrollment request.",
    });
  }
});

router
  .route("/course/:courseId/lecture/create")
  .get(async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const course = await courseData.getCourseById(courseId);

      res.render("professorDashboard/createLecture", {
        courseId: courseId,
        courseName: course.courseName,
        courseCode: course.courseCode,
      });
    } catch (error) {
      res.status(400).render("error", {
        error: error.message || "Error loading form",
      });
    }
  })
  .post(async (req, res) => {
    let lectureTitle,
      lectureDate,
      lectureStartTime,
      lectureEndTime,
      description,
      materialsLink;

    const courseId = req.params.courseId;
    let course;
    try {
      course = await courseData.getCourseById(courseId);

      const professorId = req.session.user._id;
      lectureTitle = xss(req.body.lectureTitle);
      lectureDate = xss(req.body.lectureDate);
      lectureStartTime = xss(req.body.lectureStartTime);
      lectureEndTime = xss(req.body.lectureEndTime);
      description = xss(req.body.description);
      materialsLink = xss(req.body.materialsLink);

      await lectureData.createLecture(
        courseId,
        lectureTitle,
        lectureDate,
        lectureStartTime,
        lectureEndTime,
        description,
        materialsLink
      );

      req.session.successMessage = "Lecture created successfully!";
      res.redirect(`/professor/course/${courseId}/analytics`);
    } catch (error) {
      res.status(400).render("professorDashboard/createLecture", {
        courseId,
        courseName: course?.courseName || "Unknown Course",
        courseCode: course?.courseCode || "",
        error: error.message || error || "Error creating lecture",
        formData: {
          lectureTitle,
          lectureDate,
          lectureStartTime,
          lectureEndTime,
          description,
          materialsLink,
        },
      });
    }
  });

router
  .route("/course/:courseId/lecture/:lectureId/edit")
  .get(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const { courseId, lectureId } = req.params;

      const courseCollection = await courses();
      const course = await courseCollection.findOne({
        _id: new ObjectId(courseId),
      });

      if (!course) {
        return res.status(404).render("error", {
          layout: "main",
          error: "Course not found",
        });
      }

      course._id = course._id.toString();

      const lecture = await lectureData.getLectureById(lectureId);

      res.render("professorDashboard/editLecture", {
        layout: "main",
        lecture: lecture,
        course: course,
      });
    } catch (error) {
      console.error("Error loading lecture edit form:", error);
      res.status(400).render("error", {
        layout: "main",
        error: "Error loading lecture edit form: " + error.message,
      });
    }
  })
  .post(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const { courseId, lectureId } = req.params;
      const {
        lectureTitle,
        lectureDate,
        lectureStartTime,
        lectureEndTime,
        lectureDescription,
        lectureMaterials,
      } = req.body;

      const updates = {
        lectureTitle: xss(lectureTitle),
        lectureDate: xss(lectureDate),
        lectureStartTime: xss(lectureStartTime),
        lectureEndTime: xss(lectureEndTime),
        description: xss(lectureDescription),
        materialsLink: xss(lectureMaterials),
      };

      await lectureData.updateLecture(lectureId, updates);

      req.session.successMessage = "Lecture updated successfully!";
      res.redirect(`/professor/course/${courseId}/analytics`);
    } catch (error) {
      console.error("Error updating lecture:", error);
      res.status(400).render("error", {
        layout: "main",
        error: "Error updating lecture: " + error,
      });
    }
  });

router
  .route("/course/:courseId/lecture/:lectureId")
  .get(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const { courseId, lectureId } = req.params;
      const lecturesCollection = await lectures();
      const lecture = await lectureData.getLectureById(lectureId);
      if (!lecture) {
        return res.status(404).render("error", {
          layout: "main",
          error: "Lecture not found in the database.",
        });
      }

      const { course } = await courseData.getCourseById(courseId);
      if (!course) {
        return res.status(404).render("error", {
          layout: "main",
          error: "Course not found in the database.",
        });
      }

      const students = await courseData.getStudentsNoTAs(courseId);

      students.forEach((s) => {
        s._id = s._id.toString();
      });

      let attendanceMap = {};
      try {
        const attendanceCollection = await attendance();
        const attendanceRecords = await attendanceCollection
          .find({
            lectureId: new ObjectId(lectureId),
          })
          .toArray();

        for (const record of attendanceRecords) {
          attendanceMap[record.studentId.toString()] = record.status;
        }
      } catch (e) {
        console.error("Error fetching attendance records:", e);
      }

      const studentAttendanceHistory = students.map((student) => ({
        ...student,
        attendanceStatus: attendanceMap[student._id] || "",
      }));

      let startDateTime = dayjs(
        `${lecture.lectureDate}T${lecture.lectureStartTime}`
      );
      let endDateTime = dayjs(
        `${lecture.lectureDate}T${lecture.lectureEndTime}`
      );
      if (endDateTime.isBefore(startDateTime)) {
        endDateTime = endDateTime.add(1, "day");
      }

      const averageRating = await lectureData.getAverageRating(lectureId);
      const ratingCount = lecture.ratings ? lecture.ratings.length : 0;

      const lecturePresentStudents =
        await attendanceData.getLecturePresentStudents(lectureId);
      const lectureAbsentStudents =
        await attendanceData.getLectureAbsentStudents(lectureId);
      const lectureExcusedStudents =
        await attendanceData.getLectureExcusedStudents(lectureId);

      const lecturePresentCount = lecturePresentStudents.length;
      const lectureAbsentCount = lectureAbsentStudents.length;
      const lectureExcusedCount = lectureExcusedStudents.length;

      const lectureHasAttendanceData =
        lecturePresentCount > 0 ||
        lectureAbsentCount > 0 ||
        lectureExcusedCount > 0;

      let hasDiscussion = false;
      let discussionId = null;
      try {
        const discussionsCollection = await discussions();
        const existingDiscussion = await discussionsCollection.findOne({
          lectureId: new ObjectId(lectureId),
          courseId: new ObjectId(courseId),
        });

        if (existingDiscussion) {
          hasDiscussion = true;
          discussionId = existingDiscussion._id.toString();
        }
      } catch (err) {
        console.error("Error checking for discussion:", err);
      }

      res.render("professorDashboard/LectureViews", {
        layout: "main",
        lecture,
        course,
        students: studentAttendanceHistory,
        lectureStartTime: startDateTime.format("h:mm A"),
        lectureEndTime: endDateTime.format("h:mm A"),
        averageRating,
        ratingCount,
        lecturePresentCount,
        lectureAbsentCount,
        lectureExcusedCount,
        hasAttendanceData: lectureHasAttendanceData,
        discussionViewPath: `/professor/course/${courseId}/lecture/${lectureId}/discussions/${discussionId}`,
        hasDiscussion,
      });
    } catch (error) {
      console.error("Error loading lecture view:", error);
      res.status(400).render("error", {
        layout: "main",
        error: "Error loading lecture view: " + error.message,
      });
    }
  });

router
  .route("/course/:courseId/lecture/:lectureId/attendance")
  .post(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const { courseId, lectureId } = req.params;

      const attendanceFormData = req.body.attendanceData;

      if (!attendanceFormData) {
        return res.status(400).render("error", {
          layout: "main",
          error: "Some attendance data missing.",
        });
      }

      for (const [studentId, status] of Object.entries(attendanceFormData)) {
        if (!ObjectId.isValid(studentId)) throw "Invalid student ID";

        const safeStatus = xss(status.trim().toLowerCase());
        if (!["present", "absent", "excused"].includes(safeStatus))
          throw "Invalid status";
        const attendanceCollection = await attendance();
        const prevRecord = await attendanceCollection.findOne({
          lectureId: new ObjectId(lectureId),
          studentId: new ObjectId(studentId),
        });

        const wasAlreadyAbsent = prevRecord && prevRecord.status === "absent";

        await attendanceData.createAttendance(
          lectureId,
          courseId,
          studentId,
          safeStatus
        );

        if (status === "absent" && !wasAlreadyAbsent) {
          const userCollection = await users();
          const student = await userCollection.findOne({
            _id: new ObjectId(studentId),
          });

          const courseCollection = await courses();
          const course = await courseCollection.findOne({
            _id: new ObjectId(courseId),
          });
          const lecturesCollection = await lectures();
          const lecture = await lecturesCollection.findOne({
            _id: new ObjectId(lectureId),
          });

          if (student && student.email && course && lecture) {
            await sendAbsentNotificationEmail(
              student.email,
              student.firstName,
              course.courseName,
              lecture.lectureTitle
            );
          }
        }
      }

      req.session.successMessage = "Attendance submitted successfully!";
      res.redirect(`/professor/course/${courseId}/lecture/${lectureId}`);
    } catch (error) {
      console.error("Error submitting attendance:", error);
      res.status(500).render("error", {
        layout: "main",
        error:
          "Internal server error while submitting attendance: " + error.message,
      });
    }
  });

router.post(
  "/absence-request/update/:studentId/:courseId/:action",
  verifyProfessorOwnsCourse,
  async (req, res) => {
    try {
      const { studentId, courseId, action } = req.params;
      const requestIndex = xss(req.body.requestIndex);

      if (action !== "approve" && action !== "reject") {
        return res.status(400).render("error", {
          layout: "main",
          error: "Invalid action",
        });
      }

      const userCollection = await users();
      const student = await userCollection.findOne({
        _id: new ObjectId(studentId),
      });

      if (!student || !student.absenceRequests) {
        return res.status(404).render("error", {
          layout: "main",
          error: "Student or absence requests not found",
        });
      }

      const requestIndexNum = parseInt(requestIndex);
      if (
        isNaN(requestIndexNum) ||
        requestIndexNum < 0 ||
        requestIndexNum >= student.absenceRequests.length
      ) {
        return res.status(400).render("error", {
          layout: "main",
          error: "Invalid request index",
        });
      }

      const updateStatus = action === "approve" ? "approved" : "rejected";

      await userCollection.updateOne(
        { _id: new ObjectId(studentId) },
        {
          $set: {
            [`absenceRequests.${requestIndexNum}.status`]: updateStatus,
            [`absenceRequests.${requestIndexNum}.reviewedAt`]: new Date(),
            [`absenceRequests.${requestIndexNum}.reviewedBy`]:
              req.session.user._id,
          },
        }
      );

      req.session.successMessage = `Absence request ${updateStatus}`;
      res.redirect(`/professor/course/${courseId}/analytics`);
    } catch (e) {
      console.error("Error updating absence request:", e);
      res.status(500).render("error", {
        layout: "main",
        error: "An error occurred while processing the request: " + e.message,
      });
    }
  }
);

router.route("/Discussion").get(async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "professor") {
      return res.status(403).render("error", {
        layout: "main",
        error: "You must be logged in as a professor to access discussions",
      });
    }

    res.render("professorDashboard/discussions", {
      layout: "main",
      title: "Course Discussions",
      course: req.query.courseId ? { _id: req.query.courseId } : null,
    });
  } catch (error) {
    console.error("Error accessing discussions:", error);
    res.status(500).render("error", {
      layout: "main",
      error: "Error loading discussions. Please try again later.",
    });
  }
});

router
  .route("/course/:courseId/lecture/:lectureId/discussions")
  .get(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const { courseId, lectureId } = req.params;

      const lecture = await lectureData.getLectureById(lectureId);
      if (!lecture) {
        return res.status(404).render("error", {
          layout: "main",
          error: "Lecture not found",
        });
      }

      const course = await courseData.getCourseById(courseId);

      let discussions = [];
      try {
        discussions = await discussionsData.getDiscussionsLecture(
          lectureId,
          courseId
        );

        const usersCollection = await users();
        for (const discussion of discussions) {
          const author = await usersCollection.findOne({
            _id: new ObjectId(discussion.authorId),
          });

          if (author) {
            discussion.authorName = `${author.firstName} ${author.lastName}`;
            discussion.authorRole = author.role;
          } else {
            discussion.authorName = "Unknown User";
          }
        }
      } catch (e) {
        if (e !== "No discussions found for this lecture") {
          console.error("Error fetching discussions:", e);
        }
      }

      res.render("professorDashboard/lectureDiscussions", {
        layout: "main",
        course,
        lecture,
        discussions,
        title: `Discussions for ${lecture.lectureTitle}`,
      });
    } catch (error) {
      console.error("Error fetching lecture discussions:", error);
      res.status(500).render("error", {
        layout: "main",
        error: "Error loading discussions: " + error.message,
      });
    }
  });

router
  .route("/course/:courseId/lecture/:lectureId/discussions/create")
  .get(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const { courseId, lectureId } = req.params;

      let lecture;
      try {
        lecture = await lectureData.getLectureById(lectureId);
      } catch (error) {
        return res.status(404).render("error", {
          layout: "main",
          error: "Lecture not found",
        });
      }

      res.render("professorDashboard/createDiscussion", {
        layout: "main",
        courseId,
        lectureId,
        lecture,
        title: `Create Discussion for ${lecture.lectureTitle}`,
        formData: {
          postTitle: `Discussion for ${lecture.lectureTitle}`,
          postContent:
            "Use this discussion forum to ask questions and share insights about this lecture.",
        },
      });
    } catch (error) {
      console.error("Error loading discussion form:", error);
      return res.status(400).render("error", {
        layout: "main",
        error: "Error loading discussion form: " + error,
      });
    }
  })
  .post(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const { courseId, lectureId } = req.params;
      const { postTitle, postContent } = req.body;
      const safeTitle = xss(postTitle.trim());
      const safeContent = xss(postContent.trim());
      const authorId = req.session.user._id;

      const newDiscussion = await discussionsData.createDiscussion(
        lectureId,
        courseId,
        authorId,
        safeTitle,
        safeContent
      );

      if (newDiscussion.alreadyExists) {
        req.session.successMessage = "Viewing existing discussion";
      } else {
        req.session.successMessage = "Discussion created successfully!";
      }

      res.redirect(
        `/professor/course/${courseId}/lecture/${lectureId}/discussions/${newDiscussion._id}`
      );
    } catch (error) {
      console.error("Error creating discussion:", error);

      try {
        const lecture = await lectureData.getLectureById(req.params.lectureId);
        return res.status(400).render("professorDashboard/createDiscussion", {
          layout: "main",
          courseId: req.params.courseId,
          lectureId: req.params.lectureId,
          lecture,
          error: "Error creating discussion: " + error,
          formData: {
            postTitle: xss(req.body.postTitle),
            postContent: xss(req.body.postContent),
          },
        });
      } catch (e) {
        return res.status(400).render("error", {
          layout: "main",
          error: "Error creating discussion: " + error,
        });
      }
    }
  });

router
  .route("/course/:courseId/lecture/:lectureId/discussions/:discussionId")
  .get(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const { courseId, lectureId, discussionId } = req.params;

      const discussionsCollection = await discussions();
      const discussion = await discussionsCollection.findOne({
        _id: new ObjectId(discussionId),
        courseId: new ObjectId(courseId),
        lectureId: new ObjectId(lectureId),
      });

      if (!discussion) {
        throw "Discussion not found";
      }

      const courseCollection = await courses();
      const course = await courseCollection.findOne({
        _id: new ObjectId(courseId),
      });

      if (!course) {
        throw "Course not found";
      }

      const usersCollection = await users();
      const author = await usersCollection.findOne({
        _id: discussion.authorId,
      });

      const discussionData = {
        ...discussion,
        _id: discussion._id.toString(),
        lectureId: discussion.lectureId.toString(),
        courseId: discussion.courseId.toString(),
        authorId: discussion.authorId.toString(),
        authorName: author
          ? `${author.firstName} ${author.lastName}`
          : "Unknown User",
        createdAt: new Date(discussion.createdAt).toLocaleString(),
        updatedAt: new Date(discussion.updatedAt).toLocaleString(),
        comments:
          discussion.comments?.map((c) => ({
            ...c,
            _id: c._id.toString(),
            commenterId: c.commenterId.toString(),
          })) || [],
      };

      if (discussionData.comments.length > 0) {
        const commenterIds = discussionData.comments
          .filter((c) => !c.isAnonymous)
          .map((c) => new ObjectId(c.commenterId));

        if (commenterIds.length > 0) {
          const commenters = await usersCollection
            .find({
              _id: { $in: commenterIds },
            })
            .toArray();

          const commenterMap = {};
          commenters.forEach((u) => {
            commenterMap[u._id.toString()] = `${u.firstName} ${u.lastName}`;
          });

          discussionData.comments.forEach((c) => {
            c.commenterName = c.isAnonymous
              ? "Anonymous"
              : commenterMap[c.commenterId] || "Unknown User";
            c.timestamp = new Date(c.timestamp).toLocaleString();
          });
        }
      }

      const lecture = await lectureData.getLectureById(lectureId);

      res.render("professorDashboard/DiscussionView", {
        layout: "main",
        course,
        lecture,
        discussion: discussionData,
        title: discussionData.postTitle,
        successMessage: req.session.successMessage,
      });

      req.session.successMessage = null;
    } catch (error) {
      console.error("Error viewing discussion:", error);
      res.status(500).render("error", {
        layout: "main",
        error: "Error viewing discussion: " + error,
      });
    }
  })
  .post(verifyProfessorOwnsCourse, async (req, res) => {
    try {
      const { courseId, lectureId, discussionId } = req.params;
      const { commentText, isAnonymous } = req.body;
      const commenterId = req.session.user._id;
      const safeCommentText = xss(commentText.trim());
      await discussionsData.addAComment(
        discussionId,
        courseId,
        commenterId,
        safeCommentText,
        isAnonymous === "off"
      );

      req.session.successMessage = "Comment added successfully";
      res.redirect(
        `/professor/course/${courseId}/lecture/${lectureId}/discussions/${discussionId}`
      );
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(400).render("error", {
        layout: "main",
        error: "Error adding comment: " + error.message,
      });
    }
  });

export default router;
