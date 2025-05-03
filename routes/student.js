// routes/student.js
import { Router } from "express";
import { loadPartial } from "../utils/templateHelpers.js";
import { users, courses, changeRequests } from "../config/mongoCollections.js";
import { absenceProofUpload } from "../middleware.js";
import { ObjectId } from "mongodb";
import { userData } from "../data/index.js";
import { stringValidate, validateEmail } from "../validation.js";

const router = Router();

const withUser = (req) => ({
  ...req.session.user,
  fullName: `${req.session.user.firstName} ${req.session.user.lastName}`,
});

router.route("/").get(async (req, res) => {
  res.render("student/student", {
    layout: "main",
    user: withUser(req),
    currentPage: "home",
  });
});

router.route("/dashboard").get(async (req, res) => {
  console.log("Session user in /dashboard:", req.session.user);
  res.render("student/student", {
    layout: "main",
    partialToRender: "dashboard",
    user: withUser(req),
    currentPage: "dashboard",
  });
});

router.route("/courses").get(async (req, res) => {
  res.render("student/student", {
    layout: "main",
    partialToRender: "courses",
    user: withUser(req),
    currentPage: "courses",
  });
});

// Absence Request - GET + POST
router
  .route("/absence-request")
  .get(async (req, res) => {
    const userCollection = await users();
    const courseCollection = await courses();

    const user = await userCollection.findOne({
      _id: new ObjectId(req.session.user._id),
    });

    if (!user) {
      return res.status(404).render("error", {
        layout: "main",
        error: "User not found in the database.",
      });
    }

    const enrolledCourseIds = (user.enrolledCourses || []).map(
      (id) => new ObjectId(id)
    );
    const enrolledCourses = await courseCollection
      .find({ _id: { $in: enrolledCourseIds } })
      .toArray();

    const courseMap = {};
    for (const course of enrolledCourses) {
      courseMap[
        course._id.toString()
      ] = `${course.courseName} (${course.courseCode})`;
    }

    const absenceRequestsWithCourseNames = (user.absenceRequests || []).map(
      (req) => ({
        ...req,
        courseDisplayName: courseMap[req.courseId] || "Unknown Course",
      })
    );

    res.render("student/student", {
      layout: "main",
      partialToRender: "absence-request",
      user: {
        ...withUser(req),
        absenceRequests: absenceRequestsWithCourseNames,
      },
      enrolledCourses,
      currentPage: "absence-request",
    });
  })

  .post(absenceProofUpload.single("proof"), async (req, res) => {
    const { courseId, reason, proofType } = req.body;

    if (!req.file || !req.file.path) {
      return res.status(400).render("student/student", {
        layout: "main",
        partialToRender: "absence-request",
        user: withUser(req),
        currentPage: "absence-request",
        error: "Proof document upload failed or was missing.",
      });
    }

    const newRequest = {
      courseId,
      reason,
      proofType,
      proofDocumentLink: req.file.path,
      accessStatus: "pending",
      requestedAt: new Date(),
    };

    try {
      const userCollection = await users();
      await userCollection.updateOne(
        { _id: new ObjectId(req.session.user._id) },
        { $push: { absenceRequests: newRequest } }
      );

      req.session.successMessage = "Absence request submitted!";
      res.redirect("/student/absence-request");
    } catch (e) {
      console.error("❌ Error submitting request:", e);
      res.status(500).render("error", {
        layout: "main",
        error: "Failed to submit absence request. Please try again.",
      });
    }
  });

router.route("/profile").get(async (req, res) => {
  console.log("User session at /profile:", req.session.user);
  res.render("student/student", {
    layout: "main",
    partialToRender: "profile",
    user: withUser(req),
    currentPage: "profile",
  });
});

// GET /student/profile/edit
router.route("/profile/edit").get((req, res) => {
  res.render("student/student", {
    layout: "main",
    partialToRender: "editProfile",
    user: withUser(req),
    currentPage: "editProfile",
  });
});

// POST /student/profile/edit
router.route("/profile/edit").post(async (req, res) => {
  const { firstName, lastName, dateOfBirth } = req.body;

  // TODO: Add full validation logic here

  try {
    // Update DB
    const userCollection = await users(); // assume MongoDB helper
    await userCollection.updateOne(
      { _id: new ObjectId(req.session.user._id) },
      { $set: { firstName, lastName, dateOfBirth } }
    );

    // Update session too
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
      error: "Something went wrong. Please try again.",
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
      let { field, newValue } = req.body;
      field = stringValidate(field);
      newValue = stringValidate(newValue);
      if (!["major", "email"].includes(field)) throw "Invalid field selection.";
      if (field === "email") {
        newValue = validateEmail(newValue);
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
      .find({ userId: new ObjectId(userId) })
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

// router.route("/calendar").get(async (req, res) => {
//     res.render("student/student", {
//         layout: "main",
//         studentContent: loadPartial("calendar"),
//         user: withUser(req),
//         currentPage: "calendar"
//     });
// });
//
// router.route("/messages").get(async (req, res) => {
//     res.render("student/student", {
//         layout: "main",
//         studentContent: loadPartial("messages"),
//         user: withUser(req),
//         currentPage: "messages"
//     });
// });
//
// router.route("/settings").get(async (req, res) => {
//     res.render("student/student", {
//         layout: "main",
//         studentContent: loadPartial("settings"),
//         user: withUser(req),
//         currentPage: "settings"
//     });
// });

export default router;
