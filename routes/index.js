import homeRoutes from "./home.js";
import adminRoutes from "./admin.js"

const constructorMethod = (app) => {
  app.use("/", homeRoutes);
  app.use("/admin", adminRoutes)

  app.use(/(.*)/, (req, res) => {
    res.redirect("/")
  });
};

export default constructorMethod;
