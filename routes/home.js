import {Router} from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import {sendResetEmail} from "../utils/mailer.js";
import {users} from "../config/mongoCollections.js";
import {userData} from "../data/index.js";
import {
    stringValidate,
    validateEmail,
    passwordValidate,
    azAZLenValidate,
    isValidDateString
} from "../validation.js";
import {preventDoubleLogin} from "../middleware.js";
import xss from "xss";

const router = Router();

router
    .route("/")
    .get(preventDoubleLogin, async (req, res) => {
        const logout = req.query.loggedOut ? "Successfully logged out!" : null;
        const success = xss(req.query.success || "");
        res.render("home", {
            error: false,
            logout,
            successMessage: success || null,
        });
    })
    .post(async (req, res) => {
        let {email, password} = req.body;
        try {
            email = xss(validateEmail(email));
            passwordValidate(password);
            const user = await userData.login(email, password);
            req.session.user = {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                age: user.age,
                gender: user.gender,
                email: user.email,
                role: user.role,
                major: user.major,
                dateOfBirth: user.dateOfBirth,
                accessStatus: user.accessStatus,
                userCreatedAt: user.userCreatedAt,
            };
            if (user.role === "professor") return res.redirect("/professor");
            else if (user.role === "student") return res.redirect("/student");
            else if (user.role === "ta") return res.redirect("/student");
            else return res.redirect("/admin");
        } catch (error) {
            return res.status(400).render("home", {
                error:
                    typeof error === "string"
                        ? error
                        : error.message || "Invalid userId or password",
                formData: {email: xss(email)},
            });
        }
    });

router
    .route("/register")
    .get(async (req, res) => {
        res.render("register", {error: false});
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
            firstName = xss(stringValidate(firstName));
            azAZLenValidate(firstName, 2, 20);
            lastName = xss(stringValidate(lastName));
            azAZLenValidate(lastName, 2, 20);
            if (!["male", "female", "other"].includes(gender)) throw "Invalid Gender";
            email = xss(validateEmail(email));
            passwordValidate(password);
            if (!confirmPassword || typeof confirmPassword !== "string")
                throw "Confirm Password must be of type String";
            if (password !== confirmPassword) throw "Passwords dont match!";
            if (!["student", "professor", "admin", "ta"].includes(role))
                throw "Invalid user role";
            if (!isValidDateString(dateOfBirth)) {
                throw "Invalid Date Of Birth";
            }
            if (
                role === "student" &&
                (!major || typeof major !== "string" || major.trim().length === 0)
            )
                throw "Student must have a major";
            major = xss(major);
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
                if (req.headers.accept?.includes("application/json")) {
                    return res.status(200).json({success: true});
                }
                req.session.successMessage =
                    "Registration successful! Please wait for Admin approval. You’ll be notified via email once you are approved.";
                return res.redirect("/");
            }
        } catch (error) {
            const errMsg =
                typeof error === "string" ? error : error.message || "Invalid input!";
            if (req.headers.accept?.includes("application/json")) {
                return res.status(400).json({error: errMsg});
            }
            res.status(400).render("register", {
                error: errMsg,
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

router
    .route("/forgot-password")
    .get(preventDoubleLogin, async (req, res) => {
        res.render("forgotPassword", {error: null});
    })
    .post(async (req, res) => {
        let email = xss(req.body.email);
        const usersCollection = await users();
        const user = await usersCollection.findOne({email: email.toLowerCase()});

        if (!user) {
            return res.render("forgotPassword", {error: "User not found."});
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expiry = Date.now() + 1000 * 60 * 15; // 15 minutes

        await usersCollection.updateOne(
            {_id: user._id},
            {$set: {resetToken: token, resetTokenExpiry: expiry}}
        );

        const resetLink = `http://localhost:3000/reset-password/${token}`;
        await sendResetEmail(user.email, user.firstName, resetLink);

        res.render("forgotPassword", {
            success: "Check your email for reset link.",
        });
    });

router
    .route("/reset-password/:token")
    .get(async (req, res) => {
        const {token} = req.params;
        const usersCollection = await users();
        const user = await usersCollection.findOne({
            resetToken: token,
            resetTokenExpiry: {$gt: Date.now()},
        });

        if (!user)
            return res
                .status(400)
                .render("error", {error: "Invalid or expired token"});

        return res.render("resetPassword", {token});
    })
    .post(async (req, res) => {
        const {token} = req.params;
        const {newPassword, confirmPassword} = req.body;
        try {
            passwordValidate(newPassword);
        } catch (error) {
            return res.render("resetPassword", {
                token,
                error:
                    typeof error === "string"
                        ? error
                        : error.message || "Invalid Password!",
            });
        }
        if (newPassword !== confirmPassword) {
            return res.render("resetPassword", {
                token,
                error: "Passwords don't match.",
            });
        }

        const usersCollection = await users();
        const user = await usersCollection.findOne({
            resetToken: token,
            resetTokenExpiry: {$gt: Date.now()},
        });

        if (!user)
            return res
                .status(400)
                .render("error", {error: "Invalid or expired token"});

        const hashed = await bcrypt.hash(newPassword, 10);
        await usersCollection.updateOne(
            {_id: user._id},
            {
                $set: {password: hashed},
                $unset: {resetToken: "", resetTokenExpiry: ""},
            }
        );

        res.redirect("/?success=Password updated. Please log in.");
    });
export default router;
