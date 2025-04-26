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

// GET /admin/courses/create - Show create form
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
        const professors = await usersCollection.find({ role: "professor", accessStatus: "approved" }).toArray();
  
        return res.status(400).render("admin/createCourse", {
          professors,
          error: typeof error === "string" ? error : error.message || "Error creating course.",
          formData: {courseName, courseCode}
        });
      } catch (innerError) {
        return res.status(500).render("error", { error: "Critical error loading create course page." });
      }
    }
  });

export default router;
