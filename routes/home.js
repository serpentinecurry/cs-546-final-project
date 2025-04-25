import { Router } from "express";
const router = Router();

import { userData } from "../data/index.js";
import {
  stringValidate,
  validateEmail,
  passwordValidate,
  azAZLenValidate,
  isValidDateString,
} from "../validation.js";
import { preventDoubleLogin } from "../middleware.js";

router
  .route("/")
  .get(preventDoubleLogin, async (req, res) => {
    const logout = req.query.loggedOut ? "Successfully logged out!" : null;
    res.render("home", { error: false, logout });
  })
  .post(async (req, res) => {
    let { email, password } = req.body;
    try {
      email = validateEmail(email);
      passwordValidate(password);
      const user = await userData.login(email, password);
      req.session.user = {
        firstName: user.firstName,
        lastName: user.lastName,
        age: user.age,
        gender: user.gender,
        email: user.email,
        role: user.role,
        dateOfBirth: user.dateOfBirth,
        accessStatus: user.accessStatus,
        userCreatedAt: user.userCreatedAt,
      };
      if (user.role === "professor") return res.redirect("/professor");
      else if (user.role === "student") return res.redirect("/student");
      else if (user.role === "ta") return res.redirect("/ta");
      else return res.redirect("/admin");
    } catch (error) {
      return res.status(400).render("home", {
        error:
          typeof error === "string"
            ? error
            : error.message || "Invalid userId or password",
        formData: { email },
      });
    }
  });

router
  .route("/register")
  .get(async (req, res) => {
    res.render("register", { error: false });
  })
  .post(async (req, res) => {
    let {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      role,
      dateOfBirth,
      age,
      gender,
      major,
    } = req.body;
    try {
      firstName = stringValidate(firstName);
      azAZLenValidate(firstName, 2, 20);
      lastName = stringValidate(lastName);
      azAZLenValidate(lastName, 2, 20);
      age = stringValidate(age);
      age = parseInt(age);
      if (!Number.isInteger(age) || age <= 0)
        throw "Age must be a positive integer";
      if (!["male", "female", "other"].includes(gender)) throw "Invalid gender";
      email = validateEmail(email);
      passwordValidate(password);
      if (!confirmPassword || typeof confirmPassword !== "string")
        throw "Enter confirm Password of type string";
      if (password !== confirmPassword) throw "Passwords dont match!";
      if (!["student", "professor", "admin", "ta"].includes(role))
        throw "Invalid user role";
      if (!isValidDateString(dateOfBirth)) {
        throw "Invalid date of birth";
      }
      if (
        role === "student" &&
        (!major || typeof major !== "string" || major.trim().length === 0)
      )
        throw "Student must have a major";
      const result = await userData.createUser(
        firstName,
        lastName,
        age,
        gender,
        email,
        password,
        role,
        dateOfBirth,
        major
      );
      if (result && result.registrationCompleted) {
        req.session.successMessage =
          "Registration successful! Please wait for admin approval. You’ll be notified via email.";
        return res.redirect("/");
      }
    } catch (error) {
      res.status(400).render("register", {
        error:
          typeof error === "string" ? error : error.message || "Invalid input!",
        formData: req.body,
      });
    }
  });

router.route("/logout").get(async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).render("error", {
        error: "There was a problem signing you out. Please try again.",
      });
    }
    res.clearCookie("Scholario");
    return res.redirect("/?loggedOut=true");
  });
});

export default router;
