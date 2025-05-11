import multer from 'multer';
import { storage } from './config/cloudinary.js';
import { courses } from "./config/mongoCollections.js";
import { ObjectId } from "mongodb";

// Middleware: Admin-only access
export const isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { error: 'Unauthorized: Admins only' });
  }
  next();
};

// Middleware: Student or TA access
export const isStudent = (req, res, next) => {
  const role = req.session.user?.role;
  if (!req.session.user || (role !== 'student' && role !== 'ta')) {
    return res.status(403).render('error', { error: 'Unauthorized: Students only' });
  }
  next();
};

// Middleware: Prevent login when already authenticated
// Middleware: Prevent login when already authenticated
export const preventDoubleLogin = (req, res, next) => {
  if (req.session.user) {
    const role = req.session.user.role.toLowerCase();
    if (role === 'ta' || role === 'student') {
      return res.redirect('/student');
    } else if (role === 'admin') {
      return res.redirect('/admin');
    } else if (role === 'professor') {
      return res.redirect('/professor');
    }
  }
  next();
};


export const isProfessor = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'professor') {
    return res.status(403).render('error', { error: 'Unauthorized: Professors only' });
  }
  next();
};

// Multer middleware for uploading proof to Cloudinary
export const absenceProofUpload = multer({ storage });

export const checkActiveEnrollment = async (req, res, next) => {
    try {
        const studentId = req.session.user?._id;
        const courseId = req.params.courseId || req.params.id || req.body.courseId;

        if (!studentId || !courseId || !ObjectId.isValid(courseId)) {
            return res.status(403).render("error", {
                layout: "main",
                error: "Unauthorized or invalid course access.",
            });
        }

        const courseCollection = await courses();
        const course = await courseCollection.findOne({
            _id: new ObjectId(courseId),
            studentEnrollments: {
                $elemMatch: {
                    studentId: new ObjectId(studentId),
                    status: "active"
                }
            }
        });

        if (!course) {
            return res.status(403).render("error", {
                layout: "main",
                error: "⛔ You are not actively enrolled in this course.",
            });
        }

        next();
    } catch (e) {
        console.error("Enrollment middleware error:", e);
        res.status(500).render("error", {
            layout: "main",
            error: "Server error while verifying enrollment."
        });
    }
};

export const verifyProfessorOwnsCourse = async (req, res, next) => {
    try {
        const professorId = req.session.user?._id;
        const courseId = req.params.courseId || req.params.id;

        if (!professorId || !courseId || !ObjectId.isValid(courseId)) {
            return res.status(403).render("error", {
                layout: "main",
                error: "❌ Invalid course or user session.",
            });
        }

        const courseCollection = await courses();
        const course = await courseCollection.findOne({
            _id: new ObjectId(courseId),
            professorId: new ObjectId(professorId)
        });

        if (!course) {
            return res.status(403).render("error", {
                layout: "main",
                error: "⛔ You do not have access to this course.",
            });
        }

        next();
    } catch (e) {
        console.error("Course ownership check failed:", e);
        return res.status(500).render("error", {
            layout: "main",
            error: "Server error while verifying course access."
        });
    }
};