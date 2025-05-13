import {Router} from "express";
import {ObjectId} from "mongodb";
import xss from "xss";

const router = Router();

import {courseData} from "../data/index.js";
import {stringValidate} from "../validation.js";
import {users} from "../config/mongoCollections.js";

// GET /admin/courses - List all courses
router.route("/").get(async (req, res) => {
    try {
        const allCourses = await courseData.getAllCourses();
        return res.render("admin/courseList", {courses: allCourses});
    } catch (error) {
        return res
            .status(500)
            .render("error", {error: "Failed to load courses."});
    }
});

// GET /admin/courses/create
router
    .route("/create")
    .get(async (req, res) => {
        try {
            const usersCollection = await users();
            const professors = await usersCollection
                .find({role: "professor", accessStatus: "approved"})
                .toArray();
            return res.render("admin/createCourse", {professors});
        } catch (error) {
            return res
                .status(500)
                .render("error", {error: "Failed to load create course form."});
        }
    })
    .post(async (req, res) => {
        let {courseName, courseCode, professorId} = req.body;
        try {
            courseName = xss(stringValidate(courseName));
            courseCode = xss(stringValidate(courseCode));
            professorId = stringValidate(professorId);
            if (!ObjectId.isValid(professorId)) throw "Invalid professor ID.";

            await courseData.createCourse(courseName, courseCode, professorId);

            return res.redirect("/admin/courses");
        } catch (error) {
            try {
                const usersCollection = await users();
                const professors = await usersCollection
                    .find({role: "professor", accessStatus: "approved"})
                    .toArray();

                return res.status(400).render("admin/createCourse", {
                    professors,
                    error:
                        typeof error === "string"
                            ? error
                            : error.message || "Error creating course.",
                    formData: {courseName, courseCode},
                });
            } catch (innerError) {
                return res.status(500).render("error", {
                    error: "Critical error loading create course page.",
                });
            }
        }
    });

router.route("/:id").get(async (req, res) => {
    try {
        let courseId = req.params.id;
        courseId = stringValidate(courseId);
        if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";

        const {course, professor} = await courseData.getCourseById(courseId);

        const usersCollection = await users();
        const professors = await usersCollection
            .find({role: "professor", accessStatus: "approved"})
            .toArray();

        res.render("admin/courseProfile", {course, professor, professors});
    } catch (error) {
        return res.status(400).render("error", {
            error:
                typeof error === "string"
                    ? error
                    : error.message || "Error loading course details.",
        });
    }
});

router.route("/edit/:id").post(async (req, res) => {
    try {
        let courseId = req.params.id;
        let {newProfessorId} = req.body;

        courseId = stringValidate(courseId);
        newProfessorId = xss(stringValidate(newProfessorId));

        if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";
        if (!ObjectId.isValid(newProfessorId)) throw "Invalid professor ID.";

        await courseData.updateCourseProfessor(courseId, newProfessorId);

        return res.redirect(`/admin/courses/${courseId}`);
    } catch (error) {
        return res.status(400).render("error", {
            error:
                typeof error === "string"
                    ? error
                    : error.message || "Error updating course.",
        });
    }
});

router.route("/update-info/:id").post(async (req, res) => {
    try {
        const courseId = stringValidate(req.params.id);
        const {courseName, courseCode} = req.body;

        if (!ObjectId.isValid(courseId)) throw "Invalid course ID";

        const validatedName = xss(stringValidate(courseName));
        const validatedCode = xss(stringValidate(courseCode));

        await courseData.updateCourseInfo(courseId, validatedName, validatedCode);

        return res.redirect(`/admin/courses/${courseId}`);
    } catch (error) {
        return res.status(400).render("error", {
            error:
                typeof error === "string"
                    ? error
                    : error.message || "Error updating course info.",
        });
    }
});

router.route("/delete/:id").post(async (req, res) => {
    try {
        let courseId = req.params.id;
        courseId = stringValidate(courseId);
        if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";
        const objectCourseId = new ObjectId(courseId);

        const usersCollection = await users();

        // Step 1: Remove course ID from taForCourses for all users
        await usersCollection.updateMany(
            {taForCourses: objectCourseId},
            {$pull: {taForCourses: objectCourseId}}
        );

        // Step 2: Revert role to student if no TA courses left
        const formerTAs = await usersCollection
            .find({
                role: "ta",
                taForCourses: {$exists: true, $size: 0},
            })
            .toArray();

        for (const user of formerTAs) {
            await usersCollection.updateOne(
                {_id: user._id},
                {$set: {role: "student"}, $unset: {taForCourses: ""}}
            );
        }

        await courseData.deleteCourse(courseId);

        return res.redirect("/admin/courses");
    } catch (error) {
        return res.status(400).render("error", {
            error:
                typeof error === "string"
                    ? error
                    : error.message || "Error deleting course.",
        });
    }
});

export default router;
