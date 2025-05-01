import homeRoutes from "./home.js";
import adminRoutes from "./admin.js"
import courseRoutes from "./courses.js"
import studentRoutes from "./student.js"
const constructorMethod = (app) => {
  app.use("/", homeRoutes);
  app.use("/admin", adminRoutes)
  app.use("/admin/courses", courseRoutes)
  app.use("/student", studentRoutes)

  app.use(/(.*)/, (req, res) => {
    res.redirect("/")
  });
};

export default constructorMethod;
