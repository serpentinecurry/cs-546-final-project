// routes/student.js
import { Router } from "express";
import { loadPartial } from "../utils/templateHelpers.js";
import { users } from "../config/mongoCollections.js";

const router = Router();

const withUser = (req) => ({
  ...req.session.user,
  fullName: `${req.session.user.firstName} ${req.session.user.lastName}`
});

router.route("/").get(async (req, res) => {
  res.render("student/student", {
    layout: "main",
    user: withUser(req),
    currentPage: "home"
  });
});

router.route("/dashboard").get(async (req, res) => {
  console.log("Session user in /dashboard:", req.session.user);
  res.render("student/student", {
    layout: "main",
    studentContent: loadPartial("dashboard"),
    user: withUser(req),
    currentPage: "dashboard"
  });
});

router.route("/courses").get(async (req, res) => {
  res.render("student/student", {
    layout: "main",
    studentContent: loadPartial("courses"),
    user: withUser(req),
    currentPage: "courses"
  });
});

router.route("/grades").get(async (req, res) => {
  res.render("student/student", {
    layout: "main",
    studentContent: loadPartial("grades"),
    user: withUser(req),
    currentPage: "grades"
  });
});

router.route("/profile").get(async (req, res) => {
  console.log("User session at /profile:", req.session.user);
  res.render("student/student", {
    layout: "main",
    partialToRender: "profile",
    user: withUser(req)
  });
});

// GET /student/profile/edit
router.route("/profile/edit").get((req, res) => {
  res.render("student/student", {
    layout: "main",
    partialToRender: "editProfile",
    user: withUser(req)
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
      { _id: req.session.user._id },
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
      error: "Something went wrong. Please try again."
    });
  }
});


router.route("/calendar").get(async (req, res) => {
  res.render("student/student", {
    layout: "main",
    studentContent: loadPartial("calendar"),
    user: withUser(req),
    currentPage: "calendar"
  });
});

router.route("/messages").get(async (req, res) => {
  res.render("student/student", {
    layout: "main",
    studentContent: loadPartial("messages"),
    user: withUser(req),
    currentPage: "messages"
  });
});

router.route("/settings").get(async (req, res) => {
  res.render("student/student", {
    layout: "main",
    studentContent: loadPartial("settings"),
    user: withUser(req),
    currentPage: "settings"
  });
});

export default router;
