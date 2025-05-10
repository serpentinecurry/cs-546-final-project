import express from "express";

const app = express();

import session from "express-session";
import exphbs from "express-handlebars";
import path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import configRoutes from "./routes/index.js";
import {preventDoubleLogin, isAdmin, isStudent, isProfessor} from "./middleware.js";

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.engine(
    "handlebars",
    exphbs.engine({
        defaultLayout: "main",
        layoutsDir: path.join(__dirname, "views/layouts"),

        partialsDir: [path.join(__dirname, "views/student/partials"),

            path.join(__dirname, "views/professorDasboard"),
        ],
        helpers: {
            ifEquals: function (arg1, arg2, options) {
                return arg1 === arg2 ? options.fn(this) : options.inverse(this);
            },
            eq: (a, b) => a === b,
            inc : function(value) {
                return parseInt(value) + 1;
            },
            json: function(context) {
                return JSON.stringify(context);
            },
            gt: function(a, b) {
                return a > b;
            },
            substr: function(str, start, len) {
                if (typeof str !== 'string') return '';
                return str.substr(start, len);
            },
            formatDate: function(date) {
                return new Date(date).toLocaleDateString();
            },
            array: function() {
                return Array.from({ length: arguments[0] }, (_, i) => i + 1);
            },
            lte: function(a, b) {
                return a <= b;
            },
            lt: function(a, b) {
                return a < b;
            },
            add: function(a, b) {
                return Number(a) + Number(b);
            },
            and: function(a, b) {
                return a && b;
            }
        }
    })
);
app.set("view engine", "handlebars");

// Static files & parsing
app.use("/public", express.static("public"));
app.use(express.json());
app.use(express.urlencoded({extended: true}));

//Production Session Configuration (for later use)
// import MongoStore from "connect-mongo";
//
// app.use(
//   session({
//     name: "Scholario",
//     secret: "top secret",
//     saveUninitialized: false,
//     resave: false,
//     store: MongoStore.create({
//       mongoUrl: "mongodb://localhost:27017/scholarioSession", // your MongoDB session DB
//       ttl: 60 * 60, // 1 hour
//     }),
//     cookie: { maxAge: 3600000 },
//   })
// );


// Session config
app.use(
    session({
        name: "Scholario",
        secret: "top secret",
        saveUninitialized: false,
        resave: false,
        cookie: {maxAge: 3600000}, // session expires after one hour
    })
);

// Flash messages / local variables
app.use((req, res, next) => {
    console.log(">>> Session check:", req.session?.user);
    res.locals.successMessage = req.session.successMessage || null;
    delete req.session.successMessage;
    next();
});

// Access control
app.use("/register", preventDoubleLogin);
app.use("/admin", isAdmin);
app.use("/admin/courses", isAdmin);
app.use("/student", isStudent);
app.use("/professor", isProfessor);

// Routes
configRoutes(app);

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render("error", {error: "Internal Server Error"});
});

// Start server
app.listen(3000, () => {
    console.log("We've now got a server!");
    console.log("Your routes will be running on http://localhost:3000");
});
