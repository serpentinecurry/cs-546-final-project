import {Router} from "express";
import {ObjectId} from "mongodb";
import userData from "../data/users.js";
import courseData from "../data/courses.js";
import attendanceData from "../data/attendance.js";
import lectureData from "../data/lectures.js";
import dayjs from "dayjs";

const router = Router()

import {users, courses, lectures, attendance} from "../config/mongoCollections.js";
import {stringValidate} from "../validation.js";


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


        let absenceRequests = [];
        try {
            const userCollection = await users();


            const studentsWithRequests = await userCollection.find({
                "absenceRequests": {
                    $elemMatch: {
                        courseId: courseId
                    }
                }
            }).toArray();


            for (const student of studentsWithRequests) {
                if (Array.isArray(student.absenceRequests)) {

                    const courseRequests = student.absenceRequests
                        .filter(req => req.courseId === courseId)
                        .map((req, index) => ({
                            studentName: `${student.firstName} ${student.lastName}`,
                            studentId: student._id.toString(),
                            reason: req.reason || "No reason provided",
                            proofType: req.proofType || "None",
                            proofLink: req.proofDocumentLink || "",
                            status: req.status || "pending",
                            requestedAt: req.requestedAt || new Date(),
                            reviewedAt: req.reviewedAt || null,
                            requestIndex: index
                        }));

                    absenceRequests.push(...courseRequests);
                }
            }

            console.log(`Found ${absenceRequests.length} absence requests for course ${courseId}`);
        } catch (e) {
            console.error("Error fetching absence requests:", e);
        }

        const lecturesCollection = await lectures();
        const courseLectures = await lecturesCollection.find({
            courseId: new ObjectId(courseId)
        }).toArray();

        
        for (let lecture of courseLectures) {
            try {
                lecture.averageRating = await lectureData.getAverageRating(lecture._id);
            } catch (e) {
                lecture.averageRating = "0.00";
            }
        }

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

            const activeEnrollments = course.studentEnrollments ?
                course.studentEnrollments.filter(enrollment => enrollment.status === "active") : [];

            const activeStudentIds = activeEnrollments.map(enrollment =>
                new ObjectId(enrollment.studentId));

            if (activeStudentIds.length > 0) {
                const usersCollection = await users();
                enrolledStudents = await usersCollection.find({
                    _id: {$in: activeStudentIds}
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

        const averageAttendance = await attendanceData.averageAttendance(courseId);

        let totalPresent = 0;
        let totalAbsent = 0;
        let totalExcused = 0;

        try {
            const attendanceCollection = await attendance();

            // Add this code to handle both String and ObjectId courseIds
            let courseObjectId;
            try {
                courseObjectId = new ObjectId(courseId);
            } catch (e) {
                courseObjectId = courseId;
            }

            // Modify your query to check both formats
            const attendanceRecords = await attendanceCollection.find({
                $or: [
                    {courseId: courseId.toString()},
                    {courseId: courseObjectId}
                ]
            }).toArray();

            console.log(`Found ${attendanceRecords.length} attendance records`);

            // Ensure minimal values for the chart to render
            totalPresent = attendanceRecords.filter(r => r.status === 'present').length;
            totalAbsent = attendanceRecords.filter(r => r.status === 'absent').length;
            totalExcused = attendanceRecords.filter(r => r.status === 'excused').length;

            // If all zeros, add sample data so chart shows something
            if (totalPresent === 0 && totalAbsent === 0 && totalExcused === 0) {
                totalPresent = 1;
                totalAbsent = 1;
                totalExcused = 1;
            }

            console.log(`Attendance counts: Present=${totalPresent}, Absent=${totalAbsent}, Excused=${totalExcused}`);
        } catch (e) {
            console.error("Error fetching attendance statistics:", e);
        }

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
            successMessage: req.session.successMessage || null,
            totalPresent: totalPresent || 0,
            totalAbsent: totalAbsent || 0,
            totalExcused: totalExcused || 0
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
    } catch (error) {
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

        res.render("professorDashboard/courseView", {
            layout: "main",
            courseId: course._id.toString(),
            courseName: course.courseName,
            courseCode: course.courseCode,
            pendingStudents: pendingStudents
        });
    } catch (error) {
        console.error("Error loading course dashboard:", error);
        res.status(400).render("error", {
            layout: "main",
            error: typeof error === "string" ? error : error.message || "Error loading course dashboard."
        });
    }
});

router.post('/enrollment/reject', async (req, res) => {
    try {
        const studentId = stringValidate(req.body.studentId);
        const courseId = stringValidate(req.body.courseId);

        // Add your rejection logic here
        await userData.rejectEnrollmentRequest(studentId, courseId);

        req.session.successMessage = "Enrollment request rejected successfully";
        res.redirect(`/professor/course/${courseId}/analytics`);
    } catch (error) {
        console.error("Error rejecting enrollment:", error);
        res.status(400).render("error", {
            layout: "main",
            error: typeof error === "string" ? error : error.message || "Error rejecting enrollment request."
        });
    }
});

router.post('/enrollment/approve', async (req, res) => {
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
            error: typeof error === "string" ? error : error.message || "Error approving enrollment request."
        });
    }
});

// lecture creation route
router.route("/course/:courseId/lecture/create")
    .get(async (req, res) => {
        try {
            const courseId = req.params.courseId;
            const course = await courseData.getCourseById(courseId);

            res.render("professorDashboard/createLecture", {
                courseId: courseId,
                courseName: course.courseName,
                courseCode: course.courseCode
            });
        } catch (error) {
            res.status(400).render("error", {
                error: error.message || "Error loading form"
            });
        }
    })
    .post(async (req, res) => {

        let lectureTitle, lectureDate, lectureStartTime, lectureEndTime, description, materialsLink;

        const courseId = req.params.courseId;
        let course;
        try {

            course = await courseData.getCourseById(courseId);

            const professorId = req.session.user._id;
            lectureTitle = req.body.lectureTitle;
            lectureDate = req.body.lectureDate;
            lectureStartTime = req.body.lectureStartTime;
            lectureEndTime = req.body.lectureEndTime;
            description = req.body.description;
            materialsLink = req.body.materialsLink;

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
                    materialsLink
                }
            });
        }
    });


router.route("/course/:courseId/lecture/:lectureId").get(async (req, res) => {
    try {
        const {courseId, lectureId} = req.params
        const lecturesCollection = await lectures()
        const lecture = await lectureData.getLectureById(lectureId)
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

        if (!course) {
            return res.status(404).render("error", {
                layout: "main",
                error: "Course not found in the database.",
            })
        }


        course._id = course._id.toString();

        const activeEnrollmentIds = course.studentEnrollments
            ?.filter(enrollment => enrollment.status === "active")
            .map(enrollment => enrollment.studentId);

        const usersCollection = await users();
        const students = await usersCollection.find({
            _id: {$in: activeEnrollmentIds}
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

        let startDateTime = dayjs(`${lecture.lectureDate}T${lecture.lectureStartTime}`);
        let endDateTime = dayjs(`${lecture.lectureDate}T${lecture.lectureEndTime}`);
        if (endDateTime.isBefore(startDateTime)) {
            endDateTime = endDateTime.add(1, 'day'); // Overnight lecture
        }

        
    
        // Add these lines to get the ratings data
        const averageRating = await lectureData.getAverageRating(lectureId);
        const ratingCount = lecture.ratings ? lecture.ratings.length : 0;
    

        res.render("professorDashboard/LectureViews", {
            layout: "main",
            lecture,
            lectureStartTime: startDateTime.isValid() ? startDateTime.format("hh:mm A") : "N/A",
            lectureEndTime: endDateTime.isValid() ? endDateTime.format("hh:mm A") : "N/A",
            course: course,
            students: studentAttendanceHistory,
            averageRating: averageRating,
            ratingCount: ratingCount
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
    try {
        const {courseId, lectureId} = req.params;
        const attendanceData = req.body.attendance;

        // Validate that attendance data exists
        if (!attendanceData) {
            return res.status(400).render("error", {
                layout: "main",
                error: "No attendance data submitted. Please select attendance status for all students."
            });
        }

        const attendanceFormData = req.body.attendanceData;

        for (const [studentId, status] of Object.entries(attendanceFormData)) {

            await attendanceData.createAttendance(
                lectureId,
                courseId,
                studentId,
                status
            );
        }

        req.session.successMessage = "Attendance submitted successfully!"
        res.redirect(`/professor/course/${courseId}/analytics`)
    } catch (error) {
        console.error("Error submitting attendance:", error)
        res.status(500).render("error", {
            layout: "main",
            error: "Internal server error while submitting attendance: " + error.message
        })
    }
})

// absence request approve or reject route - doesn't mark as absent yet 
router.post('/absence-request/update/:studentId/:courseId/:action', async (req, res) => {
    try {
        const {studentId, courseId, action} = req.params;
        const {requestIndex} = req.body;

        if (action !== "approve" && action !== "reject") {
            return res.status(400).render("error", {
                layout: "main",
                error: "Invalid action"
            });
        }

        const userCollection = await users();
        const student = await userCollection.findOne({_id: new ObjectId(studentId)});

        if (!student || !student.absenceRequests) {
            return res.status(404).render("error", {
                layout: "main",
                error: "Student or absence requests not found"
            });
        }

        const requestIndexNum = parseInt(requestIndex);
        if (isNaN(requestIndexNum) || requestIndexNum < 0 || requestIndexNum >= student.absenceRequests.length) {
            return res.status(400).render("error", {
                layout: "main",
                error: "Invalid request index"
            });
        }


        const updateStatus = action === "approve" ? "approved" : "rejected";

        await userCollection.updateOne(
            {_id: new ObjectId(studentId)},
            {
                $set: {
                    [`absenceRequests.${requestIndexNum}.status`]: updateStatus,
                    [`absenceRequests.${requestIndexNum}.reviewedAt`]: new Date(),
                    [`absenceRequests.${requestIndexNum}.reviewedBy`]: req.session.user._id
                }
            }
        );

        req.session.successMessage = `Absence request ${updateStatus}`;
        res.redirect(`/professor/course/${courseId}/analytics`);
    } catch (e) {
        console.error("Error updating absence request:", e);
        res.status(500).render("error", {
            layout: "main",
            error: "An error occurred while processing the request: " + e.message
        });
    }
});

// Edit lecture routes
router.route("/course/:courseId/lecture/:lectureId/edit")
    .get(async (req, res) => {
        try {
            const {courseId, lectureId} = req.params;


            const courseCollection = await courses();
            const course = await courseCollection.findOne({_id: new ObjectId(courseId)});

            if (!course) {
                return res.status(404).render("error", {
                    layout: "main",
                    error: "Course not found"
                });
            }


            course._id = course._id.toString();

            const lecture = await lectureData.getLectureById(lectureId);


            res.render("professorDashboard/editLecture", {
                layout: "main",
                lecture: lecture,
                course: course
            });
        } catch (error) {
            console.error("Error loading lecture edit form:", error);
            res.status(400).render("error", {
                layout: "main",
                error: "Error loading lecture edit form: " + error.message
            });
        }
    })
    .post(async (req, res) => {
        try {
            const {courseId, lectureId} = req.params;
            const {lectureTitle, lectureDate, lectureStartTime, lectureEndTime, lectureDescription, lectureMaterials} = req.body;

            const updates = {
                lectureTitle: lectureTitle,
                lectureDate: lectureDate,
                lectureStartTime: lectureStartTime,
                lectureEndTime: lectureEndTime,
                description: lectureDescription,
                materialsLink: lectureMaterials
            };

            await lectureData.updateLecture(lectureId, updates);

            req.session.successMessage = "Lecture updated successfully!";
            res.redirect(`/professor/course/${courseId}/analytics`);
        } catch (error) {
            console.error("Error updating lecture:", error);
            res.status(400).render("error", {
                layout: "main",
                error: "Error updating lecture: " + error
            });
        }
    });

export default router;