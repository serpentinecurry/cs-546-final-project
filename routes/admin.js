import { Router } from "express";
import { ObjectId } from "mongodb";
import { sendApprovalEmail } from "../utils/mailer.js";
const router = Router();

import { users, courses, changeRequests } from "../config/mongoCollections.js";
import { userData } from "../data/index.js";
import {
  stringValidate,
  azAZLenValidate,
  validateEmail,
  passwordValidate,
  isValidDateString,
} from "../validation.js";
import { sendCredentialsEmail } from "../utils/mailer.js";

router.route("/").get(async (req, res) => {
  console.log(req.session.user);
  const { success } = req.query;
  const usersCollection = await users();
  const coursesCollection = await courses();
  const pendingUsers = await usersCollection
    .find({ accessStatus: "Pending" })
    .toArray();

  // Fetch dashboard stats
  const studentCount = await usersCollection.countDocuments({
    role: "student",
    accessStatus: "approved",
  });
  const professorCount = await usersCollection.countDocuments({
    role: "professor",
    accessStatus: "approved",
  });
  const taCount = await usersCollection.countDocuments({
    role: "ta",
    accessStatus: "approved",
  });
  const courseCount = await coursesCollection.countDocuments({});

  const approvedUsers = await usersCollection
    .find({
      accessStatus: "approved",
      role: { $ne: "admin" },
    })
    .toArray();

  const rejectedUsers = await usersCollection
    .find({ accessStatus: "Rejected" })
    .toArray();

  return res.render("admin/admin", {
    pendingUsers,
    approvedUsers,
    rejectedUsers,
    studentCount,
    professorCount,
    taCount,
    courseCount,
    success: req.query.success || null,
  });
});

router.route("/approve/:id").post(async (req, res) => {
  try {
    const userId = req.params.id;
    if (!ObjectId.isValid(userId)) throw "Invalid user ID";

    const usersCollection = await users();
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) throw "User not found.";

    const updateRes = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { accessStatus: "approved" } }
    );

    if (updateRes.modifiedCount === 0) throw "User approval failed";

    await sendApprovalEmail(user.email, user.firstName, user.role);

    return res.redirect("/admin");
  } catch (error) {
    const usersCollection = await users();
    const pendingUsers = await usersCollection
      .find({ accessStatus: "Pending" })
      .toArray();
    return res.status(400).render("error", {
      error:
        typeof error === "string"
          ? error
          : error.message || "Something went wrong while approving the user.",
    });
  }
});

router.route("/reject/:id").post(async (req, res) => {
  try {
    const userId = req.params.id;
    if (!ObjectId.isValid(userId)) throw "Invalid user ID";

    const usersCollection = await users();
    const coursesCollection = await courses();

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) throw "User not found.";

    const assignedCourse = await coursesCollection.findOne({
      professorId: new ObjectId(userId),
    });
    if (assignedCourse)
      throw "Cannot reject a user assigned as a professor to a course.";

    const updateRes = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { accessStatus: "Rejected" } }
    );
    if (updateRes.modifiedCount === 0) throw "User rejection failed";
    return res.redirect("/admin");
  } catch (error) {
    const usersCollection = await users();
    const pendingUsers = await usersCollection
      .find({ accessStatus: "Pending" })
      .toArray();
    return res.status(400).render("error", {
      error:
        typeof error === "string"
          ? error
          : error.message || "Something went wrong while rejecting the user.",
    });
  }
});

router.route("/user/:id").get(async (req, res) => {
  try {
    const userId = req.params.id;
    if (!ObjectId.isValid(userId)) throw "Invalid user ID";

    const usersCollection = await users();
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) throw "User not found";

    res.render("admin/userProfile", { user });
  } catch (error) {
    return res.status(400).render("error", {
      error:
        typeof error === "string" ? error : error.message || "User not found",
    });
  }
});

router.route("/delete/:id").post(async (req, res) => {
  try {
    const userId = req.params.id;
    if (!ObjectId.isValid(userId)) throw "Invalid user ID";

    const usersCollection = await users();
    const deleteRes = await usersCollection.deleteOne({
      _id: new ObjectId(userId),
    });
    if (deleteRes.deletedCount === 0) throw "User deletion failed";

    return res.redirect("/admin");
  } catch (error) {
    return res.status(500).render("error", {
      error:
        typeof error === "string"
          ? error
          : error.message || "Something went wrong while deleting the user.",
    });
  }
});

router.route("/searchUsers").get(async (req, res) => {
  const { searchTerm, role } = req.query;

  try {
    const usersCollection = await users();

    let query = { accessStatus: { $eq: "approved" }, role: { $ne: "admin" } };

    if (role && role !== "all") {
      query.role = role;
    }

    if (searchTerm) {
      query.$or = [
        { firstName: { $regex: searchTerm, $options: "i" } },
        { lastName: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const matchingUsers = await usersCollection.find(query).toArray();

    return res.render("admin/searchUsers", {
      users: matchingUsers,
      searchTerm,
      role,
    });
  } catch (error) {
    return res
      .status(500)
      .render("error", { error: "Failed to search users." });
  }
});

router.route("/promote/:id").post(async (req, res) => {
  try {
    const userId = req.params.id;
    if (!ObjectId.isValid(userId)) throw "Invalid user ID";

    const usersCollection = await users();
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) throw "User not found";

    if (user.role !== "student") {
      throw "Only students can be promoted to TA.";
    }

    const updateRes = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { role: "ta" } }
    );

    if (updateRes.modifiedCount === 0) throw "User promotion failed.";

    return res.redirect(`/admin/user/${userId}`); // after promoting, stay on profile page
  } catch (error) {
    return res.status(400).render("error", {
      error:
        typeof error === "string"
          ? error
          : error.message || "Error promoting user.",
    });
  }
});

router.route("/demote/:id").post(async (req, res) => {
  try {
    const userId = req.params.id;
    if (!ObjectId.isValid(userId)) throw "Invalid user ID";

    const usersCollection = await users();
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) throw "User not found";

    if (user.role !== "ta") {
      throw "Only TAs can be demoted back to student.";
    }

    const updateRes = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { role: "student" } }
    );

    if (updateRes.modifiedCount === 0) throw "User demotion failed.";

    return res.redirect(`/admin/user/${userId}`); // stay on user profile after demote
  } catch (error) {
    return res.status(400).render("error", {
      error:
        typeof error === "string"
          ? error
          : error.message || "Error demoting user.",
    });
  }
});

router.route("/change-requests").get(async (req, res) => {
  try {
    const requestCollection = await changeRequests();
    const userCollection = await users();
    const rawRequests = await requestCollection
      .find({ status: "pending" })
      .toArray();
    const requests = [];

    for (const req of rawRequests) {
      const user = await userCollection.findOne(
        { _id: req.userId },
        { projection: { firstName: 1, lastName: 1 } }
      );

      requests.push({
        ...req,
        fullName: user ? `${user.firstName} ${user.lastName}` : "Unknown User",
      });
    }

    const { success } = req.query;

    return res.render("admin/changeRequests", {
      requests,
      user: req.session.user,
      successMessage:
        success === "request-resolved"
          ? "Request resolved successfully."
          : null,
    });
  } catch (error) {
    return res.status(500).render("error", { error: error.toString() });
  }
});

router.route("/change-requests/:id/approve").post(async (req, res) => {
  try {
    await userData.approveRequest(req.params.id);
    return res.redirect("/admin/change-requests?success=request-resolved");
  } catch (error) {
    return res.status(400).render("error", { error: error.toString() });
  }
});

router.route("/change-requests/:id/reject").post(async (req, res) => {
  try {
    const { adminNote } = req.body;
    await userData.rejectRequest(req.params.id, adminNote || "");
    return res.redirect("/admin/change-requests?success=request-resolved");
  } catch (error) {
    res.status(400).render("error", { error: error.toString() });
  }
});

router
  .route("/create-user")
  .get(async (req, res) => {
    try {
      return res.render("admin/createUserForm", {
        user: req.session.user,
        formData: {},
        error: null,
      });
    } catch (error) {
      return res.render("admin/createUserForm", {
        user: req.session.user,
        formData: req.body,
        error: error,
      });
    }
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
      gender,
      major,
    } = req.body;
    try {
      firstName = stringValidate(firstName);
      azAZLenValidate(firstName, 2, 20);
      lastName = stringValidate(lastName);
      azAZLenValidate(lastName, 2, 20);
      if (!["male", "female", "other"].includes(gender)) throw "Invalid Gender";
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
        gender,
        email,
        password,
        role,
        dateOfBirth,
        major
      );

      if (result && result.registrationCompleted) {
        const usersCollection = await users()
        await usersCollection.updateOne({ email: email.toLowerCase() }, { $set: { accessStatus: "approved" } });
        const fullName = `${firstName} ${lastName}`;
        await sendCredentialsEmail(email, fullName, role, password);
        return res.redirect("/admin?success=user-created");
      }
    } catch (error) {
      res.status(400).render("admin/createUserForm", {
        user: req.session.user,
        error:
          typeof error === "string" ? error : error.message || "Something went sideways :(",
        formData: req.body,
      });
    }
  });
export default router;
