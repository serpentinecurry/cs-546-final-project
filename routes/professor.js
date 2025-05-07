import { Router } from "express";
import {ObjectId} from "mongodb";
import userData from "../data/users.js";
import courseData from "../data/courses.js";


const router = Router()

import {users, courses, lectures} from "../config/mongoCollections.js";


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
    } catch(error) {
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
        console.log("Loading analytics for course ID:", courseId);
        
        // Get the course details
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

        // Make sure MongoDB ObjectIds are converted to strings for the handlebars template
        course._id = course._id.toString();
        
        // Get lectures for the course
        const lecturesCollection = await lectures();
        const courseLectures = await lecturesCollection.find({
            courseId: new ObjectId(courseId)
        }).toArray();
        
        // Get enrolled students count - with proper error handling
        let enrolledStudentsCount = 0;
        if (course.enrolledStudents && Array.isArray(course.enrolledStudents)) {
            enrolledStudentsCount = course.enrolledStudents.length;
        }
        
        // Get pending students with proper error handling
        let pendingStudents = [];
        try {
            pendingStudents = await userData.getPendingEnrollmentRequests(courseId);
            // Convert ObjectIds to strings for handlebars
            pendingStudents = pendingStudents.map(student => ({
                ...student,
                _id: student._id.toString()
            }));
        } catch (e) {
            console.error("Error getting pending enrollment requests:", e);
            // Don't let this error stop the whole page
        }
        
        // Get enrolled students list if the function exists
        let enrolledStudents = [];
        if (userData.getEnrolledStudents) {
            try {
                enrolledStudents = await userData.getEnrolledStudents(courseId);
            } catch (e) {
                console.error("Error getting enrolled students:", e);
                // Don't let this error stop the whole page
            }
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
      res.status(500).render('error', { error: e });
    }
  });
  
router.post('/enrollment/approve', async (req, res) => {
    try {
        const { studentId, courseId } = req.body;
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
        const { studentId, courseId } = req.body;
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

export default router;