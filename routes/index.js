import homeRoutes from "./home.js";

const constructorMethod = (app) => {
  app.use("/", homeRoutes);
};

export default constructorMethod;
