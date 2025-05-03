// routes/student.js
import { Router } from "express";
import { loadPartial } from "../utils/templateHelpers.js";
import { users, courses, changeRequests } from "../config/mongoCollections.js";
import { absenceProofUpload } from "../middleware.js";
import { ObjectId } from "mongodb";
import { userData } from "../data/index.js";
import bcrypt from "bcrypt";
import {
  stringValidate,
  validateEmail,
  isValidDateString,
  passwordValidate,
} from "../validation.js";


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
  try {
    res.render("student/student", {
      layout: "main",
      partialToRender: "editProfile",
      user: withUser(req),
      currentPage: "editProfile",
    });
  } catch (error) {
    return res.status(500).render("error", { error: error.toString() });
  }
});

// POST /student/profile/edit
router.route("/profile/edit").post(async (req, res) => {
  let { firstName, lastName, dateOfBirth } = req.body;
  try {
    firstName = stringValidate(firstName);
    lastName = stringValidate(lastName);
    if (!isValidDateString(dateOfBirth)) {
      throw "Invalid date of birth";
    }
    const userCollection = await users();
    await userCollection.updateOne(
      { _id: new ObjectId(req.session.user._id) },
      { $set: { firstName, lastName, dateOfBirth } }
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
      const { success } = req.query;
      return res.render("student/student", {
        layout: "main",
        partialToRender: "changePasswordForm",
        user: withUser(req),
        currentPage: "editProfile",
        successMessage: success === "password-updated" ? "Password updated successfully ✅" : null
      });
    } catch (error) {
      return res.status(500).render("error", { error: error.toString() });
    }
  })
  .post(async (req, res) => {
    let { currentPassword, newPassword, confirmPassword } = req.body;
    let userId = req.session.user._id;
    try {
      userId = stringValidate(userId);
      if (!ObjectId.isValid(userId)) throw "Invalid userId";
      passwordValidate(newPassword);
      passwordValidate(confirmPassword);
      if (newPassword !== confirmPassword) throw "New passwords do not match.";
      const userCollection = await users();
      const user = await userCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) throw "User not found.";

      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) throw "Incorrect current password.";

      const hashed = await bcrypt.hash(newPassword, 10);
      await userCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { password: hashed } }
      );
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).render("error", { error: "Password updated, but logout failed." });
        }
        res.redirect("/?success=Password updated. Please log in again.");
      });
      
    } catch (error) {
      return res.status(400).render("student/student", {
        layout: "main",
        partialToRender: "changePasswordForm",
        user: req.session.user,
        currentPage: "editProfile",
        error: error.toString()
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
