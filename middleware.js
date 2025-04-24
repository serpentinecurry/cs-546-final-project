export const alreadyLoggedIn = (req, res, next) => {
  if (req.session.user) {
    if (req.session.user.role === "professor")
      return res.redirect("/professor");
    else if (req.session.user.role === "student")
      return res.redirect("/student");
    else if (req.session.user.role === "ta") return res.redirect("/ta");
    else if (req.session.user.role === "admin") return res.redirect("/admin");
  }
  next();
};

export const alreadyRegistered = (req, res, next) => {
  if (req.session.user) {
    if (req.session.user.role === "professor")
      return res.redirect("/professor");
    else if (req.session.user.role === "student")
      return res.redirect("/student");
    else if (req.session.user.role === "ta") return res.redirect("/ta");
    else if (req.session.user.role === "admin") return res.redirect("/admin");
  }
  next();
};
