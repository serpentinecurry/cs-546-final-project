import homeRoutes from "./home.js";
import adminRoutes from "./admin.js"
import courseRoutes from "./courses.js"

const constructorMethod = (app) => {
  app.use("/", homeRoutes);
  app.use("/admin", adminRoutes)
  app.use("/admin/courses", courseRoutes)

  app.use(/(.*)/, (req, res) => {
    res.redirect("/")
  });
};

export default constructorMethod;
