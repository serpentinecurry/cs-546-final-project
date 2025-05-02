import homeRoutes from "./home.js";
import adminRoutes from "./admin.js";
import courseRoutes from "./courses.js";
import studentRoutes from "./student.js";

const constructorMethod = (app) => {
  // Public routes
  app.use("/", homeRoutes);

  // Admin routes
  app.use("/admin", adminRoutes);
  app.use("/admin/courses", courseRoutes);

  // Student routes
  app.use("/student", studentRoutes);

  // 404 handler for unmatched routes
  app.use(/(.*)/, (req, res) => {
    console.warn(`404 - Route not found: ${req.originalUrl}`);
    res.status(404).render("error", {
      layout: "main",
      error: "Oops! The page you're looking for doesn't exist.",
    });
  });
};

export default constructorMethod;
