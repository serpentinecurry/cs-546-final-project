import express from "express";
const app = express();

import session from "express-session";
import exphbs from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import configRoutes from "./routes/index.js";
import { preventDoubleLogin, isAdmin, isStudent } from "./middleware.js";

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.engine(
  "handlebars",
  exphbs.engine({
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: [path.join(__dirname, "views/student/partials")],
    helpers: {
      ifEquals: function (arg1, arg2, options) {
        return arg1 === arg2 ? options.fn(this) : options.inverse(this);
      }
    }
  })
);
app.set("view engine", "handlebars");

// Static files & parsing
app.use("/public", express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session config
app.use(
  session({
    name: "Scholario",
    secret: "top secret",
    saveUninitialized: false,
    resave: false,
    cookie: { maxAge: 3600000 }, // session expires after one hour
  })
);

// Flash messages / local variables
app.use((req, res, next) => {
  res.locals.successMessage = req.session.successMessage || null;
  delete req.session.successMessage;
  next();
});

// Access control
app.use("/register", preventDoubleLogin);
app.use("/admin", isAdmin);
app.use("/admin/courses", isAdmin);
app.use("/student", isStudent);

// Routes
configRoutes(app);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", { error: "Internal Server Error" });
});

// Start server
app.listen(3000, () => {
  console.log("We've now got a server!");
  console.log("Your routes will be running on http://localhost:3000");
});
