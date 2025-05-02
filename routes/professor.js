import { Router } from "express";
import {ObjectId} from "mongodb";
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

    res.render("professorDashboard.handlebars/professorDashboard", {
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

    const courseCollectiosn = await courses();
    const course = await courseCollectiosn.findOne(
        {_id: new ObjectId(req.params.id)}
    );

    if (!course) {
        return res.status(404).render("error", {
            layout: "main",
            error: "Course not found in the database.",
        });
    }

    const lectures = await lectures();
    const courseLectures = await lectures.find({courseId: course._id}).toArray();

    res.render("professor/courseDetails", {
        layout: "main",
        course: course,
        lectures: courseLectures,
    });

}),

router.route("/course/:id").get(async (req, res) => {

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

    res.render("professor/courseDetails", {
        layout: "main",
        course: course,
        lectures: courseLectures,
    });

});

router.route("/course/:id/analytics").get(async (req, res) => {
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


    res.render("professorDashboard.handlebars/DataAnalyticsView", {
        layout: "main",
        course: course,
        lectures: courseLectures,
    });
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

export default router;