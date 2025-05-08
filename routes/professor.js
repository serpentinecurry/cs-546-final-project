import {Router} from "express";
import {ObjectId} from "mongodb";
import userData from "../data/users.js";
import courseData from "../data/courses.js";
import lecturesData from "../data/lectures.js";


const router = Router()

import {users, courses, lectures, attendance} from "../config/mongoCollections.js";
import { stringValidate } from "../validation.js";


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
            _id: new ObjectId(req.session.user._id)
        });


        if (!professor) {
            return res.status(404).render("error", {
                layout: "main",
                error: "Professor not found in the database.",
            });
        }

        const courseCollection = await courses();
        const professorsCourses = await courseCollection.find({
            professorId: new ObjectId(req.session.user._id)
        }).toArray();

        res.render("professorDashboard/professorDashboard", {
            layout: "main",
            professorName: `${professor.firstName} ${professor.lastName}`,
            courses: professorsCourses,
            title: "Professor Dashboard"
        });

    } catch (error) {
        res.status(500).render("error", {
            layout: "main",
            error: "Internal server error while fetching professor data.",
        });
    }
});


router.route("/course/:id").get(async (req, res) => {
    try {
        return res.redirect(`/professor/course/${req.params.id}/analytics`);
        const courseCollection = await courses();
        const course = await courseCollection.findOne(
            {_id: new ObjectId(req.params.id)}
        );

        if (!course) {
            return res.status(404).render("error", {
                layout: "main",
                error: "Course not found in the database.",
            });
        }

        const lecturesCollection = await lectures();
        const courseLectures = await lecturesCollection.find({courseId: course._id}).toArray();

        res.render("professorDashboard/courseView", {
            layout: "main",
            courseId: course._id.toString(),
            courseName: course.courseName,
            courseCode: course.courseCode,
            lectures: courseLectures,
        });
    } catch (error) {
        console.error("Error displaying course:", error);
        res.status(500).render("error", {
            layout: "main",
            error: "Internal server error while loading course details."
        });
    }
});

router.route("/course/:id/analytics").get(async (req, res) => {
    try {
        const courseId = req.params.id;
        console.log("Loading for course:", courseId);


        const courseCollection = await courses();
        const course = await courseCollection.findOne({
            _id: new ObjectId(courseId)
        });

        if (!course) {
            return res.status(404).render("error", {
                layout: "main",
                error: "Course not found in the database.",
            });
        }


        course._id = course._id.toString();


        const lecturesCollection = await lectures();
        const courseLectures = await lecturesCollection.find({
            courseId: new ObjectId(courseId)
        }).toArray();


        let pendingStudents = [];
        try {
            pendingStudents = await userData.getPendingEnrollmentRequests(courseId);

            pendingStudents = pendingStudents.map(student => ({
                ...student,
                _id: student._id.toString()
            }));
        } catch (e) {
            console.error("Error getting pending enrollment requests:", e);

        }


        let enrolledStudents = [];
        let enrolledStudentsCount = 0;

        try {
            const courseCollection = await courses();
            const course = await courseCollection.findOne({
                _id: new ObjectId(courseId)
            });

            
            console.log("Student enrollments:", JSON.stringify(course.studentEnrollments));
            
                        const activeEnrollments = course.studentEnrollments ? 
                course.studentEnrollments.filter(enrollment => enrollment.status === "active") : [];
            
                
            const activeStudentIds = activeEnrollments.map(enrollment => 
                new ObjectId(enrollment.studentId));
            
                
            if (activeStudentIds.length > 0) {
                const usersCollection = await users();
                enrolledStudents = await usersCollection.find({
                    _id: { $in: activeStudentIds }
                }).toArray();
                
                
                enrolledStudents = enrolledStudents.map(student => ({
                    ...student,
                    _id: student._id.toString()
                }));
            }
            
            enrolledStudentsCount = enrolledStudents.length;
        } catch (e) {
            console.error("Error getting enrolled students:", e);
        }

        res.render("professorDashboard/DataAnalyticsView", {
            layout: "main",
            course: course,
            lectures: courseLectures,
            pendingStudents: pendingStudents || [],
            totalStudents: enrolledStudentsCount,
            totalLectures: courseLectures.length,
            averageAttendance: "85",
            enrolledStudents: enrolledStudents || [],
            successMessage: req.session.successMessage || null,
        });

    } catch (error) {
        console.error("Error in course analytics:", error);
        res.status(500).render("error", {
            layout: "main",
            error: "Internal server error while loading course analytics: " + error.message,
        });
    }
});

router.route("/lectures/analytics/:id").get(async (req, res) => {

    try {
        const lecturesCollection = await lectures()
        const lecture = await lecturesCollection.findOne
            ({_id: new ObjectId(req.params.id)})
        if (!lecture) {
            return res.status(404).render("error", {
                layout: "main",
                error: "Lecture not found in the database.",
            });
        }
    }
    catch (error) {
        console.error("Error fetching lecture:", error);
        return res.status(500).render("error", {
            layout: "main",
            error: "Internal server error while fetching lecture data.",
        });
    }

    const lecturesCollection = await lectures();
    const lecture = await lecturesCollection.findOne(
        {_id: new ObjectId(req.params.id)}
    );

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

router.get('/dashboard/:courseId', async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const course = await courseData.getCourseById(courseId);


        const pendingStudents = await userData.getPendingEnrollmentRequests(courseId);


        res.render('professorDashboard', {
            title: `${course.name} Dashboard`,
            course: course,
            pendingStudents: pendingStudents,
            layout: 'main'
        });
    } catch (e) {
        res.status(500).render('error', {error: e});
    }
});

router.post('/enrollment/approve', async (req, res) => {
    try {
        const studentId = stringValidate(req.body.studentId);
        const courseId = stringValidate(req.body.courseId);
        await userData.approveEnrollmentRequest(studentId, courseId);
        req.session.successMessage = "Enrollment request approved successfully.";
        res.redirect(`/professor/course/${courseId}/analytics`);
    } catch (error) {
        console.error("Error approving enrollment:", error);
        res.status(400).render("error", {
            layout: "main",
            error: typeof error === "string" ? error : error.message || "Error approving enrollment request."
        });
    }
});

router.post('/enrollment/reject', async (req, res) => {
    try {
        const studentId = stringValidate(req.body.studentId);
        const courseId = stringValidate(req.body.courseId);
        
        await userData.rejectEnrollmentRequest(studentId, courseId);
        req.session.successMessage = "Enrollment request rejected.";
        res.redirect(`/professor/course/${courseId}/analytics`);
    } catch (error) {
        console.error("Error rejecting enrollment:", error);
        res.status(400).render("error", {
            layout: "main",
            error: typeof error === "string" ? error : error.message || "Error rejecting enrollment request."
        });
    }
});

// lecture creation route
router.route("/course/:courseId/lecture/create")
  .get(async (req, res) => {
    try {
      const courseId = req.params.courseId;
      
     
      // const courseCollection = await courseData.getCourseById(courseId);
      // const course = await courseCollection.findOne(
      //   {_id: new ObjectId(courseId)}
      // );
        const course = await courseData.getCourseById(courseId);
      
      res.render("professorDashboard/createLecture", {
        courseId: courseId,
        courseName: course.courseName,
        courseCode: course.courseCode
      });
    } catch (error) {
      res.status(400).render("error", { error: error.message || "Error loading form" });
    }
  })
  .post(async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const professorId = req.session.user._id;
      const { lectureTitle, lectureDate, description, materialsLink } = req.body;
      
      
      await lecturesData.createLecture(
        courseId,
        lectureTitle,
        lectureDate, 
        description,
        materialsLink
      );
      
      req.session.successMessage = "Lecture created successfully!";
      res.redirect(`/professor/course/${courseId}/analytics`);
    } catch (error) {
      const course = await courseData.getCourseById(req.params.courseId);
      
      res.status(400).render("professorDashboard/createLecture", {
        courseId: req.params.courseId,
        courseName: course.courseName,
        courseCode: course.courseCode,
        error: error.message || "Error creating lecture"
      });
    }
  });


router.route("/course/:courseId/lecture/:lectureId").get(async (req, res) => {
    try {
        const {courseId, lectureId} = req.params
        const lecturesCollection = await lectures()
        const lecture = await lecturesCollection.findOne(
            {_id: new ObjectId(lectureId)}
        )
        if (!lecture) {
            return res.status(404).render("error", {
                layout: "main",
                error: "Lecture not found in the database.",
            })
        }

        const courseCollection = await courses()
        const course = await courseCollection.findOne(
            {_id: new ObjectId(courseId)}
        )

        if (!course)
        {
            return res.status(404).render("error", {
                layout: "main",
                error: "Course not found in the database.",
            })
        }

        const activeEnrollmentIds = course.studentEnrollments
            ?.filter(enrollment => enrollment.status === "active")
            .map(enrollment => enrollment.studentId);

        const usersCollection = await users();
        const students = await usersCollection.find({
            _id: { $in: activeEnrollmentIds }
        }).toArray();

        const attendanceCollection = await attendance()
        const attendanceRecords = await attendanceCollection.find({
            lectureId: new ObjectId(lectureId)
        }).toArray()
        
        const attendanceMap = {}
        for (const record of attendanceRecords) {
            attendanceMap[record.studentId.toString()] = record.status
        }

        const studentAttendanceHistory = students.map(student => {
            const id = student._id.toString()
            return {
                ...student,
                id: id,
                attendanceStatus: attendanceMap[id] || ""
            }
        })

        res.render("professorDashboard/LectureViews", {
            layout: "main",
            lecture: lecture,
            course: course,
            students: studentAttendanceHistory
        })

    } catch (e) {
        console.error("Error fetching lecture or course:", e);
        return res.status(500).render("error", {
            layout: "main",
            error: "Internal server error while fetching lecture or course data.",
        });
    }
})

//attendance submission route
router.route("/course/:courseId/lecture/:lectureId/attendance").post(async (req, res) => {

    const {courseId, lectureId} = req.params
    const attendanceCollection = await attendance()
    const attendanceData = req.body.attendanceData
    const attendanceRecords = []

    try {
        for (const [studentId, status] of Object.entries(attendanceData)) {
            if (!status) continue
            const attendanceRecord = {
                lectureId: new ObjectId(lectureId),
                courseId: new ObjectId(courseId),
                studentId: new ObjectId(studentId),
                status: status,
                points: status === "present" ? 0 : (status === "excused" ? 0 : 1),
                createdAt: new Date()
            }
            attendanceRecords.push(attendanceRecord)
        }
        await attendanceCollection.insertMany(attendanceRecords)
        req.session.successMessage = "Attendance submitted successfully!"
        res.redirect(`/professor/course/${courseId}/analytics`)


    }     catch (error) {
        console.error("Error submitting attendance:", error)
        res.status(500).render("error", {
            layout: "main",
            error: "Internal server error while submitting attendance."
        })
    }


})

export default router;