import { Router } from "express";
import { ObjectId } from "mongodb";
const router = Router();

import { users } from "../config/mongoCollections.js";

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

  res.render("admin/admin", { pendingUsers, approvedUsers, rejectedUsers });
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
    return res.status(400).render("admin/admin", {
      error:
        typeof error === "string"
          ? error
          : error.message || "Something went wrong while approving the user.",
      pendingUsers,
    });
  }
});

router.route("/reject/:id").post(async (req, res) => {
  try {
    const userId = req.params.id;
    if (!ObjectId.isValid(userId)) throw "Invalid user ID";

    const usersCollection = await users();
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
    return res.status(400).render("admin/admin", {
      error:
        typeof error === "string"
          ? error
          : error.message || "Something went wrong while rejecting the user.",
      pendingUsers,
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

    res.redirect("/admin");
  } catch (error) {
    return res.status(500).render("error", {
      error: typeof error === "string" ? error : error.message || "Something went wrong while deleting the user.",
    });
  }
});


export default router;
