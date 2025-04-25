import { Router } from "express";
import { ObjectId } from "mongodb";
const router = Router();

import { userData } from "../data/index.js";
import {
  stringValidate,
  validateEmail,
  passwordValidate,
  azAZLenValidate,
  isValidDateString,
} from "../validation.js";
import { users } from "../config/mongoCollections.js";

router.route("/").get(async (req, res) => {
  const usersCollection = await users();
  const pendingUsers = await usersCollection
    .find({ accessStatus: "Pending" })
    .toArray();
  res.render("admin", { pendingUsers });
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

    res.redirect("/admin");
  } catch (error) {
    const usersCollection = await users();
    const pendingUsers = await usersCollection
      .find({ accessStatus: "Pending" })
      .toArray();
    return res.status(400).render("admin", {
      error:
        typeof error === "string"
          ? error
          : error.message || "Something went wrong while approving the user.",
      pendingUsers,
    });
  }
});

export default router;
