import multer from 'multer';
import { storage } from './config/cloudinary.js';

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
export const preventDoubleLogin = (req, res, next) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}`);
  }
  next();
};

// Multer middleware for uploading proof to Cloudinary
export const absenceProofUpload = multer({ storage });

