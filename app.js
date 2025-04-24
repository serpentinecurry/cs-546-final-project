import express from "express";
const app = express();

import session from "express-session";
import exphbs from "express-handlebars";

import configRoutes from "./routes/index.js";
import { alreadyLoggedIn, alreadyRegistered } from "./middleware.js";

app.use("/public", express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.engine(
  "handlebars",
  exphbs.engine({
    defaultLayout: "main",
    helpers: {
      eq: (a, b) => a === b,
    },
  })
);
app.set("view engine", "handlebars");

app.use(
  session({
    name: "Scholario",
    secret: "top secret",
    saveUninitialized: false,
    resave: false,
    cookie: { maxAge: 3600000 }, // session expires after one hour
  })
);

app.use("/", alreadyLoggedIn);
app.use("/register", alreadyRegistered);
app.use((req, res, next) => {
  res.locals.successMessage = req.session.successMessage || null;
  delete req.session.successMessage;
  next();
});

configRoutes(app);

app.listen(3000, () => {
  console.log("We've now got a server!");
  console.log("Your routes will be running on http://localhost:3000");
});
