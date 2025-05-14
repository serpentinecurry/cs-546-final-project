// routes/student.js
import {Router} from "express";
import {
    users,
    courses,
    changeRequests,
    attendance,
    lectures,
    feedback,
    messages,
    discussions,
} from "../config/mongoCollections.js";
import {
    absenceProofUpload,
    checkActiveEnrollment,
    isTA,
} from "../middleware.js";
import {ObjectId} from "mongodb";
import {userData, calendarData, lectureData} from "../data/index.js";
import coursesData from "../data/courses.js";
import bcrypt from "bcrypt";
import dayjs from "dayjs";
import {
    stringValidate,
    validateEmail,
    isValidDateString,
    passwordValidate,
    calculateAge,
} from "../validation.js";
import discussionsData from "../data/discussions.js";
import {addTAOfficeHour, deleteTAOfficeHour} from "../data/officeHours.js";
import xss from "xss";

const router = Router();

const withUser = (req) => ({
    ...req.session.user,
    fullName: `${req.session.user.firstName} ${req.session.user.lastName}`,
});

router.route("/").get(async (req, res) => {
    res.redirect("/student/dashboard");
});

router.get("/dashboard", async (req, res) => {
    const studentId = new ObjectId(req.session.user._id);
    const attendanceCollection = await attendance();
    const lecturesCollection = await lectures();
    const courseCollection = await courses();

    const enrolledCourses = await courseCollection
        .find({
            studentEnrollments: {
                $elemMatch: {
                    studentId,
                    status: "active",
                },
            },
        })
        .toArray();

    const attendanceData = [];

    for (const course of enrolledCourses) {
        const totalLectures = await lecturesCollection.countDocuments({
            courseId: course._id,
        });
        if (totalLectures === 0) continue;

        const records = await attendanceCollection
            .find({
                courseId: course._id,
                studentId,
            })
            .toArray();

        const filteredRecords = records.filter((r) => r.status !== "excused");
        const effectiveLectures = filteredRecords.length;

        if (effectiveLectures === 0) continue;

        const presentCount = filteredRecords.filter(
            (r) => r.status === "present"
        ).length;
        const absentCount = filteredRecords.filter(
            (r) => r.status === "absent"
        ).length;

        const attendancePercentage = Math.round(
            (presentCount / effectiveLectures) * 100
        );

        const warningMessage =
            attendancePercentage < 35
                ? `⚠️ Your attendance in ${course.courseName} is critically low (${attendancePercentage}%).`
                : null;

        attendanceData.push({
            courseName: course.courseName,
            percentage: attendancePercentage,
            warningMessage,
        });
    }

    // Check if user is a TA and has courses without office hours
    let taNotificationMessage = null;
    if (req.session.user.role === "ta") {
        const taCourses = await courseCollection
            .find({
                taOfficeHours: {
                    $elemMatch: {
                        taId: studentId,
                    },
                },
            })
            .toArray();

        const coursesWithoutOfficeHours = enrolledCourses.filter(
            (course) =>
                !taCourses.some((taCourse) => taCourse._id.toString() === course._id.toString())
        );

        if (coursesWithoutOfficeHours.length > 0) {
            taNotificationMessage = `⚠️ You need to set up your office hours for ${coursesWithoutOfficeHours.length} course(s) to enable TA messaging features.`;
        }
    }

    res.render("student/student", {
        layout: "main",
        partialToRender: "dashboard",
        user: withUser(req),
        attendanceData,
        currentPage: "dashboard",
        taNotificationMessage,
    });
});

router.route("/all-courses").get(async (req, res) => {
    try {
        const studentId = req.session.user._id;
        const searchQuery = req.query.search?.trim().toLowerCase() || "";

        let allCourses = await coursesData.getAllCoursesForStudent(studentId);

        if (searchQuery) {
            allCourses = allCourses.filter((course) => {
                return (
                    course.courseName.toLowerCase().includes(searchQuery) ||
                    course.courseCode.toLowerCase().includes(searchQuery)
                );
            });
        }
        allCourses = allCourses.map((course) => {
            const enrollment = course.studentEnrollments?.find(
                (enr) => enr.studentId.toString() === studentId.toString()
            );
            return {
                ...course,
                isEnrolled: enrollment && enrollment.status === "active",
                alreadyApplied: enrollment && enrollment.status === "pending",
                isCourseFull: course.activeCount >= course.maxLimit,
            };
        });
        res.render("student/student", {
            layout: "main",
            partialToRender: "all-courses",
            user: withUser(req),
            currentPage: "all-courses",
            courses: allCourses,
            searchQuery,
        });
    } catch (e) {
        res.status(500).render("student/student", {
            layout: "main",
            partialToRender: "all-courses",
            error: e,
            courses: [],
        });
    }
});

router.route("/enroll/:courseId").post(async (req, res) => {
    try {
        const studentId = req.session.user._id;
        await coursesData.requestEnrollment(req.params.courseId, studentId);

        req.session.successMessage = "✅ Enrollment request sent successfully!";
        res.redirect("/student/all-courses");
    } catch (e) {
        const allCourses = await coursesData.getAllCoursesForStudent(
            req.session.user._id
        );
        res.status(400).render("student/student", {
            layout: "main",
            partialToRender: "all-courses",
            error: e,
            errorCourseId: req.params.courseId,
            courses: allCourses,
            searchQuery: "",
            user: withUser(req),
        });
    }
});

router.post("/unenroll/:courseId", async (req, res) => {
    const studentId = req.session.user._id;
    const courseId = req.params.courseId;

    try {
        const courseCollection = await courses();
        const userCollection = await users();
        const user = await userCollection.findOne({_id: new ObjectId(studentId)});

        if (user?.taForCourses?.some((id) => id.toString() === courseId)) {
            throw "You cannot un-enroll from a course you're a TA for.";
        }

        const updateResult = await courseCollection.updateOne(
            {
                _id: new ObjectId(courseId),
                "studentEnrollments.studentId": new ObjectId(studentId),
            },
            {
                $set: {
                    "studentEnrollments.$.status": "inactive",
                },
            }
        );

        if (updateResult.modifiedCount === 0) {
            throw "Failed to un-enroll from course.";
        }

        req.session.successMessage =
            "✅ You have been un-enrolled from the course.";
        res.redirect("/student/my-courses");
    } catch (e) {
        res.status(500).render("student/student", {
            layout: "main",
            partialToRender: "my-courses",
            error: e,
            user: withUser(req),
            currentPage: "my-courses",
            courses: await coursesData.getStudentEnrolledCourses(studentId),
        });
    }
});

router.route("/my-courses").get(async (req, res) => {
    try {
        const studentId = req.session.user._id;
        const courses = await coursesData.getStudentEnrolledCourses(studentId);

        res.render("student/student", {
            layout: "main",
            partialToRender: "my-courses",
            user: withUser(req),
            currentPage: "my-courses",
            courses,
        });
    } catch (e) {
        res.status(500).render("student/student", {
            layout: "main",
            partialToRender: "my-courses",
            error: e,
            courses: [],
        });
    }
});

router.route("/courses/:id").get(checkActiveEnrollment, async (req, res) => {
    try {
        const courseId = stringValidate(req.params.id);
        const studentId = req.session.user._id;

        if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";

        const {course, professor} = await coursesData.getCourseById(courseId);

        const isEnrolled = course.studentEnrollments?.some(
            (r) =>
                r.studentId?.toString() === studentId.toString() &&
                r.status === "active"
        );

        if (!isEnrolled) {
            return res.status(403).render("error", {
                layout: "main",
                error: "⛔ You are not actively enrolled in this course.",
            });
        }

        const lecturesCollection = await lectures();
        const lecturesList = await lecturesCollection
            .find({courseId: new ObjectId(courseId)})
            .sort({lectureTitle: 1})
            .toArray();

        const formattedLectures = lecturesList.map((lec) => ({
            _id: lec._id.toString(),
            title: lec.lectureTitle,
            date:
                lec.lectureDate instanceof Date
                    ? lec.lectureDate.toISOString().split("T")[0]
                    : lec.lectureDate,
            time: {
                start: lec.lectureStartTime
                    ? dayjs(`${lec.lectureDate}T${lec.lectureStartTime}`).format(
                        "hh:mm A"
                    )
                    : "N/A",
                end: lec.lectureEndTime
                    ? dayjs(`${lec.lectureDate}T${lec.lectureEndTime}`).format("hh:mm A")
                    : "N/A",
            },
            description: lec.description,
            materialsLink: lec.materialsLink,
        }));

        const feedbackCollection = await feedback();

        const activeSurvey = await feedbackCollection.findOne({
            courseId: new ObjectId(courseId),
            addedAt: {$gte: dayjs().subtract(5, "day").toDate()},
            "studentResponses.studentId": {$ne: studentId},
        });

        const successMessage = req.session.successMessage || null;
        req.session.successMessage = null; // ✅ clear before rendering

        return res.render("student/student", {
            layout: "main",
            partialToRender: "course-details",
            course,
            professor,
            lectures: formattedLectures,
            user: withUser(req),
            feedbackSurvey: activeSurvey || null,
            successMessage,
        });
    } catch (error) {
        console.error("❌ ERROR in /student/courses/:id →", error);
        return res.status(400).render("error", {
            layout: "main",
            error:
                typeof error === "string" ? error : "❌ Failed to load course page.",
        });
    }
});

router
    .route("/course/:courseId/feedback")
    .get(async (req, res) => {
        try {
            const courseId = req.params.courseId;
            const studentId = req.session.user._id;

            const feedbackCollection = await feedback();
            const feedbackSurvey = await feedbackCollection.findOne({
                courseId: new ObjectId(courseId),
                addedAt: {$gte: dayjs().subtract(5, "day").toDate()},
                "studentResponses.studentId": {$ne: studentId},
            });

            if (!feedbackSurvey) {
                return res.status(403).render("error", {
                    error: "Survey not available or has already been submitted.",
                });
            }

            const content = feedbackSurvey.content[0];

            res.render("student/feedbackForm", {
                layout: "main",
                courseId,
                feedbackId: feedbackSurvey._id.toString(),
                content,
            });
        } catch (e) {
            console.error("GET feedback error:", e);
            res.status(500).render("error", {error: "Failed to load survey."});
        }
    })

    .post(async (req, res) => {
        try {
            const {feedbackId, rating, q1answer, q2answer, q3answer} = req.body;
            const studentId = req.session.user._id;
            const parsedRating = parseFloat(xss(rating));
            const isRatingValid =
                !isNaN(parsedRating) &&
                parsedRating >= 0 &&
                parsedRating <= 10 &&
                (parsedRating * 10) % 5 === 0;

            const isNonEmpty = (val) =>
                typeof val === "string" && val.trim().length > 0;

            if (
                !isRatingValid ||
                !isNonEmpty(q1answer) ||
                !isNonEmpty(q2answer) ||
                !isNonEmpty(q3answer)
            ) {
                return res.status(400).render("error", {
                    error:
                        "All fields are required. Rating must be between 0 and 10 in 0.5 steps.",
                });
            }

            const feedbackCollection = await feedback();
            const feedbackDoc = await feedbackCollection.findOne({
                _id: new ObjectId(feedbackId),
                "studentResponses.studentId": {$ne: studentId},
                addedAt: {$gte: dayjs().subtract(5, "day").toDate()},
            });

            if (!feedbackDoc) {
                return res.status(403).render("error", {
                    error: "Invalid or already submitted survey.",
                });
            }

            const updateResult = await feedbackCollection.updateOne(
                {_id: new ObjectId(feedbackId)},
                {
                    $push: {
                        studentResponses: {
                            studentId,
                            rating: parsedRating,
                            q1answer: xss(q1answer.trim()),
                            q2answer: xss(q2answer.trim()),
                            q3answer: xss(q3answer.trim()),
                        },
                    },
                }
            );

            if (!updateResult.acknowledged || updateResult.modifiedCount === 0) {
                return res.status(500).render("error", {
                    error: "Failed to save feedback. Please try again.",
                });
            }

            req.session.successMessage = "🎉 Survey submitted successfully!";
            res.redirect(`/student/courses/${req.params.courseId}`);
        } catch (e) {
            console.error("POST feedback error:", e);
            res.status(500).render("error", {
                error: "Failed to submit feedback. Please try again.",
            });
        }
    });

router.get(
    "/courses/:courseId/lectures/:lectureId",
    checkActiveEnrollment,
    async (req, res) => {
        try {
            const {courseId, lectureId} = req.params;
            const studentId = req.session.user._id;

            if (!ObjectId.isValid(courseId) || !ObjectId.isValid(lectureId)) {
                throw "Invalid course or lecture ID.";
            }

            const lecturesCollection = await lectures();
            const courseCollection = await courses();
            const userCollection = await users();
            const discussionsCollection = await discussions();

            const lecture = await lecturesCollection.findOne({
                _id: new ObjectId(lectureId),
            });
            if (!lecture) throw "Lecture not found.";

            const course = await courseCollection.findOne({
                _id: new ObjectId(courseId),
            });
            if (!course) throw "Course not found.";

            const professor = await userCollection.findOne({
                _id: new ObjectId(lecture.professorId),
            });

            const discussion = await discussionsCollection.findOne({
                lectureId: new ObjectId(lectureId),
                courseId: new ObjectId(courseId),
            });

            const hasDiscussion = !!discussion;
            const discussionId = discussion ? discussion._id.toString() : null;

            let lectureEndTimestamp = null;
            if (lecture.lectureDate && lecture.lectureEndTime) {
                const dateTime = new Date(
                    `${lecture.lectureDate}T${lecture.lectureEndTime}`
                );
                if (!isNaN(dateTime)) {
                    lectureEndTimestamp = dateTime.toISOString();
                }
            }

            const hasRated = lecture.ratings?.some(
                (r) => r.studentId.toString() === studentId.toString()
            );

            const lectureNotes = await userData.getLectureNotes(studentId, lectureId);

            return res.render("student/student", {
                layout: "main",
                partialToRender: "lecture-detail",
                currentPage: "courses",
                user: withUser(req),
                courseName: course.courseName,
                course,
                professorName: professor
                    ? `${professor.firstName} ${professor.lastName}`
                    : "Unknown",
                lecture: {
                    _id: lecture._id.toString(),
                    title: lecture.lectureTitle,
                    date: lecture.lectureDate,
                    startTime: lecture.lectureStartTime
                        ? dayjs(
                            `${lecture.lectureDate}T${lecture.lectureStartTime}`
                        ).format("hh:mm A")
                        : "N/A",
                    endTime: lecture.lectureEndTime
                        ? dayjs(`${lecture.lectureDate}T${lecture.lectureEndTime}`).format(
                            "hh:mm A"
                        )
                        : "N/A",

                    description: lecture.description,
                    materialsLink: lecture.materialsLink,
                },
                lectureEndTimestamp,
                hasRated,
                lectureNotes,
                hasDiscussion,
                discussionId,
            });
        } catch (error) {
            console.error("Lecture detail error:", error);
            return res.status(400).render("error", {
                layout: "main",
                error:
                    typeof error === "string" ? error : "Failed to load lecture details.",
            });
        }
    }
);

router.post(
    "/courses/:courseId/lectures/:lectureId/rate",
    checkActiveEnrollment,
    async (req, res) => {
        try {
            const {courseId, lectureId} = req.params;
            const {rating} = req.body;
            const studentId = req.session.user._id;

            if (!ObjectId.isValid(courseId) || !ObjectId.isValid(lectureId)) {
                return res
                    .status(400)
                    .json({message: "Invalid course or lecture ID."});
            }

            const numericRating = parseFloat(xss(rating));
            if (isNaN(numericRating) || numericRating < 0.5 || numericRating > 5) {
                return res
                    .status(400)
                    .json({message: "Rating must be between 0.5 and 5."});
            }

            const lecturesCollection = await lectures();
            const lecture = await lecturesCollection.findOne({
                _id: new ObjectId(lectureId),
                courseId: new ObjectId(courseId),
            });
            if (!lecture)
                return res.status(404).json({message: "Lecture not found."});

            const endTime = new Date(
                `${lecture.lectureDate}T${lecture.lectureEndTime}`
            );
            const now = new Date();
            if (isNaN(endTime.getTime()) || now < endTime) {
                return res
                    .status(403)
                    .json({message: "You can only rate after the lecture ends."});
            }

            const hasRated = lecture.ratings?.some(
                (r) => r.studentId.toString() === studentId.toString()
            );
            if (hasRated) {
                return res
                    .status(409)
                    .json({message: "You have already rated this lecture."});
            }

            const newRating = {
                studentId: new ObjectId(studentId),
                rating: numericRating,
            };

            await lecturesCollection.updateOne(
                {_id: new ObjectId(lectureId)},
                {$push: {ratings: newRating}}
            );

            return res.json({message: "✅ Rating submitted successfully!"});
        } catch (err) {
            console.error("Rating submission failed:", err);
            return res.status(500).json({message: "Internal Server Error"});
        }
    }
);

router.post(
    "/courses/:courseId/lectures/:lectureId/notes",
    checkActiveEnrollment,
    async (req, res) => {
        let studentId, courseId, lectureId;
        try {
            [studentId, courseId, lectureId] = [
                stringValidate(req.session.user._id),
                stringValidate(req.params.courseId),
                stringValidate(req.params.lectureId),
            ];
        } catch (error) {
            return res.status(400).render("error", {error});
        }

        let lectureNotes;
        try {
            lectureNotes = xss(stringValidate(req.body.lecture_notes_input));
        } catch (error) {
            return res.status(400).render("error", {error});
        }

        try {
            const lectureNotesUpdate = await userData.addLectureNotes(
                studentId,
                lectureId,
                courseId,
                lectureNotes
            );
            if (lectureNotesUpdate.updateSuccessful) {
                return res.redirect(
                    `/student/courses/${req.params.courseId}/lectures/${req.params.lectureId}`
                );
            }
        } catch (error) {
            return res.status(500).render("error", {error});
        }
    }
);

router.get(
    "/courses/:courseId/members",
    checkActiveEnrollment,
    async (req, res) => {
        const {courseId} = req.params;

        try {
            const courseCollection = await courses();
            const userCollection = await users();

            const course = await courseCollection.findOne({
                _id: new ObjectId(courseId),
            });
            if (!course) throw "Course not found";

            const activeEnrollments =
                course.studentEnrollments?.filter((enr) => enr.status === "active") ||
                [];

            const studentIds = activeEnrollments.map(
                (entry) => new ObjectId(entry.studentId)
            );

            const students = await userCollection
                .find({_id: {$in: studentIds}})
                .project({firstName: 1, lastName: 1, major: 1})
                .toArray();

            const classMembers = students.map((s) => ({
                fullName: `${s.firstName} ${s.lastName}`,
                major: s.major,
                initials: `${s.firstName.charAt(0)}${s.lastName.charAt(0)}`,
            }));

            res.render("student/student", {
                layout: "main",
                user: withUser(req),
                partialToRender: "class-members",
                currentPage: "courses",
                classMembers,
                courseId,
            });
        } catch (err) {
            console.error("Error loading class members:", err);
            res.status(500).render("error", {
                layout: "main",
                error: "Could not load class members",
            });
        }
    }
);

router.get("/:courseId/attendance", checkActiveEnrollment, async (req, res) => {
    const {courseId} = req.params;
    const studentId = new ObjectId(req.session.user._id);

    const attendanceCollection = await attendance();
    const lectureCollection = await lectures();
    const courseCollection = await courses();

    const course = await courseCollection.findOne({
        _id: new ObjectId(courseId),
    });

    const records = await attendanceCollection
        .find({
            courseId: new ObjectId(courseId),
            studentId,
        })
        .toArray();

    const excusedCount = records.filter((r) => r.status === "excused").length;

    const relevantRecords = records.filter((r) => r.status !== "excused");
    const presentCount = relevantRecords.filter(
        (r) => r.status === "present"
    ).length;
    const absentCount = relevantRecords.filter(
        (r) => r.status === "absent"
    ).length;

    const effectiveLectures = relevantRecords.length;

    const attendancePercentage =
        effectiveLectures > 0
            ? Math.round((presentCount / effectiveLectures) * 100)
            : 0;

    let progressBarClass = "bg-success";
    if (attendancePercentage < 35) {
        progressBarClass = "bg-danger";
    } else if (attendancePercentage < 75) {
        progressBarClass = "bg-warning text-dark";
    }

    const formattedRecords = await Promise.all(
        records.map(async (record) => {
            const lecture = await lectureCollection.findOne({
                _id: new ObjectId(record.lectureId),
            });
            return {
                date: lecture?.lectureDate || "Unknown",
                status: record.status,
                points: record.points,
            };
        })
    );

    res.render("student/student", {
        layout: "main",
        partialToRender: "attendanceRecord",
        currentPage: "attendance",
        user: req.session.user,
        course,
        attendancePercentage,
        presentCount,
        totalLectures: records.length,
        excusedCount,
        absentCount,
        progressBarClass,
        attendanceRecords: formattedRecords,
    });
});

// Absence Request - GET + POST
router
    .route("/absence-request")
    .get(async (req, res) => {
        const userCollection = await users();
        const courseCollection = await courses();
        const lectureCollection = await lectures();
        const studentId = req.session.user._id;

        const user = await userCollection.findOne({
            _id: new ObjectId(req.session.user._id),
        });

        if (!user) {
            return res.status(404).render("error", {
                layout: "main",
                error: "User not found in the database.",
            });
        }

        const enrolledCourses = await courseCollection
            .find({
                studentEnrollments: {
                    $elemMatch: {
                        studentId: new ObjectId(studentId),
                        status: "active",
                    },
                },
            })
            .toArray();

        const courseMap = {};
        for (const course of enrolledCourses) {
            courseMap[
                course._id.toString()
                ] = `${course.courseName} (${course.courseCode})`;
        }

        const courseIds = enrolledCourses.map((c) => c._id);
        const lectureList = await lectureCollection
            .find({courseId: {$in: courseIds}})
            .project({_id: 1, lectureTitle: 1, lectureDate: 1})
            .toArray();

        const lectureMap = {};
        for (const lec of lectureList) {
            const date =
                lec.lectureDate instanceof Date
                    ? lec.lectureDate.toISOString().split("T")[0]
                    : lec.lectureDate || "Unknown";
            lectureMap[lec._id.toString()] = `${lec.lectureTitle} (${date})`;
        }

        const absenceRequestsWithCourseNames = (user.absenceRequests || []).map(
            (req) => ({
                ...req,
                courseDisplayName: courseMap[req.courseId] || "Unknown Course",
                lectureDisplayName: lectureMap[req.lectureId] || "Unknown Lecture",
            })
        );

        const successMessage = req.session.successMessage || null;
        delete req.session.successMessage;

        res.render("student/student", {
            layout: "main",
            partialToRender: "absence-request",
            user: {
                ...withUser(req),
                absenceRequests: absenceRequestsWithCourseNames,
            },
            enrolledCourses,
            currentPage: "absence-request",
            successMessage,
        });
    })
    .post(absenceProofUpload.single("proof"), async (req, res) => {
        let {courseId, lectureId, reason, proofType} = req.body;
        lectureId = lectureId?.trim();
        reason = xss(reason?.trim());
        proofType = xss(proofType?.trim());

        const studentId = req.session.user._id;
        const userCollection = await users();
        const courseCollection = await courses();
        const lectureCollection = await lectures();

        async function renderWithError(errorMessage) {
            const enrolledCourses = await courseCollection
                .find({
                    studentEnrollments: {
                        $elemMatch: {
                            studentId: new ObjectId(studentId),
                            status: "active",
                        },
                    },
                })
                .toArray();

            const courseMap = {};
            for (const course of enrolledCourses) {
                courseMap[
                    course._id.toString()
                    ] = `${course.courseName} (${course.courseCode})`;
            }

            const courseIds = enrolledCourses.map((c) => c._id);
            const lectureList = await lectureCollection
                .find({courseId: {$in: courseIds}})
                .project({_id: 1, lectureTitle: 1, lectureDate: 1})
                .toArray();

            const lectureMap = {};
            for (const lec of lectureList) {
                const date =
                    lec.lectureDate instanceof Date
                        ? lec.lectureDate.toISOString().split("T")[0]
                        : lec.lectureDate || "Unknown";
                lectureMap[lec._id.toString()] = `${lec.lectureTitle} (${date})`;
            }

            const userDoc = await userCollection.findOne({
                _id: new ObjectId(studentId),
            });

            const absenceRequestsWithCourseNames = (
                userDoc.absenceRequests || []
            ).map((req) => ({
                ...req,
                courseDisplayName: courseMap[req.courseId] || "Unknown Course",
                lectureDisplayName: lectureMap[req.lectureId] || "Unknown Lecture",
            }));

            return res.status(400).render("student/student", {
                layout: "main",
                partialToRender: "absence-request",
                user: {
                    ...withUser(req),
                    absenceRequests: absenceRequestsWithCourseNames,
                },
                enrolledCourses,
                currentPage: "absence-request",
                error: errorMessage,
                selectedCourseId: courseId,
                selectedLectureId: lectureId,
                selectedReason: reason,
                selectedProofType: proofType,
            });
        }

        // === Input Validations ===
        if (!lectureId) {
            return await renderWithError("Lecture must be selected.");
        }

        if (
            !courseId ||
            !reason ||
            !proofType ||
            reason.length === 0 ||
            proofType.length === 0
        ) {
            return await renderWithError(
                "All fields including proof type and reason are required and must not be empty."
            );
        }

        if (!req.file || !req.file.path) {
            return await renderWithError(
                "Proof document upload failed or was missing."
            );
        }

        try {
            const existingRequest = await userCollection.findOne({
                _id: new ObjectId(studentId),
                absenceRequests: {
                    $elemMatch: {
                        courseId,
                        lectureId,
                    },
                },
            });

            if (existingRequest) {
                return await renderWithError(
                    "An absence request for this lecture has already been submitted."
                );
            }

            const newRequest = {
                courseId,
                lectureId,
                reason: xss(reason),
                proofType: xss(proofType),
                proofDocumentLink: req.file.path,
                status: "pending",
                requestedAt: new Date(),
            };

            await userCollection.updateOne(
                {_id: new ObjectId(studentId)},
                {$push: {absenceRequests: newRequest}}
            );

            req.session.successMessage = "Absence request submitted!";
            res.redirect("/student/absence-request");
        } catch (e) {
            console.error("❌ Error submitting absence request:", e);
            res.status(500).render("error", {
                layout: "main",
                error: "Failed to submit absence request. Please try again.",
            });
        }
    });

router.get("/lectures/:courseId", checkActiveEnrollment, async (req, res) => {
    try {
        const lecturesCollection = await lectures();
        const usersCollection = await users();

        const courseId = req.params.courseId;
        const studentId = req.session.user._id;

        const courseObjectId = new ObjectId(courseId);

        const allLectures = await lecturesCollection
            .find({courseId: courseObjectId})
            .project({lectureTitle: 1, lectureDate: 1})
            .toArray();

        const user = await usersCollection.findOne(
            {_id: new ObjectId(studentId)},
            {projection: {absenceRequests: 1}}
        );

        const requestedLectureIds = new Set(
            (user?.absenceRequests || [])
                .filter((req) => req.courseId === courseId)
                .map((req) => req.lectureId)
        );

        const result = allLectures.map((lec) => ({
            _id: lec._id.toString(),
            lectureTitle: lec.lectureTitle,
            lectureDate:
                lec.lectureDate instanceof Date
                    ? lec.lectureDate.toISOString().split("T")[0]
                    : lec.lectureDate,
            isDisabled: requestedLectureIds.has(lec._id.toString()),
        }));

        res.json(result);
    } catch (e) {
        console.error("Error fetching lectures:", e);
        res.status(500).json({error: "Failed to fetch lectures"});
    }
});

router.route("/profile").get(async (req, res) => {
    res.render("student/student", {
        layout: "main",
        partialToRender: "profile",
        user: withUser(req),
        currentPage: "profile",
    });
});

// GET /student/profile/edit
router.route("/profile/edit").get((req, res) => {
    try {
        res.render("student/student", {
            layout: "main",
            partialToRender: "editProfile",
            user: withUser(req),
            currentPage: "editProfile",
        });
    } catch (error) {
        return res.status(500).render("error", {error: error.toString()});
    }
});

// POST /student/profile/edit
router.route("/profile/edit").post(async (req, res) => {
    let {firstName, lastName, dateOfBirth} = req.body;
    try {
        firstName = xss(stringValidate(firstName));
        lastName = xss(stringValidate(lastName));
        if (!isValidDateString(dateOfBirth)) {
            throw "Invalid date of birth";
        }
        const userCollection = await users();
        await userCollection.updateOne(
            {_id: new ObjectId(req.session.user._id)},
            {
                $set: {
                    firstName,
                    lastName,
                    dateOfBirth,
                    age: calculateAge(dateOfBirth),
                },
            }
        );

        req.session.user.firstName = firstName;
        req.session.user.lastName = lastName;
        req.session.user.dateOfBirth = dateOfBirth;

        res.redirect("/student/profile");
    } catch (error) {
        console.error("Profile update failed:", error);
        res.status(500).render("student/student", {
            layout: "main",
            partialToRender: "editProfile",
            user: withUser(req),
            error: error || "Something went wrong. Please try again.",
        });
    }
});

router
    .route("/profile/change-password")
    .get(async (req, res) => {
        try {
            const {success} = req.query;
            return res.render("student/student", {
                layout: "main",
                partialToRender: "changePasswordForm",
                user: withUser(req),
                currentPage: "editProfile",
                successMessage:
                    success === "password-updated"
                        ? "Password updated successfully ✅"
                        : null,
            });
        } catch (error) {
            return res.status(500).render("error", {error: error.toString()});
        }
    })
    .post(async (req, res) => {
        let {currentPassword, newPassword, confirmPassword} = req.body;
        let userId = req.session.user._id;
        try {
            userId = stringValidate(userId);
            if (!ObjectId.isValid(userId)) throw "Invalid userId";
            passwordValidate(newPassword);
            passwordValidate(confirmPassword);
            if (newPassword !== confirmPassword) throw "New Password do not match.";
            const userCollection = await users();
            const user = await userCollection.findOne({_id: new ObjectId(userId)});
            if (!user) throw "User not found.";

            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) throw "Incorrect current password.";

            const hashed = await bcrypt.hash(newPassword, 10);
            await userCollection.updateOne(
                {_id: new ObjectId(userId)},
                {$set: {password: hashed}}
            );
            req.session.destroy((err) => {
                if (err) {
                    return res
                        .status(500)
                        .render("error", {error: "Password updated, but logout failed."});
                }
                res.redirect("/?success=Password updated. Please log in again.");
            });
        } catch (error) {
            return res.status(400).render("student/student", {
                layout: "main",
                partialToRender: "changePasswordForm",
                user: req.session.user,
                currentPage: "editProfile",
                error: error.toString(),
            });
        }
    });

router
    .route("/request-change")
    .get(async (req, res) => {
        try {
            return res.render("student/student", {
                layout: "main",
                partialToRender: "requestChangeForm",
                user: withUser(req),
                currentPage: "requestChangeForm",
            });
        } catch (error) {
            console.log(error);
        }
    })
    .post(async (req, res) => {
        try {
            const userId = req.session.user._id;
            let {field, newValue} = req.body;
            field = xss(stringValidate(field));
            newValue = xss(stringValidate(newValue));
            if (!["major", "email"].includes(field)) throw "Invalid field selection.";
            if (field === "email") {
                newValue = xss(validateEmail(newValue));
            }
            await userData.createRequest(userId, field, newValue);
            res.redirect("/student/request-status");
        } catch (error) {
            return res.status(400).render("student/student", {
                layout: "main",
                partialToRender: "requestChangeForm",
                user: {
                    ...req.session.user,
                    fullName: `${req.session.user.firstName} ${req.session.user.lastName}`,
                },
                currentPage: "requestChangeForm",
                error: error.toString(),
            });
        }
    });

router.route("/request-status").get(async (req, res) => {
    try {
        const userId = req.session.user._id;
        const requestCollection = await changeRequests();
        const requests = await requestCollection
            .find({userId: new ObjectId(userId)})
            .toArray();
        return res.render("student/student", {
            layout: "main",
            partialToRender: "requestStatus",
            user: withUser(req),
            currentPage: "requestChangeForm",
            requests,
        });
    } catch (error) {
        console.log(error);
    }
});

router.route("/calendar").get(async (req, res) => {
    try {
        const lectures = await calendarData.getStudentLectures(
            req.session.user._id
        );
        const officeHours = await calendarData.getOfficeHours(req.session.user._id);
        let events = lectures.concat(officeHours);
        const userCollection = await users();
        const user = await userCollection.findOne({_id: new ObjectId(req.session.user._id)});

        const subscribeLink = user?.calendarId
            ? `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(user.calendarId)}`
            : null;
        return res.render("student/student", {
            layout: "main",
            partialToRender: "calendar",
            user: withUser(req),
            currentPage: "calendar",
            events: events,
            calendarSubscribeUrl: subscribeLink,
        });
    } catch (error) {
        console.log(error);
        return res.render("error", {error: error});
    }
});

router.route("/ta/officeHour").get(isTA, async (req, res) => {
    try {
        const userId = new ObjectId(req.session.user._id);
        const userCollection = await users();
        const courseCollection = await courses();

        const user = await userCollection.findOne({_id: userId});
        const courseIds = (user.taForCourses || []).map((id) => new ObjectId(id));

        const taCourses = await courseCollection
            .find({_id: {$in: courseIds}})
            .project({
                courseName: 1,
                courseCode: 1,
                professorId: 1,
                taOfficeHours: 1,
            })
            .toArray();

        const professorIds = taCourses.map((c) => c.professorId).filter(Boolean);
        const professors = await userCollection
            .find({_id: {$in: professorIds}})
            .project({firstName: 1, lastName: 1})
            .toArray();
        const profMap = {};
        professors.forEach((prof) => {
            profMap[prof._id.toString()] = `${prof.firstName} ${prof.lastName}`;
        });

        const formattedCourses = taCourses.map((course) => ({
            _id: course._id.toString(),
            courseName: course.courseName,
            courseCode: course.courseCode,
            professorName: profMap[course.professorId?.toString()] || "Unknown",
            officeHours: (course.taOfficeHours || []).filter(
                (entry) => entry.taId?.toString() === userId.toString()
            ),
        }));

        // Check if any courses have no office hours set up
        const hasNoOfficeHours = formattedCourses.some(course => course.officeHours.length === 0);
        const notificationMessage = hasNoOfficeHours
            ? "⚠️ Important: You need to set up your office hours to enable messaging features with students. Please add your office hours below."
            : null;

        return res.render("student/student", {
            layout: "main",
            partialToRender: "taOfficeHours",
            user: {
                ...req.session.user,
                fullName: `${req.session.user.firstName} ${req.session.user.lastName}`,
            },
            currentPage: "taOfficeHours",
            taCourses: formattedCourses,
            notificationMessage
        });
    } catch (error) {
        console.error("Error loading TA office hours:", error);
        res.status(500).render("error", {
            layout: "main",
            error: "Failed to load office hours. Please try again."
        });
    }
});

router.route("/ta/officeHour/add").post(isTA, async (req, res) => {
    try {
        const {courseId, day, startTime, endTime, location, notes} = req.body;
        const userId = req.session.user._id;

        await addTAOfficeHour({
            courseId,
            userId,
            day,
            startTime,
            endTime,
            location,
            notes,
        });

        return res.redirect("/student/ta/officeHour");
    } catch (error) {
        console.error("Add TA office hour error:", error);
        res.status(400).render("error", {
            layout: "main",
            error: typeof error === "string" ? error : "Could not add office hour.",
        });
    }
});

router.post("/ta/officeHour/delete", isTA, async (req, res) => {
    try {
        const {courseId, officeHourId} = req.body;
        const userId = req.session.user._id;

        await deleteTAOfficeHour({
            courseId,
            officeHourId,
            userId,
        });

        res.redirect("/student/ta/officeHour");
    } catch (error) {
        console.error("❌ Error Deleting Office Hour:", error);
        res.status(400).render("error", {
            layout: "main",
            error:
                typeof error === "string" ? error : "Could not delete office hour.",
        });
    }
});

router.route("/contact-tas").get(async (req, res) => {
    try {
        const studentId = new ObjectId(req.session.user._id);
        const userIdStr = studentId.toString();
        const courseCollection = await courses();
        const userCollection = await users();
        const messagesCollection = await messages();

        const enrolledCourses = await courseCollection
            .find({
                studentEnrollments: {
                    $elemMatch: {
                        studentId,
                        status: "active",
                    },
                },
            })
            .toArray();

        const filteredCourses = enrolledCourses.filter((course) => {
            return !(course.taOfficeHours || []).some(
                (oh) => oh.taId.toString() === userIdStr
            );
        });

        const coursesWithTAs = [];

        for (const course of filteredCourses) {
            const taIds = [
                ...new Set(
                    (course.taOfficeHours || []).map((oh) => oh.taId.toString())
                ),
            ];

            let tas = [];
            if (taIds.length > 0) {
                tas = await userCollection
                    .find({
                        _id: {$in: taIds.map((id) => new ObjectId(id))},
                    })
                    .project({
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                    })
                    .toArray();
            }

            const formattedTAs = tas.map((ta) => ({
                _id: ta._id.toString(),
                fullName: `${ta.firstName} ${ta.lastName}`,
                email: ta.email,
                officeHours: (course.taOfficeHours || [])
                    .filter((oh) => oh.taId.toString() === ta._id.toString())
                    .map((oh) => ({
                        day: oh.day,
                        startTime: oh.startTime,
                        endTime: oh.endTime,
                        location: oh.location,
                    })),
            }));

            coursesWithTAs.push({
                _id: course._id.toString(),
                courseName: course.courseName,
                courseCode: course.courseCode,
                tas: formattedTAs,
            });
        }

        const rawSentMessages = await messagesCollection
            .find({fromId: studentId})
            .sort({sentAt: -1})
            .toArray();

        const courseIdsSet = new Set(
            rawSentMessages.map((m) => m.courseId.toString())
        );
        const courseDocs = await courseCollection
            .find({
                _id: {$in: Array.from(courseIdsSet).map((id) => new ObjectId(id))},
            })
            .project({
                _id: 1,
                courseName: 1,
                taOfficeHours: 1,
            })
            .toArray();
        const courseTAmap = {};
        courseDocs.forEach((c) => {
            courseTAmap[c._id.toString()] = c;
        });
        const filteredSentMessages = rawSentMessages.filter((m) => {
            const course = courseTAmap[m.courseId.toString()];
            if (!course) return false;

            return !(course.taOfficeHours || []).some(
                (oh) => oh.taId.toString() === studentId.toString()
            );
        });

        const taIdsSet = new Set(
            filteredSentMessages.map((m) => m.toId.toString())
        );
        const taUsers = await userCollection
            .find({
                _id: {$in: Array.from(taIdsSet).map((id) => new ObjectId(id))},
            })
            .project({
                firstName: 1,
                lastName: 1,
            })
            .toArray();
        const taMap = {};
        taUsers.forEach((ta) => {
            taMap[ta._id.toString()] = `${ta.firstName} ${ta.lastName}`;
        });
        const sentMessages = filteredSentMessages.map((m) => ({
            taName: taMap[m.toId.toString()] || "Unknown TA",
            courseName:
                courseTAmap[m.courseId.toString()]?.courseName || "Unknown Course",
            subject: m.subject,
            message: m.message,
            date: m.sentAt ? new Date(m.sentAt).toLocaleString() : "",
        }));

        res.render("student/student", {
            layout: "main",
            partialToRender: "cta",
            user: withUser(req),
            currentPage: "cta",
            courses: coursesWithTAs,
            sentMessages,
            successMessage: req.session.successMessage,
        });
    } catch (error) {
        console.error("Error loading TAs:", error);
        res.status(500).render("student/student", {
            layout: "main",
            partialToRender: "cta",
            user: withUser(req),
            currentPage: "cta",
            error: "Failed to load TAs. Please try again.",
        });
    }
});

router.route("/send-message").post(async (req, res) => {
    try {
        const {taId, subject, message} = req.body;
        const studentId = req.session.user._id;

        if (!taId || !subject || !message) {
            throw "All fields are required";
        }

        const userCollection = await users();
        const courseCollection = await courses();
        const messagesCollection = await messages();

        const ta = await userCollection.findOne({
            _id: new ObjectId(taId),
            role: "ta",
        });
        if (!ta) {
            throw "Invalid TA selected";
        }

        const studentCourses = await courseCollection
            .find({
                studentEnrollments: {
                    $elemMatch: {
                        studentId: new ObjectId(studentId),
                        status: "active",
                    },
                },
            })
            .toArray();

        let sharedCourseId = null;
        for (const course of studentCourses) {
            const isSenderTAForCourse = (course.taOfficeHours || []).some(
                (oh) => oh.taId.toString() === studentId.toString()
            );

            const isRecipientTAForCourse = (course.taOfficeHours || []).some(
                (oh) => oh.taId.toString() === taId
            );
            if (!isSenderTAForCourse && isRecipientTAForCourse) {
                sharedCourseId = course._id;
                break;
            }
        }
        if (!sharedCourseId) {
            throw "You can only message TAs from your courses where you are a student (not a TA)";
        }

        await messagesCollection.insertOne({
            fromId: new ObjectId(studentId),
            toId: new ObjectId(taId),
            courseId: new ObjectId(sharedCourseId),
            subject: xss(subject.trim()),
            message: xss(message.trim()),
            sentAt: new Date(),
            read: false,
        });

        req.session.successMessage = "Message sent successfully!";
        res.redirect("/student/contact-tas");
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(400).render("student/student", {
            layout: "main",
            partialToRender: "contactTAs",
            user: withUser(req),
            currentPage: "contactTAs",
            error: typeof error === "string" ? error : "Failed to send message",
        });
    }
});

router.route("/ta/messages").get(isTA, async (req, res) => {
    try {
        const taId = new ObjectId(req.session.user._id);
        const userCollection = await users();
        const courseCollection = await courses();
        const messagesCollection = await messages();

        const ta = await userCollection.findOne({
            _id: taId,
            role: "ta",
        });
        if (!ta) {
            return res.status(403).render("error", {
                layout: "main",
                error: "You must be a TA to access this page.",
            });
        }

        const taCourses = await courseCollection
            .find({
                taOfficeHours: {$elemMatch: {taId: taId}},
            })
            .project({_id: 1, studentEnrollments: 1, taOfficeHours: 1})
            .toArray();
        const taCourseIds = new Set(taCourses.map((c) => c._id.toString()));

        const courseStudentMap = {};
        for (const course of taCourses) {
            const taIdsForCourse = new Set(
                (course.taOfficeHours || []).map((oh) => oh.taId.toString())
            );
            const studentIds = (course.studentEnrollments || [])
                .filter(
                    (enr) =>
                        enr.status === "active" &&
                        !taIdsForCourse.has(enr.studentId.toString())
                )
                .map((enr) => enr.studentId.toString());
            courseStudentMap[course._id.toString()] = new Set(studentIds);
        }

        const rawMessages = await messagesCollection
            .find({toId: taId})
            .sort({sentAt: -1})
            .toArray();

        const filteredMessages = rawMessages.filter((m) => {
            const senderId = m.fromId.toString();
            const courseId = m.courseId.toString();
            return (
                taCourseIds.has(courseId) && courseStudentMap[courseId]?.has(senderId)
            );
        });

        const studentIds = filteredMessages.map((m) => m.fromId);
        const students = await userCollection
            .find({_id: {$in: studentIds}})
            .project({
                firstName: 1,
                lastName: 1,
            })
            .toArray();
        const studentMap = {};
        students.forEach((s) => {
            studentMap[s._id.toString()] = `${s.firstName} ${s.lastName}`;
        });

        const messagess = filteredMessages.map((m) => ({
            _id: m._id.toString(),
            subject: m.subject,
            message: m.message,
            date: m.sentAt ? new Date(m.sentAt).toLocaleString() : "",
            studentName: studentMap[m.fromId.toString()] || "Unknown Student",
            isActive: false,
        }));

        res.render("student/student", {
            layout: "main",
            partialToRender: "taMessages",
            user: withUser(req),
            currentPage: "taMessages",
            messages: messagess,
            successMessage: req.session.successMessage,
        });
    } catch (error) {
        console.error("Error loading messages:", error);
        res.status(500).render("student/student", {
            layout: "main",
            partialToRender: "taMessages",
            user: withUser(req),
            currentPage: "taMessages",
            error: "Failed to load messages. Please try again.",
        });
    }
});

// GET: TA Contact Students page
router.get("/ta/contact-students", isTA, async (req, res) => {
    try {
        const taId = new ObjectId(req.session.user._id);
        const userCollection = await users();
        const courseCollection = await courses();

        const taCourses = await courseCollection
            .find({
                taOfficeHours: {$elemMatch: {taId}},
            })
            .toArray();

        const coursess = [];
        for (const course of taCourses) {
            const studentEnrollments = (course.studentEnrollments || []).filter(
                (e) => e.status === "active"
            );
            const studentIds = studentEnrollments.map(
                (e) => new ObjectId(e.studentId)
            );

            const students = await userCollection
                .find({
                    _id: {$in: studentIds},
                })
                .project({
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    major: 1,
                    taForCourses: 1,
                })
                .toArray();

            const formattedStudents = students
                .filter(
                    (s) =>
                        !(s.taForCourses || []).some(
                            (cid) => cid.toString() === course._id.toString()
                        )
                )
                .map((s) => ({
                    _id: s._id.toString(),
                    fullName: `${s.firstName} ${s.lastName}`,
                    email: s.email,
                    major: s.major || "-",
                }));
            coursess.push({
                _id: course._id.toString(),
                courseName: course.courseName,
                courseCode: course.courseCode,
                students: formattedStudents,
            });
        }

        const messagesCollection = await messages();
        const rawSentMessages = await messagesCollection
            .find({fromId: taId})
            .sort({sentAt: -1})
            .toArray();

        const courseStudentMap = {};
        for (const course of taCourses) {
            const taIdsForCourse = new Set(
                (course.taOfficeHours || []).map((oh) => oh.taId.toString())
            );
            const studentIds = (course.studentEnrollments || [])
                .filter(
                    (enr) =>
                        enr.status === "active" &&
                        !taIdsForCourse.has(enr.studentId.toString())
                )
                .map((enr) => enr.studentId.toString());
            courseStudentMap[course._id.toString()] = new Set(studentIds);
        }

        const filteredSentMessages = rawSentMessages.filter((m) => {
            const studentId = m.toId.toString();
            const courseId = m.courseId.toString();
            return courseStudentMap[courseId]?.has(studentId);
        });

        const studentIdsSet = new Set(
            filteredSentMessages.map((m) => m.toId.toString())
        );
        const courseIdsSet = new Set(
            filteredSentMessages.map((m) => m.courseId.toString())
        );
        const studentUsers = await userCollection
            .find({
                _id: {$in: Array.from(studentIdsSet).map((id) => new ObjectId(id))},
            })
            .project({
                firstName: 1,
                lastName: 1,
            })
            .toArray();
        const courseDocs = await courseCollection
            .find({
                _id: {$in: Array.from(courseIdsSet).map((id) => new ObjectId(id))},
            })
            .project({courseName: 1})
            .toArray();
        const studentMap = {};
        studentUsers.forEach((s) => {
            studentMap[s._id.toString()] = `${s.firstName} ${s.lastName}`;
        });
        const courseMap = {};
        courseDocs.forEach((c) => {
            courseMap[c._id.toString()] = c.courseName;
        });
        const sentMessages = filteredSentMessages.map((m) => ({
            studentName: studentMap[m.toId.toString()] || "Unknown Student",
            courseName: courseMap[m.courseId.toString()] || "Unknown Course",
            subject: m.subject,
            message: m.message,
            date: m.sentAt ? new Date(m.sentAt).toLocaleString() : "",
        }));

        res.render("student/student", {
            layout: "main",
            partialToRender: "contactStudents",
            user: withUser(req),
            currentPage: "contactStudents",
            courses: coursess,
            sentMessages,
        });
    } catch (error) {
        console.error("Error loading TA contact students page:", error);
        res.status(500).render("student/student", {
            layout: "main",
            partialToRender: "contactStudents",
            user: withUser(req),
            currentPage: "contactStudents",
            courses: [],
            error: "Failed to load students. Please try again.",
        });
    }
});

// POST: TA sends message to student
router.post("/ta/send-message", isTA, async (req, res) => {
    try {
        const {studentId, subject, message} = req.body;
        const taId = req.session.user._id;
        if (!studentId || !subject || !message) {
            throw "All fields are required";
        }
        const userCollection = await users();
        const courseCollection = await courses();
        const messagesCollection = await messages();

        const student = await userCollection.findOne({
            _id: new ObjectId(studentId),
        });
        if (!student) {
            throw "Invalid student selected";
        }

        const taCourses = await courseCollection
            .find({
                taOfficeHours: {$elemMatch: {taId: new ObjectId(taId)}},
                studentEnrollments: {
                    $elemMatch: {studentId: new ObjectId(studentId), status: "active"},
                },
            })
            .toArray();
        if (!taCourses.length) {
            throw "You can only message students from your courses";
        }
        const courseId = taCourses[0]._id;

        await messagesCollection.insertOne({
            fromId: new ObjectId(taId),
            toId: new ObjectId(studentId),
            courseId: new ObjectId(courseId),
            subject: xss(subject.trim()),
            message: xss(message.trim()),
            sentAt: new Date(),
            read: false,
        });

        req.session.successMessage = "Message sent to student successfully!";
        res.redirect("/student/ta/contact-students");
    } catch (error) {
        console.error("Error sending message to student:", error);
        res.status(400).render("student/student", {
            layout: "main",
            partialToRender: "contactStudents",
            user: withUser(req),
            currentPage: "contactStudents",
            courses: [],
            error: typeof error === "string" ? error : "Failed to send message",
        });
    }
});

// GET: Student Inbox (messages from TAs)
router.get("/inbox", async (req, res) => {
    try {
        const studentId = new ObjectId(req.session.user._id);
        const userCollection = await users();
        const courseCollection = await courses();
        const messagesCollection = await messages();

        const enrolledCourses = await courseCollection
            .find({
                studentEnrollments: {
                    $elemMatch: {
                        studentId,
                        status: "active",
                    },
                },
            })
            .project({_id: 1, taOfficeHours: 1})
            .toArray();

        const filteredCourses = enrolledCourses.filter((course) => {
            return !(course.taOfficeHours || []).some(
                (oh) => oh.taId.toString() === studentId.toString()
            );
        });
        const studentCourseIds = new Set(
            filteredCourses.map((c) => c._id.toString())
        );

        const rawMessages = await messagesCollection
            .find({toId: studentId})
            .sort({sentAt: -1})
            .toArray();

        const taUsersList = await userCollection
            .find({role: "ta"})
            .project({_id: 1})
            .toArray();
        const taIdSet = new Set(taUsersList.map((u) => u._id.toString()));
        const filteredMessages = rawMessages.filter((m) => {
            return (
                taIdSet.has(m.fromId.toString()) &&
                studentCourseIds.has(m.courseId.toString())
            );
        });

        const taIdsSet = new Set(filteredMessages.map((m) => m.fromId.toString()));
        const courseIdsSet = new Set(
            filteredMessages.map((m) => m.courseId.toString())
        );
        const taUsers = await userCollection
            .find({
                _id: {$in: Array.from(taIdsSet).map((id) => new ObjectId(id))},
            })
            .project({
                firstName: 1,
                lastName: 1,
            })
            .toArray();
        const courseDocs = await courseCollection
            .find({
                _id: {$in: Array.from(courseIdsSet).map((id) => new ObjectId(id))},
            })
            .project({courseName: 1})
            .toArray();
        const taMap = {};
        taUsers.forEach((ta) => {
            taMap[ta._id.toString()] = `${ta.firstName} ${ta.lastName}`;
        });
        const courseMap = {};
        courseDocs.forEach((c) => {
            courseMap[c._id.toString()] = c.courseName;
        });
        const messagess = filteredMessages.map((m) => ({
            _id: m._id.toString(),
            taName: taMap[m.fromId.toString()] || "Unknown TA",
            courseName: courseMap[m.courseId.toString()] || "Unknown Course",
            subject: m.subject,
            message: m.message,
            date: m.sentAt ? new Date(m.sentAt).toLocaleString() : "",
        }));

        res.render("student/student", {
            layout: "main",
            partialToRender: "studentInbox",
            user: withUser(req),
            currentPage: "studentInbox",
            messages: messagess,
        });
    } catch (error) {
        console.error("Error loading student inbox:", error);
        res.status(500).render("student/student", {
            layout: "main",
            partialToRender: "studentInbox",
            user: withUser(req),
            currentPage: "studentInbox",
            messages: [],
            error: "Failed to load inbox. Please try again.",
        });
    }
});

router
    .route("/courses/:courseId/lectures/:lectureId/discussions/:discussionId")
    .get(checkActiveEnrollment, async (req, res) => {
        try {
            const {courseId, lectureId, discussionId} = req.params;
            const studentId = req.session.user._id;

            if (
                !ObjectId.isValid(courseId) ||
                !ObjectId.isValid(lectureId) ||
                !ObjectId.isValid(discussionId)
            ) {
                throw "Invalid IDs provided";
            }

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
                            _id: {$in: commenterIds},
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

            res.render("student/student", {
                layout: "main",
                partialToRender: "discussionView",
                currentPage: "courses",
                user: withUser(req),
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
    .post(checkActiveEnrollment, async (req, res) => {
        try {
            const {courseId, lectureId, discussionId} = req.params;
            const {commentText, isAnonymous} = req.body;
            const commenterId = req.session.user._id;
            const safeCommentText = xss(commentText.trim());
            await discussionsData.addAComment(
                discussionId,
                courseId,
                commenterId,
                safeCommentText,
                isAnonymous === "on"
            );
            req.session.successMessage = "Comment added successfully";
            res.redirect(
                `/student/courses/${courseId}/lectures/${lectureId}/discussions/${discussionId}`
            );
        } catch (error) {
            console.error("Error adding comment:", error);
            res.status(400).render("error", {
                layout: "main",
                error: "Error adding comment: " + error,
            });
        }
    });

export default router;
