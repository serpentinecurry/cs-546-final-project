import { Router } from "express";
import { ObjectId } from "mongodb";
const router = Router();

import { courseData } from "../data/index.js";
import { stringValidate } from "../validation.js";
import { users } from "../config/mongoCollections.js";

// GET /admin/courses - List all courses
router.route("/").get(async (req, res) => {
  try {
    const allCourses = await courseData.getAllCourses();
    return res.render("admin/courseList", { courses: allCourses });
  } catch (error) {
    return res
      .status(500)
      .render("error", { error: "Failed to load courses." });
  }
});

// GET /admin/courses/create
router
  .route("/create")
  .get(async (req, res) => {
    try {
      const usersCollection = await users();
      const professors = await usersCollection
        .find({ role: "professor", accessStatus: "approved" })
        .toArray();
      return res.render("admin/createCourse", { professors });
    } catch (error) {
      return res
        .status(500)
        .render("error", { error: "Failed to load create course form." });
    }
  })
  .post(async (req, res) => {
    let { courseName, courseCode, professorId } = req.body;
    try {
      courseName = stringValidate(courseName);
      courseCode = stringValidate(courseCode);
      professorId = stringValidate(professorId);
      if (!ObjectId.isValid(professorId)) throw "Invalid professor ID.";

      await courseData.createCourse(courseName, courseCode, professorId);

      return res.redirect("/admin/courses");
    } catch (error) {
      try {
        const usersCollection = await users();
        const professors = await usersCollection
          .find({ role: "professor", accessStatus: "approved" })
          .toArray();

        return res.status(400).render("admin/createCourse", {
          professors,
          error:
            typeof error === "string"
              ? error
              : error.message || "Error creating course.",
          formData: { courseName, courseCode },
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

    const { course, professor } = await courseData.getCourseById(courseId);

    const usersCollection = await users();
    const professors = await usersCollection
      .find({ role: "professor", accessStatus: "approved" })
      .toArray();

    res.render("admin/courseProfile", { course, professor, professors });
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
    const { newProfessorId } = req.body;

    courseId = stringValidate(courseId);
    newProfessorId = stringValidate(newProfessorId);

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

router.route("/delete/:id").post(async (req, res) => {
  try {
    let courseId = req.params.id;
    courseId = stringValidate(courseId);
    if (!ObjectId.isValid(courseId)) throw "Invalid course ID.";

    await courseData.deleteCourse(courseId);

    return res.redirect("/admin/courses");
  } catch (error) {
    return res
      .status(400)
      .render("error", {
        error:
          typeof error === "string"
            ? error
            : error.message || "Error deleting course.",
      });
  }
});

export default router;
