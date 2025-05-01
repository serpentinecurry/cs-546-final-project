// routes/student.js
import { Router } from "express";
import { loadPartial } from "../utils/templateHelpers.js";

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

router.route("/assignments").get(async (req, res) => {
  res.render("student/student", {
    layout: "main",
    studentContent: loadPartial("assignments"),
    user: withUser(req),
    currentPage: "assignments"
  });
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
