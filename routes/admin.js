import { Router } from "express";
import { ObjectId } from "mongodb";
const router = Router();

import { users,courses } from "../config/mongoCollections.js";

router.route("/").get(async (req, res) => {
  const usersCollection = await users();
  const pendingUsers = await usersCollection
    .find({ accessStatus: "Pending" })
    .toArray();
  const approvedUsers = await usersCollection
    .find({
      accessStatus: "approved",
      role: { $ne: "admin" },
    })
    .toArray();

  const rejectedUsers = await usersCollection
    .find({ accessStatus: "Rejected" })
    .toArray();

   return res.render("admin/admin", { pendingUsers, approvedUsers, rejectedUsers });
});

router.route("/approve/:id").post(async (req, res) => {
  try {
    const userId = req.params.id;
    if (!ObjectId.isValid(userId)) throw "Invalid user ID";

    const usersCollection = await users();
    const updateRes = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { accessStatus: "approved" } }
    );

    if (updateRes.modifiedCount === 0) throw "User approval failed";

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

    const assignedCourse = await coursesCollection.findOne({ professorId: new ObjectId(userId) });
    if (assignedCourse) throw "Cannot reject a user assigned as a professor to a course.";

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
      error: typeof error === "string" ? error : error.message || "User not found",
    });
  }
});

router.route("/delete/:id").post(async (req, res) => {
  try {
    const userId = req.params.id;
    if (!ObjectId.isValid(userId)) throw "Invalid user ID";

    const usersCollection = await users();
    const deleteRes = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
    if (deleteRes.deletedCount === 0) throw "User deletion failed";

    return res.redirect("/admin");
  } catch (error) {
    return res.status(500).render("error", {
      error: typeof error === "string" ? error : error.message || "Something went wrong while deleting the user.",
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

     return res.render("admin/searchUsers", { users: matchingUsers, searchTerm, role });
  } catch (error) {
    return res.status(500).render("error", { error: "Failed to search users." });
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
      error: typeof error === "string" ? error : error.message || "Error promoting user.",
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
      error: typeof error === "string" ? error : error.message || "Error demoting user.",
    });
  }
});


export default router;
